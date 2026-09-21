import { config } from "dotenv";
import { parseArgs } from "node:util";
import { DatasetInbox, ingestDataset, type IngestStore } from "../lib/ingest/dataset";
import { SupabaseIngestStore, verifySupabaseSeed } from "../lib/ingest/supabase-store";
import { createAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const { values } = parseArgs({ options: {
  source: { type: "string" }, "dry-run": { type: "boolean" }, "verify-only": { type: "boolean" },
} });

async function main() {
  if (values["dry-run"] && values["verify-only"]) throw new Error("Choose dry-run or verify-only, not both.");
  const inbox = new DatasetInbox(values.source ?? process.env.DATASET_SOURCE ?? ".");
  if (values["dry-run"]) {
    const sink: IngestStore = { async email() {}, async attachment() {}, async audit() {} };
    const { emailCount, attachmentCount, missingCount } = await ingestDataset(inbox, sink);
    console.log(JSON.stringify({ mode: "dry-run", emailCount, attachmentCount, missingCount,
      databaseVerified: false, message: "Source validated only. No cloud writes or AI calls." }, null, 2));
    return;
  }
  const db = createAdminClient();
  const total = (await inbox.emails()).length;
  const report = (stage: string, done: number, count: number) => {
    if (done === 1 || done % 10 === 0 || done === count) console.log(`${stage}: ${done}/${count} emails`);
  };
  if (!values["verify-only"]) {
    console.log(`Starting import of ${total} emails. Progress prints every 10 emails; requests time out after 5 minutes.`);
    const store = new SupabaseIngestStore(db);
    let imported = 0;
    const reportingStore: IngestStore = {
      email: row => store.email(row),
      attachment: (row, bytes) => store.attachment(row, bytes),
      async audit(emailId, detail) {
        await store.audit(emailId, detail);
        report("Imported", ++imported, total);
      },
    };
    const result = await ingestDataset(inbox, reportingStore);
    console.log(`Imported ${result.emailCount} emails and ${result.attachmentCount} attachment references.`);
  }
  console.log("Verifying database rows and downloading attachments to check their hashes...");
  console.log(JSON.stringify({ mode: "cloud-verification", ...await verifySupabaseSeed(db, inbox,
    (done, count) => report("Verified", done, count)) }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Seed failed."); process.exitCode = 1; });
