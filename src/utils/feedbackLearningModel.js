const POSITIVE_ACTIONS = new Set(["like", "save", "create_playlist"]);
const NEGATIVE_ACTIONS = new Set(["ignore"]);

export const FEEDBACK_MODEL_FEATURES = [
  "score",
  "relative_match",
  "is_song",
  "is_artist",
  "is_group_playlist",
  "has_reason",
  "is_private_mode",
  "is_public_demo",
];

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function normalizeRelativeMatch(value) {
  const number = safeNumber(value);

  return number > 1 ? number / 100 : number;
}

function getFeedbackLabel(event = {}) {
  const action = String(event.action || "").toLowerCase();

  if (POSITIVE_ACTIONS.has(action) || event.label === "positive") return 1;
  if (NEGATIVE_ACTIONS.has(action) || event.label === "negative") return 0;

  return null;
}

function buildFeatureVector(event = {}) {
  const itemType = String(event.item_type || "").toLowerCase();
  const mode = String(event.mode || "").toLowerCase();
  const reason = String(event.reason || "").trim();

  return [
    safeNumber(event.score),
    normalizeRelativeMatch(event.relative_match ?? event.relativeMatch),
    itemType === "song" ? 1 : 0,
    itemType === "artist" ? 1 : 0,
    itemType === "group_playlist" ? 1 : 0,
    reason ? 1 : 0,
    mode === "private-user" ? 1 : 0,
    mode === "public-demo" ? 1 : 0,
  ];
}

function sigmoid(value) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }

  const z = Math.exp(value);
  return z / (1 + z);
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function standardizeMatrix(matrix) {
  if (matrix.length === 0) {
    return {
      matrix: [],
      means: [],
      standardDeviations: [],
    };
  }

  const featureCount = matrix[0].length;
  const means = Array.from({ length: featureCount }, (_, featureIndex) => {
    const total = matrix.reduce((sum, row) => sum + row[featureIndex], 0);
    return total / matrix.length;
  });
  const standardDeviations = means.map((mean, featureIndex) => {
    const variance =
      matrix.reduce((sum, row) => {
        const difference = row[featureIndex] - mean;
        return sum + difference * difference;
      }, 0) / matrix.length;
    const standardDeviation = Math.sqrt(variance);

    return standardDeviation > 0 ? standardDeviation : 1;
  });

  return {
    matrix: matrix.map((row) =>
      row.map((value, index) => (value - means[index]) / standardDeviations[index]),
    ),
    means,
    standardDeviations,
  };
}

function calculateLogLoss(labels, predictions) {
  const epsilon = 1e-9;
  const totalLoss = labels.reduce((sum, label, index) => {
    const prediction = Math.min(Math.max(predictions[index], epsilon), 1 - epsilon);
    return sum - (label * Math.log(prediction) + (1 - label) * Math.log(1 - prediction));
  }, 0);

  return totalLoss / labels.length;
}

export function buildFeedbackLearningDataset(events = []) {
  const rows = [];
  let positiveLabels = 0;
  let negativeLabels = 0;
  let neutralSignals = 0;

  for (const event of events) {
    const label = getFeedbackLabel(event);

    if (label === null) {
      neutralSignals += 1;
      continue;
    }

    if (label === 1) {
      positiveLabels += 1;
    } else {
      negativeLabels += 1;
    }

    rows.push({
      id: event.id || `${event.timestamp}-${event.action}-${event.item_name}`,
      label,
      features: buildFeatureVector(event),
      event,
    });
  }

  return {
    rows,
    featureNames: FEEDBACK_MODEL_FEATURES,
    positiveLabels,
    negativeLabels,
    neutralSignals,
  };
}

export function trainFeedbackLogisticBaseline(
  events = [],
  {
    iterations = 700,
    learningRate = 0.18,
    minPositiveLabels = 2,
    minNegativeLabels = 2,
  } = {},
) {
  const dataset = buildFeedbackLearningDataset(events);
  const trainingRows = dataset.rows.length;
  const baseResult = {
    status: "needs_data",
    reason:
      "Need at least two positive and negative feedback labels before training.",
    trainingRows,
    positiveLabels: dataset.positiveLabels,
    negativeLabels: dataset.negativeLabels,
    neutralSignals: dataset.neutralSignals,
    featureCount: dataset.featureNames.length,
    formula: "p_like = sigmoid(dot(w, scaled_features) + b)",
    accuracy: null,
    logLoss: null,
    averagePredictedLikeProbability: null,
    coefficients: [],
  };

  if (
    dataset.positiveLabels < minPositiveLabels ||
    dataset.negativeLabels < minNegativeLabels
  ) {
    return baseResult;
  }

  const labels = dataset.rows.map((row) => row.label);
  const rawMatrix = dataset.rows.map((row) => row.features);
  const { matrix } = standardizeMatrix(rawMatrix);
  const weights = Array.from({ length: dataset.featureNames.length }, () => 0);
  let bias = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const predictions = matrix.map((row) => sigmoid(dot(row, weights) + bias));
    const gradientWeights = weights.map((_, featureIndex) => {
      const totalGradient = matrix.reduce(
        (sum, row, rowIndex) =>
          sum + (predictions[rowIndex] - labels[rowIndex]) * row[featureIndex],
        0,
      );

      return totalGradient / matrix.length;
    });
    const gradientBias =
      predictions.reduce(
        (sum, prediction, index) => sum + prediction - labels[index],
        0,
      ) / matrix.length;

    for (let featureIndex = 0; featureIndex < weights.length; featureIndex += 1) {
      weights[featureIndex] -= learningRate * gradientWeights[featureIndex];
    }

    bias -= learningRate * gradientBias;
  }

  const predictions = matrix.map((row) => sigmoid(dot(row, weights) + bias));
  const correct = predictions.filter((prediction, index) => {
    return (prediction >= 0.5 ? 1 : 0) === labels[index];
  }).length;
  const coefficients = dataset.featureNames
    .map((feature, index) => ({
      feature,
      weight: Number(weights[index].toFixed(4)),
      direction: weights[index] >= 0 ? "positive" : "negative",
    }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));

  return {
    ...baseResult,
    status: "trained",
    reason: "",
    accuracy: Number((correct / labels.length).toFixed(3)),
    logLoss: Number(calculateLogLoss(labels, predictions).toFixed(4)),
    averagePredictedLikeProbability: Number(
      (
        predictions.reduce((sum, prediction) => sum + prediction, 0) /
        predictions.length
      ).toFixed(3),
    ),
    coefficients,
  };
}
