import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loginSource = readFileSync("src/pages/Login.jsx", "utf8");
const recommendationsSource = readFileSync("src/pages/Recommendations.jsx", "utf8");
const tripSource = readFileSync("src/pages/Trip.jsx", "utf8");

assert.match(
  loginSource,
  /Personal account/,
  "Use Your Data page should include a personal account section.",
);
assert.match(
  loginSource,
  /signInUser/,
  "Use Your Data page should call user sign-in.",
);
assert.match(
  loginSource,
  /signUpUser/,
  "Use Your Data page should call user sign-up.",
);
assert.match(
  loginSource,
  /VITE_SUPABASE_URL/,
  "Use Your Data page should explain missing Supabase setup.",
);
assert.match(
  recommendationsSource,
  /syncUserFeedbackEvent/,
  "Recommendation feedback should sync to the authenticated user's private store.",
);
assert.match(
  recommendationsSource,
  /useActiveRecommendationFeedback/,
  "Recommendations should read authenticated private feedback.",
);
assert.match(
  recommendationsSource,
  /applyFeedbackPreferenceReranking/,
  "Recommendations should use private feedback to rerank candidates.",
);
assert.match(
  tripSource,
  /syncUserFeedbackEvent/,
  "Group Mix playlist feedback should sync to the authenticated user's private store.",
);
assert.match(
  tripSource,
  /useActiveRecommendationFeedback/,
  "Group Mix should read authenticated private feedback.",
);
assert.match(
  tripSource,
  /getFeedbackArtistPreferenceLists/,
  "Group Mix should turn private feedback into liked and ignored artist inputs.",
);

console.log("User account UI tests passed");
