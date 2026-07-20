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
  /fetchUserFeedbackEvents/,
  "Model page should fetch private Supabase user feedback events.",
);

assert.match(
  modelSource,
  /USER_SESSION_CHANGED_EVENT/,
  "Model page should refresh feedback when the personal user session changes.",
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
  /Public demo feedback/,
  "Model page should show the public demo feedback source.",
);

assert.match(
  modelSource,
  /Private user feedback/,
  "Model page should show the private user feedback source.",
);

assert.match(
  modelSource,
  /Baseline training source/,
  "Model page should explain which feedback source trains the baseline.",
);

assert.match(
  modelSource,
  /active source/i,
  "Model page should show the active feedback source.",
);

assert.match(
  modelSource,
  /trainFeedbackLogisticBaseline/,
  "Model page should train the feedback logistic baseline from the active feedback source.",
);

assert.match(
  modelSource,
  /Logistic regression baseline/,
  "Model page should show the supervised logistic regression baseline.",
);

assert.match(
  modelSource,
  /sigmoid/,
  "Model page should explain the sigmoid probability formula.",
);

assert.match(
  modelSource,
  /gradient descent/,
  "Model page should name the gradient descent training method.",
);

console.log("Model page feedback tests passed");
