import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DatasetInbox,
  attachmentIdentity,
  sha256,
  type AttachmentRecord,
  type EmailRecord,
  type IngestStore,
  MissingAttachmentError,
} from "./dataset";

const BUCKET = "clearport-documents";
function check(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}
const mime: Record<string, string> = {
  txt: "text/plain",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export class SupabaseIngestStore implements IngestStore {
  constructor(private db: SupabaseClient) {}
  async email(row: EmailRecord) {
    const existing = await this.db
      .from("emails")
      .select("sender,subject,body,source")
      .eq("id", row.id)
      .maybeSingle();
    check(existing.error, "Read existing email");
    if (
      existing.data &&
      (existing.data.source !== "dataset" ||
        (["sender", "subject", "body"] as const).some(
          (k) => existing.data![k] !== row[k],
        ))
    ) {
      throw new Error(
        `Email ${row.id} already exists with different content. Import revisions through the future revision workflow.`,
      );
    }
    check(
      (await this.db.from("emails").upsert(row, { onConflict: "id" })).error,
      "Upsert email",
    );
  }
  async attachment(row: AttachmentRecord, bytes: Uint8Array | null) {
    const existing = await this.db
      .from("attachments")
      .select("content_sha256,ingest_state")
      .eq("id", row.id)
      .maybeSingle();
    check(existing.error, "Read existing attachment");
    if (
      existing.data?.ingest_state === "stored" &&
      existing.data.content_sha256 !== row.content_sha256
    ) {
      throw new Error(
        `Attachment content changed for ${row.email_id}/${row.filename}. Existing evidence was preserved.`,
      );
    }
    // A failed run may be restarted. Do not re-upload an object whose recorded
    // content hash is already identical; verification will still download it.
    if (
      existing.data?.ingest_state === "stored" &&
      existing.data.content_sha256 === row.content_sha256
    )
      return;
    if (bytes !== null) {
      const contentType =
        mime[row.filename.split(".").pop()!.toLowerCase()] ??
        "application/octet-stream";
      const result = await this.db.storage
        .from(BUCKET)
        .upload(row.storage_path, bytes, { contentType, upsert: true });
      check(result.error, `Upload attachment ${row.email_id}/${row.filename}`);
    }
    // No parsing or filename-based document type assumptions during ingestion.
    check(
      (await this.db.from("attachments").upsert(row, { onConflict: "id" }))
        .error,
      "Upsert attachment",
    );
  }
  async audit(emailId: string, detail: Record<string, unknown>) {
    check(
      (
        await this.db.from("audit_log").insert({
          email_id: emailId,
          actor: "system",
          action: "dataset_ingested",
          detail,
        })
      ).error,
      "Write ingestion audit",
    );
  }
}

export async function verifySupabaseSeed(
  db: SupabaseClient,
  inbox: DatasetInbox,
  progress?: (done: number, total: number) => void,
) {
  const emails = await inbox.emails();
  const count = await db
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("source", "dataset");
  check(count.error, "Count dataset emails");
  if (count.count !== emails.length)
    throw new Error(
      `Email count mismatch: expected ${emails.length}, found ${count.count}.`,
    );
  let verifiedAttachments = 0,
    missingAttachments = 0;
  let verifiedEmails = 0;
  for (const email of emails) {
    const result = await db
      .from("emails")
      .select("id")
      .eq("id", email.email_id)
      .single();
    check(result.error, "Verify email ID");
    const rows = await db
      .from("attachments")
      .select("*")
      .eq("email_id", email.email_id);
    check(rows.error, "Verify attachment rows");
    if (rows.data!.length !== email.attachments.length)
      throw new Error(`Attachment row count mismatch: ${email.email_id}`);
    for (const sourcePath of email.attachments) {
      const identity = attachmentIdentity(email.email_id, sourcePath);
      const row = rows.data!.find(
        (r) => r.id === identity.id && r.source_path === sourcePath,
      );
      if (!row)
        throw new Error(
          `Attachment reference missing: ${email.email_id}/${sourcePath}`,
        );
      let source: Uint8Array;
      try {
        source = await inbox.read_bytes(sourcePath);
      } catch (error) {
        if (!(error instanceof MissingAttachmentError)) throw error;
        if (row.ingest_state !== "missing")
          throw new Error("Missing source not recorded.");
        missingAttachments++;
        verifiedAttachments++;
        continue;
      }
      if (
        row.ingest_state !== "stored" ||
        row.content_sha256 !== sha256(source)
      )
        throw new Error(`Attachment metadata mismatch: ${sourcePath}`);
      const object = await db.storage.from(BUCKET).download(row.storage_path);
      check(object.error, "Verify stored bytes");
      if (
        sha256(new Uint8Array(await object.data!.arrayBuffer())) !==
        sha256(source)
      )
        throw new Error(`Stored bytes differ: ${sourcePath}`);
      verifiedAttachments++;
    }
    progress?.(++verifiedEmails, emails.length);
  }
  return {
    emails: emails.length,
    attachmentReferences: verifiedAttachments,
    missingSourceFiles: missingAttachments,
    storageHashesVerified: verifiedAttachments - missingAttachments,
  };
}
