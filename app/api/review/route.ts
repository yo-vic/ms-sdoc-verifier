import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const body = (await request.json()) as { emailId?: string; note?: string };
  if (!body.emailId)
    return Response.json({ error: "emailId required" }, { status: 400 });
  const db = createAdminClient();
  const update = await db
    .from("comparisons")
    .update({
      reviewed: true,
      reviewed_at: new Date().toISOString(),
      reviewer_note: body.note ?? "Confirmed by reviewer",
    })
    .eq("email_id", body.emailId);
  if (update.error)
    return Response.json({ error: update.error.message }, { status: 500 });
  await db.from("audit_log").insert({
    email_id: body.emailId,
    actor: "human",
    action: "review_confirmed",
    detail: { note: body.note ?? null },
  });
  return Response.json({ ok: true });
}
