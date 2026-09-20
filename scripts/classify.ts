import { config } from "dotenv";
import { parseArgs } from "node:util";
import { DatasetInbox } from "../lib/ingest/dataset";
import { classify, classifyByRule, type ClassificationInput } from "../lib/pipeline/classify";
import { createAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const { values } = parseArgs({ options: { source: { type: "string" }, "dry-run": { type: "boolean" }, "retry-failures": { type: "boolean" } } });

async function main() {
  const inbox = new DatasetInbox(values.source ?? process.env.DATASET_SOURCE ?? ".");
  const emails = await inbox.emails();
  const counts = new Map<string, number>(); let llmNeeded = 0, llmFallbacks = 0;
  const fallbackSamples: string[] = [];
  if (values["dry-run"]) {
    for (const email of emails) {
      const result = classifyByRule({ body: email.body, attachmentFilenames: email.attachments });
      counts.set(result.category, (counts.get(result.category) ?? 0) + 1);
      if (result.confidence < 0.75) llmNeeded++;
    }
    console.log(JSON.stringify({ mode: "dry-run", total: emails.length, ruleCounts: Object.fromEntries(counts), llmFallbackCandidates: llmNeeded }, null, 2));
    return;
  }
  const db = createAdminClient();
  let targets = emails;
  if (values["retry-failures"]) {
    const failed = await db.from("emails").select("id").eq("category_confidence", 0);
    if (failed.error) throw new Error(`Find failed classifications: ${failed.error.message}`);
    const ids = new Set(failed.data.map(row => row.id));
    targets = emails.filter(email => ids.has(email.email_id));
  }
  console.log(`Classifying ${targets.length} emails. Gemini is called only for low-confidence messages.`);
  for (let index = 0; index < targets.length; index++) {
    const email = targets[index];
    const input: ClassificationInput = { body: email.body, attachmentFilenames: email.attachments };
    let result;
    try { result = await classify(input); }
    catch (error) {
      result = { category: "GENERAL" as const, confidence: 0, decidedBy: "llm" as const, reasoning: "LLM classification failed; defaulted safely to GENERAL." };
      const detail = { message: error instanceof Error ? error.message : "Unknown classification error" };
      llmFallbacks++;
      if (fallbackSamples.length < 3) fallbackSamples.push(detail.message);
      const audit = await db.from("audit_log").insert({ email_id: email.email_id, actor: "system", action: "classification_fallback_invalid", detail });
      if (audit.error) throw new Error(`Write classification fallback audit: ${audit.error.message}`);
    }
    const update = await db.from("emails").update({ category: result.category, category_confidence: result.confidence, category_decided_by: result.decidedBy }).eq("id", email.email_id);
    if (update.error) throw new Error(`Update ${email.email_id}: ${update.error.message}`);
    const audit = await db.from("audit_log").insert({ email_id: email.email_id, actor: "system", action: "classified", detail: { ...result } });
    if (audit.error) throw new Error(`Write classification audit: ${audit.error.message}`);
    counts.set(result.category, (counts.get(result.category) ?? 0) + 1);
    if (index === 0 || (index + 1) % 10 === 0 || index + 1 === targets.length) console.log(`Classified ${index + 1}/${targets.length}`);
  }
  console.log(JSON.stringify({ mode: values["retry-failures"] ? "retry-failures" : "complete", total: targets.length, counts: Object.fromEntries(counts),
    llmFallbacks, fallbackSamples }, null, 2));
  if (llmFallbacks) process.exitCode = 1;
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Classification failed."); process.exitCode = 1; });
