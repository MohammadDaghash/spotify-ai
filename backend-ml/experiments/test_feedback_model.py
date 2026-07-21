import json
import math
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services.feedback_model import apply_feedback_model_blend


def test_feedback_model_blends_probability_with_heuristic_score():
    with TemporaryDirectory() as temp_dir:
        model_path = Path(temp_dir) / "model.json"
        model_path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "feature_columns": ["feedback_model_score"],
                    "weights": [1.0],
                    "bias": 0.0,
                    "means": [0.0],
                    "standard_deviations": [1.0],
                }
            ),
            encoding="utf-8",
        )
        rows = pd.DataFrame(
            [
                {
                    "final_score": 0.2,
                    "feedback_model_score": 0.9,
                }
            ]
        )

        scored_rows = apply_feedback_model_blend(
            rows,
            model_path=model_path,
            blend_weight=0.5,
        )

    expected_probability = 1 / (1 + math.exp(-0.9))
    expected_score = 0.2 * 0.5 + expected_probability * 0.5

    assert round(scored_rows.iloc[0]["ml_like_probability"], 6) == round(
        expected_probability,
        6,
    )
    assert round(scored_rows.iloc[0]["final_score"], 6) == round(
        expected_score,
        6,
    )
    assert scored_rows.iloc[0]["heuristic_score"] == 0.2
    assert scored_rows.iloc[0]["ml_model_weight"] == 0.5


def test_missing_feedback_model_keeps_heuristic_score():
    rows = pd.DataFrame([{"final_score": 0.42}])

    scored_rows = apply_feedback_model_blend(
        rows,
        model_path="/tmp/spotify-ai-missing-model.json",
    )

    assert scored_rows.iloc[0]["final_score"] == 0.42
    assert scored_rows.iloc[0]["heuristic_score"] == 0.42
    assert scored_rows.iloc[0]["ml_model_weight"] == 0.0
    assert pd.isna(scored_rows.iloc[0]["ml_like_probability"])


if __name__ == "__main__":
    test_feedback_model_blends_probability_with_heuristic_score()
    test_missing_feedback_model_keeps_heuristic_score()
    print("Feedback model tests passed")
