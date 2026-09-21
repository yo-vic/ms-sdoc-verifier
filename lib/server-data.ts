import { createAdminClient } from "@/lib/supabase/admin";

export async function inboxRows() {
  const db = createAdminClient();
  const { data: emails, error } = await db.from("emails").select("id,sender,subject,received_at,source,category,category_confidence,category_decided_by,created_at").order("id");
  if (error) throw new Error(error.message);
  const { data: comparisons, error: comparisonError } = await db.from("comparisons").select("email_id,status,review_reason,reviewed,created_at");
  if (comparisonError) throw new Error(comparisonError.message);
  const byEmail = new Map(comparisons.map(row => [row.email_id, row]));
  return emails.map(email => ({ ...email, comparison: byEmail.get(email.id) ?? null }));
}

export async function emailDetail(emailId: string) {
  const db = createAdminClient();
  const { data: email, error } = await db.from("emails").select("*").eq("id", emailId).single();
  if (error) throw new Error(error.message);
  const { data: attachments, error: attachmentError } = await db.from("attachments").select("id,filename,doc_type,raw_text,is_readable,read_method").eq("email_id", emailId).order("filename");
  if (attachmentError) throw new Error(attachmentError.message);
  const ids = attachments.map(row => row.id);
  const result = ids.length ? await db.from("extracted_fields").select("*").in("attachment_id", ids) : { data: [], error: null };
  if (result.error) throw new Error(result.error.message);
  const { data: comparison, error: comparisonError } = await db.from("comparisons").select("*").eq("email_id", emailId).maybeSingle();
  if (comparisonError) throw new Error(comparisonError.message);
  return { email, attachments, fields: result.data ?? [], comparison };
}

export async function insights() {
  const rows = await inboxRows(); const comparisons = rows.filter(row => row.comparison);
  const mismatch = comparisons.filter(row => row.comparison?.status === "MISMATCH"); const review = comparisons.filter(row => row.comparison?.status === "NEEDS_REVIEW");
  const category = rows.reduce<Record<string, number>>((out, row) => { const key = row.category ?? "UNCLASSIFIED"; out[key] = (out[key] ?? 0) + 1; return out; }, {});
  const reasons = review.reduce<Record<string, number>>((out, row) => { const key = row.comparison?.review_reason ?? "unknown"; out[key] = (out[key] ?? 0) + 1; return out; }, {});
  return { total: rows.length, category, reasons, comparisonCount: comparisons.length, mismatchCount: mismatch.length, reviewCount: review.length, automationRate: comparisons.length ? (comparisons.length - review.length) / comparisons.length : 0 };
}
