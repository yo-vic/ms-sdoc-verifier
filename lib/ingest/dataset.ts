import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const emailSchema = z.object({
  email_id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(z.string()),
  received_at: z.string().datetime({ offset: true }).nullish(),
});
export type DatasetEmail = z.infer<typeof emailSchema>;
export type AttachmentRecord = {
  id: string;
  email_id: string;
  filename: string;
  source_path: string;
  storage_path: string;
  content_sha256: string | null;
  byte_size: number | null;
  ingest_state: "stored" | "missing";
  ingest_error: string | null;
};
export type EmailRecord = {
  id: string;
  received_at: string | null;
  sender: string;
  subject: string;
  body: string;
  source: "dataset";
};
export interface IngestStore {
  email(row: EmailRecord): Promise<void>;
  attachment(row: AttachmentRecord, bytes: Uint8Array | null): Promise<void>;
  audit(emailId: string, detail: Record<string, unknown>): Promise<void>;
}
export const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const MAX_ATTACHMENT = 20 * 1024 * 1024;

export function safeAttachmentPath(value: string): string {
  if (
    value.includes("\\") ||
    value.includes("%") ||
    value.includes("\0") ||
    /[?#:]/.test(value)
  ) {
    throw new Error("Invalid attachment path.");
  }
  const parts = value.split("/");
  if (
    parts[0] !== "attachments" ||
    parts.length < 2 ||
    parts.some((p) => !p || p === "." || p === "..")
  ) {
    throw new Error("Attachment path must remain under attachments/.");
  }
  return parts.join("/");
}

export class MissingAttachmentError extends Error {}

export class DatasetInbox implements AsyncIterable<DatasetEmail> {
  private root: string;
  private remote: boolean;
  constructor(source: string) {
    this.remote = /^https?:\/\//i.test(source);
    this.root = this.remote ? source.replace(/\/+$/, "") : path.resolve(source);
    if (this.remote) {
      const url = new URL(this.root);
      if (url.username || url.password || url.search || url.hash)
        throw new Error("Use a plain dataset server URL.");
    }
  }
  private async request(route: string): Promise<Response> {
    const result = await fetch(this.root + route, {
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
    if (result.status === 404 && route.startsWith("/attachments/"))
      throw new MissingAttachmentError("Source attachment is absent.");
    if (!result.ok)
      throw new Error(`Dataset server returned HTTP ${result.status}.`);
    return result;
  }
  async emails(): Promise<DatasetEmail[]> {
    let values: unknown;
    if (this.remote) {
      values = await (await this.request("/emails")).json();
    } else {
      const names = (await readdir(path.join(this.root, "inbox")))
        .filter((n) => /^email_.*\.json$/.test(n))
        .sort();
      values = await Promise.all(
        names.map(async (name) =>
          JSON.parse(
            await readFile(path.join(this.root, "inbox", name), "utf8"),
          ),
        ),
      );
    }
    const emails = z.array(emailSchema).parse(values);
    const ids = new Set<string>();
    for (const email of emails) {
      if (ids.has(email.email_id))
        throw new Error(`Duplicate email ID: ${email.email_id}`);
      ids.add(email.email_id);
      if (new Set(email.attachments).size !== email.attachments.length)
        throw new Error(`Duplicate attachment reference: ${email.email_id}`);
      email.attachments.forEach(safeAttachmentPath);
    }
    return emails.sort((a, b) => a.email_id.localeCompare(b.email_id));
  }
  async *[Symbol.asyncIterator]() {
    yield* await this.emails();
  }
  async read_bytes(sourcePath: string): Promise<Uint8Array> {
    const safe = safeAttachmentPath(sourcePath);
    if (this.remote) {
      const response = await this.request(
        "/" + safe.split("/").map(encodeURIComponent).join("/"),
      );
      if (Number(response.headers.get("content-length")) > MAX_ATTACHMENT)
        throw new Error("Attachment exceeds 20 MiB limit.");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Dataset response has no body.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_ATTACHMENT) {
            await reader.cancel();
            throw new Error("Attachment exceeds 20 MiB limit.");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return Buffer.concat(chunks);
    }
    try {
      const root = await realpath(this.root);
      const resolved = await realpath(path.join(root, safe));
      const relative = path.relative(path.join(root, "attachments"), resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("Attachment symlink escapes source folder.");
      if ((await stat(resolved)).size > MAX_ATTACHMENT)
        throw new Error("Attachment exceeds 20 MiB limit.");
      return await readFile(resolved);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new MissingAttachmentError("Source attachment is absent.");
      throw error;
    }
  }
  async read_text(sourcePath: string) {
    return new TextDecoder().decode(await this.read_bytes(sourcePath));
  }
}

export function attachmentIdentity(emailId: string, sourcePath: string) {
  const hash = sha256(`${emailId}\0${sourcePath}`);
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return {
    id,
    storagePath: `dataset/${emailId}/${id}/${path.posix.basename(sourcePath)}`,
  };
}

export async function ingestDataset(inbox: DatasetInbox, store: IngestStore) {
  const emails = await inbox.emails();
  if (!emails.length) throw new Error("Dataset contains no email records.");
  const manifest: AttachmentRecord[] = [];
  for (const email of emails) {
    await store.email({
      id: email.email_id,
      received_at: email.received_at ?? null,
      sender: email.from,
      subject: email.subject,
      body: email.body,
      source: "dataset",
    });
    for (const sourcePath of email.attachments) {
      let bytes: Uint8Array | null;
      try {
        bytes = await inbox.read_bytes(sourcePath);
      } catch (error) {
        if (!(error instanceof MissingAttachmentError)) throw error;
        bytes = null;
      }
      const identity = attachmentIdentity(email.email_id, sourcePath);
      const row: AttachmentRecord = {
        id: identity.id,
        email_id: email.email_id,
        filename: path.posix.basename(sourcePath),
        source_path: sourcePath,
        storage_path: identity.storagePath,
        content_sha256: bytes === null ? null : sha256(bytes),
        byte_size: bytes?.byteLength ?? null,
        ingest_state: bytes === null ? "missing" : "stored",
        ingest_error: bytes === null ? "Source attachment is absent." : null,
      };
      await store.attachment(row, bytes);
      manifest.push(row);
    }
    await store.audit(email.email_id, {
      source: "dataset",
      attachment_count: email.attachments.length,
    });
  }
  return {
    emailCount: emails.length,
    attachmentCount: manifest.length,
    missingCount: manifest.filter((a) => a.ingest_state === "missing").length,
    manifest,
    emailIds: emails.map((e) => e.email_id),
  };
}
