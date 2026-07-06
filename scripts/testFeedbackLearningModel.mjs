import assert from "node:assert/strict";

import {
  buildFeedbackLearningDataset,
  trainFeedbackLogisticBaseline,
} from "../src/utils/feedbackLearningModel.js";

const events = [
  {
    id: "evt_like_1",
    action: "like",
    label: "positive",
    item_type: "song",
    score: 0.88,
    relative_match: 93,
    reason: "Strong match",
    mode: "private-user",
    source: "recommendations",
  },
  {
    id: "evt_save_1",
    action: "save",
    label: "positive",
    item_type: "song",
    score: 0.8,
    relative_match: 86,
    reason: "Good match",
    mode: "private-user",
    source: "recommendations",
  },
  {
    id: "evt_playlist_1",
    action: "create_playlist",
    label: "positive",
    item_type: "group_playlist",
    score: 0.76,
    relative_match: 75,
    mode: "admin-demo",
    source: "group-mix",
  },
  {
    id: "evt_ignore_1",
    action: "ignore",
    label: "negative",
    item_type: "artist",
    score: 0.31,
    relative_match: 38,
    mode: "public-demo",
    source: "recommendations",
  },
  {
    id: "evt_ignore_2",
    action: "ignore",
    label: "negative",
    item_type: "song",
    score: 0.22,
    relative_match: 25,
    mode: "public-demo",
    source: "recommendations",
  },
  {
    id: "evt_ignore_3",
    action: "ignore",
    label: "negative",
    item_type: "artist",
    score: 0.18,
    relative_match: 18,
    mode: "public-demo",
    source: "recommendations",
  },
  {
    id: "evt_open_1",
    action: "open_spotify",
    label: "neutral",
    item_type: "song",
    score: 0.9,
    relative_match: 95,
    mode: "public-demo",
    source: "recommendations",
  },
];

const dataset = buildFeedbackLearningDataset(events);

assert.equal(dataset.rows.length, 6);
assert.equal(dataset.positiveLabels, 3);
assert.equal(dataset.negativeLabels, 3);
assert.equal(dataset.neutralSignals, 1);
assert.deepEqual(dataset.featureNames, [
  "score",
  "relative_match",
  "is_song",
  "is_artist",
  "is_group_playlist",
  "has_reason",
  "is_private_mode",
  "is_public_demo",
]);
assert.equal(dataset.rows[0].label, 1);
assert.equal(dataset.rows[3].label, 0);

const trained = trainFeedbackLogisticBaseline(events, {
  iterations: 900,
  learningRate: 0.25,
});

assert.equal(trained.status, "trained");
assert.equal(trained.trainingRows, 6);
assert.equal(trained.positiveLabels, 3);
assert.equal(trained.negativeLabels, 3);
assert.equal(trained.neutralSignals, 1);
assert.equal(trained.featureCount, 8);
assert.equal(Number.isFinite(trained.logLoss), true);
assert.equal(trained.logLoss < 0.7, true);
assert.equal(trained.accuracy >= 0.8, true);
assert.equal(trained.coefficients.some((row) => row.feature === "score"), true);
assert.equal(
  trained.coefficients.some((row) => row.feature === "relative_match"),
  true,
);
assert.equal(
  trained.formula,
  "p_like = sigmoid(dot(w, scaled_features) + b)",
);

const insufficient = trainFeedbackLogisticBaseline(events.slice(0, 3));

assert.equal(insufficient.status, "needs_data");
assert.equal(insufficient.trainingRows, 3);
assert.equal(insufficient.positiveLabels, 3);
assert.equal(insufficient.negativeLabels, 0);
assert.match(insufficient.reason, /positive and negative/);

console.log("Feedback learning model tests passed");
