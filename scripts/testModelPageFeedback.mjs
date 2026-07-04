import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const modelSource = readFileSync("src/pages/Model.jsx", "utf8");

assert.match(
  modelSource,
  /fetchServerFeedbackEvents/,
  "Model page should fetch durable server feedback events.",
);

assert.match(
  modelSource,
  /buildModelFeedbackSummary/,
  "Model page should use the shared feedback summary utility.",
);

assert.match(
  modelSource,
  /Feedback training dataset/,
  "Model page should expose a feedback training dataset section.",
);

assert.match(
  modelSource,
  /Recent training signals/,
  "Model page should show recent safe feedback events.",
);

assert.match(
  modelSource,
  /Server feedback/,
  "Model page should label durable server-side feedback clearly.",
);

assert.match(
  modelSource,
  /storage mode/i,
  "Model page should show the feedback storage mode.",
);

console.log("Model page feedback tests passed");
