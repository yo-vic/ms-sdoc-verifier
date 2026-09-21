import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import {
  DatasetInbox,
  ingestDataset,
  safeAttachmentPath,
  type IngestStore,
  type EmailRecord,
  type AttachmentRecord,
} from "../lib/ingest/dataset";

class MemoryStore implements IngestStore {
  emails = new Map<string, EmailRecord>();
  attachments = new Map<string, AttachmentRecord>();
  objects = new Map<string, Uint8Array>();
  async email(row: EmailRecord) {
    this.emails.set(row.id, row);
  }
  async attachment(row: AttachmentRecord, bytes: Uint8Array | null) {
    this.attachments.set(row.id, row);
    if (bytes !== null) this.objects.set(row.storage_path, bytes);
  }
  async audit() {}
}
const email = {
  email_id: "email_001",
  from: "ops@example.test",
  subject: "Check draft",
  body: "Please compare.",
  attachments: ["attachments/pair_SI.txt", "attachments/pair_BL.pdf"],
};
async function cleanup(root: string) {
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(root));
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(root).startsWith("clearport-test-")
  ) {
    throw new Error(
      "Refusing to remove a path outside the test temporary directory.",
    );
  }
  await rm(root, { recursive: true, force: true });
}
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "clearport-test-"));
  await mkdir(path.join(root, "inbox"));
  await mkdir(path.join(root, "attachments"));
  await writeFile(
    path.join(root, "inbox/email_001.json"),
    JSON.stringify(email),
  );
  await writeFile(
    path.join(root, email.attachments[0]),
    "SHIPPING INSTRUCTION\nContainers: 3",
  );
  await writeFile(
    path.join(root, email.attachments[1]),
    Buffer.from([0, 255, 1, 128]),
  );
  return root;
}

test("repeat import preserves one row per reference and identical binary data", async () => {
  const root = await fixture();
  try {
    const store = new MemoryStore(),
      inbox = new DatasetInbox(root);
    await ingestDataset(inbox, store);
    const second = await ingestDataset(inbox, store);
    assert.equal(second.emailCount, 1);
    assert.equal(store.emails.size, 1);
    assert.equal(store.attachments.size, 2);
    assert.equal(store.objects.size, 2);
    assert.equal(store.emails.get("email_001")!.received_at, null);
    const pdf = [...store.attachments.values()].find((r) =>
      r.filename.endsWith(".pdf"),
    )!;
    assert.deepEqual(
      Buffer.from(store.objects.get(pdf.storage_path)!),
      Buffer.from([0, 255, 1, 128]),
    );
    assert.equal("doc_type" in pdf, false);
    assert.match(await inbox.read_text(email.attachments[0]), /Containers: 3/);
  } finally {
    await cleanup(root);
  }
});

test("HTTP loader matches local folder, including original bytes", async () => {
  const root = await fixture();
  const local = new DatasetInbox(root);
  const server = createServer(async (req, res) => {
    if (req.url === "/emails") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify([email]));
      return;
    }
    const ref = decodeURIComponent(req.url!.slice(1));
    if (!email.attachments.includes(ref)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.end(await local.read_bytes(ref));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const remote = new DatasetInbox(`http://127.0.0.1:${address.port}`);
    const a = new MemoryStore(),
      b = new MemoryStore();
    assert.deepEqual(
      await ingestDataset(local, a),
      await ingestDataset(remote, b),
    );
    assert.deepEqual([...a.emails], [...b.emails]);
    for (const [key, value] of a.objects)
      assert.deepEqual(Buffer.from(value), Buffer.from(b.objects.get(key)!));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await cleanup(root);
  }
});

test("missing source retains a row; empty file remains a real zero-byte object", async () => {
  const root = await fixture();
  try {
    await rm(path.join(root, email.attachments[1]));
    await writeFile(path.join(root, email.attachments[0]), "");
    const store = new MemoryStore();
    const result = await ingestDataset(new DatasetInbox(root), store);
    assert.equal(result.missingCount, 1);
    assert.equal(store.attachments.size, 2);
    assert.equal(store.objects.size, 1);
    assert.equal([...store.objects.values()][0].length, 0);
  } finally {
    await cleanup(root);
  }
});

test("reject path traversal and URL-encoded escapes before reading attachments", () => {
  for (const ref of [
    "../.env",
    "attachments/../.env",
    "attachments/%2e%2e/.env",
    "attachments\\..\\.env",
    "/attachments/a",
    "attachments/a?x=1",
  ])
    assert.throws(() => safeAttachmentPath(ref));
});

test("duplicate IDs and malformed email records fail validation", async () => {
  const root = await fixture();
  try {
    await writeFile(
      path.join(root, "inbox/email_002.json"),
      JSON.stringify(email),
    );
    await assert.rejects(
      () => new DatasetInbox(root).emails(),
      /Duplicate email ID/,
    );
    await writeFile(
      path.join(root, "inbox/email_002.json"),
      JSON.stringify({ email_id: "email_002" }),
    );
    await assert.rejects(() => new DatasetInbox(root).emails());
  } finally {
    await cleanup(root);
  }
});

test("HTTP outage is an ingestion error, not a missing document", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/emails") {
      res.end(JSON.stringify([email]));
      return;
    }
    res.statusCode = 503;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as { port: number };
    await assert.rejects(
      () =>
        ingestDataset(
          new DatasetInbox(`http://127.0.0.1:${port}`),
          new MemoryStore(),
        ),
      /HTTP 503/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
