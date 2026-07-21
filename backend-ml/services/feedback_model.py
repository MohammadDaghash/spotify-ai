from pathlib import Path
import json

import numpy as np
import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = BACKEND_DIR / "models" / "feedback_logistic_regression.json"
DEFAULT_TRACK_MODEL_BLEND_WEIGHT = 0.3


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-np.clip(values, -500, 500)))


def load_feedback_model(model_path: str | Path = DEFAULT_MODEL_PATH) -> dict | None:
    path = Path(model_path)

    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as file:
        model = json.load(file)

    required_fields = ["feature_columns", "weights", "bias", "means", "standard_deviations"]
    if any(field not in model for field in required_fields):
        return None

    feature_count = len(model["feature_columns"])
    vector_fields = ["weights", "means", "standard_deviations"]
    if any(len(model[field]) != feature_count for field in vector_fields):
        return None

    return model


def prepare_feedback_model_features(
    rows: pd.DataFrame,
    feature_columns: list[str],
) -> pd.DataFrame:
    frame = rows.copy()

    def numeric_series(column: str, default: float = 0.0) -> pd.Series:
        if column not in frame.columns:
            return pd.Series(default, index=frame.index)

        return pd.to_numeric(frame[column], errors="coerce").fillna(default)

    if "track_play_count" not in frame.columns and "streams" in frame.columns:
        frame["track_play_count"] = frame["streams"]

    if "artist_stream_count" not in frame.columns and "artist_name" in frame.columns:
        frame["artist_stream_count"] = frame.groupby("artist_name")[
            "streams"
        ].transform("sum")

    if "log_track_play_count" not in frame.columns:
        frame["log_track_play_count"] = np.log1p(
            numeric_series("track_play_count").clip(lower=0)
        )

    if "log_artist_stream_count" not in frame.columns:
        frame["log_artist_stream_count"] = np.log1p(
            numeric_series("artist_stream_count").clip(lower=0)
        )

    if "feedback_relative_match_scaled" not in frame.columns:
        if "feedback_relative_match" in frame.columns:
            frame["feedback_relative_match_scaled"] = (
                frame["feedback_relative_match"].fillna(0).clip(lower=0, upper=100)
                / 100
            )
        else:
            frame["feedback_relative_match_scaled"] = numeric_series(
                "feedback_model_score",
            )

    for column in feature_columns:
        if column not in frame.columns:
            frame[column] = 0.0

        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0.0)

    return frame[feature_columns]


def predict_feedback_like_probability(
    rows: pd.DataFrame,
    model: dict | None = None,
    model_path: str | Path = DEFAULT_MODEL_PATH,
) -> np.ndarray | None:
    loaded_model = model or load_feedback_model(model_path)

    if loaded_model is None or rows.empty:
        return None

    feature_columns = loaded_model["feature_columns"]
    features = prepare_feedback_model_features(rows, feature_columns)
    means = np.asarray(loaded_model["means"], dtype=float)
    standard_deviations = np.asarray(loaded_model["standard_deviations"], dtype=float)
    standard_deviations[standard_deviations == 0] = 1
    weights = np.asarray(loaded_model["weights"], dtype=float)
    bias = float(loaded_model["bias"])
    scaled_features = (features.to_numpy(dtype=float) - means) / standard_deviations

    return sigmoid(scaled_features @ weights + bias)


def apply_feedback_model_blend(
    rows: pd.DataFrame,
    score_column: str = "final_score",
    model_path: str | Path = DEFAULT_MODEL_PATH,
    blend_weight: float = DEFAULT_TRACK_MODEL_BLEND_WEIGHT,
) -> pd.DataFrame:
    results = rows.copy()
    results["heuristic_score"] = results[score_column]
    results["ml_like_probability"] = np.nan
    results["ml_model_weight"] = 0.0
    results["ml_model_version"] = ""

    model = load_feedback_model(model_path)
    probabilities = predict_feedback_like_probability(results, model=model)

    if model is None or probabilities is None:
        return results

    safe_weight = float(np.clip(blend_weight, 0, 1))
    results["ml_like_probability"] = probabilities
    results["ml_model_weight"] = safe_weight
    results["ml_model_version"] = str(model.get("version", ""))
    results[score_column] = np.clip(
        results[score_column] * (1 - safe_weight) + probabilities * safe_weight,
        0,
        1,
    )

    return results
