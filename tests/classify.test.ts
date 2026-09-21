import assert from "node:assert/strict";
import test from "node:test";
import { classifyByRule, newestMessage } from "../lib/pipeline/classify";

test("uses only the newest message, excluding quoted billing history", () => {
  const body =
    "Please send a packing list.\n\nRegards,\nA\n\nFrom: B\nSent: today\nInvoice and THC query";
  assert.equal(newestMessage(body), "Please send a packing list.");
  assert.equal(
    classifyByRule({ body, attachmentFilenames: [] }).category,
    "GENERAL",
  );
});

test("classifies a comparison only when both document attachments and request exist", () => {
  const result = classifyByRule({
    body: "Please check and confirm the documents.",
    attachmentFilenames: ["attachments/a_SI.txt", "attachments/a_BL.txt"],
  });
  assert.equal(result.category, "BL_COMPARISON");
  assert.ok(result.confidence >= 0.75);
});

test("keeps bare SI and BL language out of comparison", () => {
  assert.equal(
    classifyByRule({
      body: "The SI and BL were mentioned in yesterday's call.",
      attachmentFilenames: [],
    }).category,
    "GENERAL",
  );
});

test("classifies invoice, SI request, and spam deterministically", () => {
  assert.equal(
    classifyByRule({
      body: "Is the THC charge on invoice 123 included?",
      attachmentFilenames: [],
    }).category,
    "INVOICE_QUERY",
  );
  assert.equal(
    classifyByRule({
      body: "Please prepare an SI with POL, POD and consignee.",
      attachmentFilenames: ["attachments/instruction.txt"],
    }).category,
    "SI_REQUEST",
  );
  assert.equal(
    classifyByRule({
      body: "You won a prize! Click here to claim it.",
      attachmentFilenames: [],
    }).category,
    "SPAM",
  );
});

test("does not treat an SI document-list mention of invoice as an invoice query", () => {
  const body =
    "Please find Shipping instruction. POL: Port Klang. POD: Busan. Documents Required: 3 Original invoice.";
  assert.equal(
    classifyByRule({ body, attachmentFilenames: [] }).category,
    "SI_REQUEST",
  );
});
