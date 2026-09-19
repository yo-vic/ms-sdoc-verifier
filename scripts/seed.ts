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
  if (!values["verify-only"]) {
    const result = await ingestDataset(inbox, new SupabaseIngestStore(db));
    console.log(`Imported ${result.emailCount} emails and ${result.attachmentCount} attachment references.`);
  }
  console.log(JSON.stringify({ mode: "cloud-verification", ...await verifySupabaseSeed(db, inbox) }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Seed failed."); process.exitCode = 1; });
