import { createAdminClient } from "@/lib/supabase/admin";
export async function GET() {
  const db = createAdminClient();
  const { data: emails, error } = await db
    .from("emails")
    .select("id,category")
    .order("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { data: comparisons } = await db
    .from("comparisons")
    .select("email_id,status,review_reason,mismatched_fields");
  const byId = new Map((comparisons ?? []).map((x) => [x.email_id, x]));
  const out = Object.fromEntries(
    emails.map((email) => {
      const c = byId.get(email.id);
      const fields = (
        (c?.mismatched_fields as Array<{ field: string }>) ?? []
      ).map((x) => x.field);
      return [
        email.id,
        {
          category: email.category ?? "GENERAL",
          status: c?.status ?? "OK",
          review_reason: c?.review_reason ?? null,
          has_defect: c?.status === "MISMATCH",
          defect_fields: fields,
        },
      ];
    }),
  );
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": "attachment; filename=submission.json",
    },
  });
}
