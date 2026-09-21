import { createAdminClient } from "@/lib/supabase/admin";
import { classify } from "@/lib/pipeline/classify";
import { createHash, randomUUID } from "node:crypto";
export async function POST(request: Request) {
  const payload = (await request.json()) as {
    From?: string;
    Subject?: string;
    TextBody?: string;
    MessageID?: string;
    Attachments?: Array<{
      Name?: string;
      Content?: string;
      ContentType?: string;
    }>;
  };
  const id = `live_${payload.MessageID?.replace(/[^a-zA-Z0-9_-]/g, "") || randomUUID()}`;
  const db = createAdminClient();
  const names = (payload.Attachments ?? []).map((a) => a.Name || "attachment");
  const result = await classify({
    body: payload.TextBody ?? "",
    attachmentFilenames: names,
  });
  const email = await db.from("emails").upsert({
    id,
    sender: payload.From ?? "unknown",
    subject: payload.Subject ?? "(no subject)",
    body: payload.TextBody ?? "",
    source: "live_inbox",
    category: result.category,
    category_confidence: result.confidence,
    category_decided_by: result.decidedBy,
  });
  if (email.error)
    return Response.json({ error: email.error.message }, { status: 500 });
  for (const a of payload.Attachments ?? []) {
    if (!a.Content) continue;
    const bytes = Buffer.from(a.Content, "base64");
    const attachmentId = randomUUID();
    const storagePath = `live/${id}/${attachmentId}/${a.Name || "attachment"}`;
    const upload = await db.storage
      .from("clearport-documents")
      .upload(storagePath, bytes, {
        contentType: a.ContentType || "application/octet-stream",
      });
    if (upload.error)
      return Response.json({ error: upload.error.message }, { status: 500 });
    await db.from("attachments").insert({
      id: attachmentId,
      email_id: id,
      filename: a.Name || "attachment",
      doc_type: "unknown",
      storage_path: storagePath,
      source_path: `inbound/${a.Name || "attachment"}`,
      content_sha256: createHash("sha256").update(bytes).digest("hex"),
      byte_size: bytes.length,
      ingest_state: "stored",
    });
  }
  await db.from("audit_log").insert({
    email_id: id,
    actor: "system",
    action: "live_email_received",
    detail: { attachment_count: names.length },
  });
  return Response.json({ ok: true, id, category: result.category });
}
