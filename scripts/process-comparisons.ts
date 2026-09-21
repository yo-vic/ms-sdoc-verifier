import { config } from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";
import { compareFields } from "../lib/pipeline/compare";
import { detectDocumentType } from "../lib/pipeline/doc-type";
import { extractLexicon } from "../lib/pipeline/lexicon";
import { normalize } from "../lib/pipeline/normalize";
import { parseAttachment } from "../lib/pipeline/parsers";
import type { ReviewReason } from "../lib/pipeline/types";

config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const BUCKET = "clearport-documents";

async function main() {
  const db = createAdminClient();
  const { data: emails, error } = await db.from("emails").select("id").eq("category", "BL_COMPARISON").order("id");
  if (error) throw new Error(error.message);
  console.log(`Processing ${emails.length} BL comparison emails.`);
  for (let index = 0; index < emails.length; index++) {
    const emailId = emails[index].id;
    const { data: attachments, error: attachmentsError } = await db.from("attachments").select("id,filename,storage_path").eq("email_id", emailId);
    if (attachmentsError) throw new Error(attachmentsError.message);
    let reason: ReviewReason | undefined;
    if (attachments.length < 2) reason = "missing_attachment";
    const parsed: Array<{ id: string; type: "SI" | "BL" | "unknown"; fields: ReturnType<typeof extractLexicon> }> = [];
    if (!reason) for (const attachment of attachments) {
      const object = await db.storage.from(BUCKET).download(attachment.storage_path);
      if (object.error) { reason = "unreadable"; break; }
      try {
        const document = await parseAttachment(attachment.filename, new Uint8Array(await object.data.arrayBuffer()));
        const type = detectDocumentType(document.lines);
        await db.from("attachments").update({ raw_text: document.rawText || null, is_readable: document.readable, read_method: document.method, doc_type: type }).eq("id", attachment.id);
        if (!document.readable) { reason = "unreadable"; break; }
        const fields = extractLexicon(document.lines).map(field => ({ ...field, normalizedValue: normalize(field.rawValue, field.field) }));
        parsed.push({ id: attachment.id, type, fields });
        const extracted = fields.map(field => ({ attachment_id: attachment.id, field_name: field.field, raw_value: field.rawValue, normalized_value: field.normalizedValue, evidence_snippet: field.evidenceSnippet, evidence_line: field.evidenceLine, extracted_by: field.extractedBy }));
        const upsert = await db.from("extracted_fields").upsert(extracted, { onConflict: "attachment_id,field_name" });
        if (upsert.error) throw new Error(upsert.error.message);
      } catch (parseError) { reason = "unreadable"; break; }
    }
    const si = parsed.find(item => item.type === "SI"); const bl = parsed.find(item => item.type === "BL");
    if (!reason && (!si || !bl)) reason = parsed.length === attachments.length ? "wrong_doc_type" : "missing_attachment";
    const result = compareFields(si?.fields ?? [], bl?.fields ?? [], reason);
    const write = await db.from("comparisons").upsert({ email_id: emailId, status: result.status, review_reason: result.reviewReason, mismatched_fields: result.mismatches }, { onConflict: "email_id" });
    if (write.error) throw new Error(write.error.message);
    const audit = await db.from("audit_log").insert({ email_id: emailId, actor: "system", action: "comparison_processed", detail: { status: result.status, review_reason: result.reviewReason, mismatches: result.mismatches } });
    if (audit.error) throw new Error(audit.error.message);
    if (index === 0 || (index + 1) % 10 === 0 || index + 1 === emails.length) console.log(`Processed ${index + 1}/${emails.length}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Processing failed."); process.exitCode = 1; });
