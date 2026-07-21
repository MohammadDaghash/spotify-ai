from pathlib import Path
import argparse
import json
import math
import ssl
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import train_test_split


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services.feedback_dataset import (
    FEEDBACK_SIGNAL_COLUMNS,
    build_real_feedback_training_frame,
)
from services.feedback_model import DEFAULT_MODEL_PATH
from services.recommender import build_track_features
from services.spotify_parser import load_combined_spotify_history


FEATURE_COLUMNS = [
    "log_streams",
    "log_total_minutes",
    "log_active_days",
    "avg_minutes_per_stream",
    "skip_rate",
    "log_listen_strength",
    "log_recent_listen_strength",
    "recency_score",
    "completion_signal",
    "log_track_play_count",
    "log_artist_stream_count",
    "feedback_model_score",
    "feedback_relative_match_scaled",
    "feedback_similarity_score",
    "feedback_quality_score",
    "feedback_confidence",
    "feedback_recency_score",
    "feedback_known_track_penalty",
    "feedback_diversity_penalty",
    "feedback_score_delta",
    "feedback_is_catalog_backfill",
]


def sigmoid(z: np.ndarray) -> np.ndarray:
    z = np.clip(z, -500, 500)
    return 1 / (1 + np.exp(-z))


def compute_logistic_cost(
    x_matrix: np.ndarray,
    y_vector: np.ndarray,
    weights: np.ndarray,
    bias: float,
    regularization_lambda: float,
    sample_weights: np.ndarray | None = None,
) -> float:
    sample_count = y_vector.shape[0]
    sample_weights = normalize_sample_weights(sample_weights, sample_count)
    predictions = sigmoid(x_matrix @ weights + bias)
    epsilon = 1e-9
    predictions = np.clip(predictions, epsilon, 1 - epsilon)
    row_losses = -(
        y_vector * np.log(predictions)
        + (1 - y_vector) * np.log(1 - predictions)
    )
    data_loss = np.average(row_losses, weights=sample_weights)
    regularization_loss = (
        regularization_lambda / (2 * sample_count)
    ) * np.sum(weights ** 2)

    return float(data_loss + regularization_loss)


def compute_gradient(
    x_matrix: np.ndarray,
    y_vector: np.ndarray,
    weights: np.ndarray,
    bias: float,
    regularization_lambda: float,
    sample_weights: np.ndarray | None = None,
) -> tuple[np.ndarray, float]:
    sample_count = y_vector.shape[0]
    sample_weights = normalize_sample_weights(sample_weights, sample_count)
    errors = sigmoid(x_matrix @ weights + bias) - y_vector
    weighted_errors = errors * sample_weights
    weight_gradient = (x_matrix.T @ weighted_errors) / sample_weights.sum()
    weight_gradient += (regularization_lambda / sample_weights.sum()) * weights
    bias_gradient = weighted_errors.sum() / sample_weights.sum()

    return weight_gradient, float(bias_gradient)


def run_gradient_descent(
    x_matrix: np.ndarray,
    y_vector: np.ndarray,
    sample_weights: np.ndarray | None = None,
    learning_rate: float = 0.08,
    iterations: int = 1_200,
    regularization_lambda: float = 0.05,
) -> tuple[np.ndarray, float, list[float]]:
    weights = np.zeros(x_matrix.shape[1])
    bias = 0.0
    cost_history = []
    sample_weights = normalize_sample_weights(sample_weights, y_vector.shape[0])

    for iteration in range(iterations):
        weight_gradient, bias_gradient = compute_gradient(
            x_matrix,
            y_vector,
            weights,
            bias,
            regularization_lambda,
            sample_weights,
        )
        weights -= learning_rate * weight_gradient
        bias -= learning_rate * bias_gradient

        if iteration % 100 == 0 or iteration == iterations - 1:
            cost_history.append(
                compute_logistic_cost(
                    x_matrix,
                    y_vector,
                    weights,
                    bias,
                    regularization_lambda,
                    sample_weights,
                )
            )

    return weights, bias, cost_history


def normalize_sample_weights(
    sample_weights: np.ndarray | None,
    sample_count: int,
) -> np.ndarray:
    if sample_weights is None:
        return np.ones(sample_count)

    weights = np.asarray(sample_weights, dtype=float)

    if weights.shape[0] != sample_count:
        raise ValueError("sample_weights length must match the number of rows.")

    weights = np.nan_to_num(weights, nan=1.0, posinf=1.0, neginf=1.0)
    weights = np.clip(weights, 0.001, None)
    mean_weight = weights.mean()

    if mean_weight <= 0:
        return np.ones(sample_count)

    return weights / mean_weight


def standardize_train_test(
    x_train: np.ndarray,
    x_test: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    means = x_train.mean(axis=0)
    standard_deviations = x_train.std(axis=0)
    standard_deviations[standard_deviations == 0] = 1

    return (
        (x_train - means) / standard_deviations,
        (x_test - means) / standard_deviations,
        means,
        standard_deviations,
    )


def add_proxy_feedback_labels(track_features: pd.DataFrame) -> pd.DataFrame:
    labeled_tracks = track_features.copy()
    listen_strength_high = labeled_tracks["listen_strength"].quantile(0.65)
    listen_strength_low = labeled_tracks["listen_strength"].quantile(0.35)
    recent_strength_high = labeled_tracks["recent_listen_strength"].quantile(0.75)

    positive_mask = (
        (
            (labeled_tracks["listen_strength"] >= listen_strength_high)
            & (labeled_tracks["skip_rate"] <= 0.45)
        )
        | (
            (labeled_tracks["recent_listen_strength"] >= recent_strength_high)
            & (labeled_tracks["skip_rate"] <= 0.55)
        )
    )
    negative_mask = (
        (
            (labeled_tracks["listen_strength"] <= listen_strength_low)
            & (labeled_tracks["skip_rate"] >= 0.55)
        )
        | (
            (labeled_tracks["streams"] <= 2)
            & (labeled_tracks["avg_minutes_per_stream"] < 0.75)
        )
    )

    labeled_tracks["liked_label"] = np.nan
    labeled_tracks.loc[positive_mask, "liked_label"] = 1
    labeled_tracks.loc[negative_mask, "liked_label"] = 0

    return labeled_tracks.dropna(subset=["liked_label"]).copy()


def _training_row_key(frame: pd.DataFrame) -> pd.Series:
    return (
        frame["track_name"].fillna("").astype(str).str.strip().str.casefold()
        + "::"
        + frame["artist_name"].fillna("").astype(str).str.strip().str.casefold()
        + "::"
        + frame["album_name"].fillna("").astype(str).str.strip().str.casefold()
    )


def build_hybrid_feedback_frame(
    track_features: pd.DataFrame,
    feedback_path: str,
    include_artist_feedback: bool = True,
) -> pd.DataFrame:
    proxy_tracks = add_proxy_feedback_labels(track_features)

    if not proxy_tracks.empty:
        proxy_tracks["label_source"] = "proxy_listening_behavior"

    try:
        real_tracks = build_real_feedback_training_frame(
            track_features,
            feedback_path=feedback_path,
            include_artist_feedback=include_artist_feedback,
        )
    except FileNotFoundError:
        real_tracks = track_features.iloc[0:0].copy()

    if real_tracks.empty:
        return proxy_tracks

    real_tracks = real_tracks.copy()
    real_tracks["_training_row_key"] = _training_row_key(real_tracks)

    if proxy_tracks.empty:
        return real_tracks.drop(columns="_training_row_key")

    proxy_tracks = proxy_tracks.copy()
    proxy_tracks["_training_row_key"] = _training_row_key(proxy_tracks)
    real_row_keys = set(real_tracks["_training_row_key"])
    proxy_tracks = proxy_tracks[
        ~proxy_tracks["_training_row_key"].isin(real_row_keys)
    ]

    return (
        pd.concat([proxy_tracks, real_tracks], ignore_index=True)
        .drop(columns="_training_row_key")
        .reset_index(drop=True)
    )


def add_knownness_features(track_features: pd.DataFrame) -> pd.DataFrame:
    features = track_features.copy()
    if "track_play_count" not in features.columns:
        features["track_play_count"] = features["streams"]

    if "artist_stream_count" not in features.columns:
        features["artist_stream_count"] = features.groupby("artist_name")[
            "streams"
        ].transform("sum")

    features["log_track_play_count"] = np.log1p(
        features["track_play_count"].fillna(0).clip(lower=0)
    )
    features["log_artist_stream_count"] = np.log1p(
        features["artist_stream_count"].fillna(0).clip(lower=0)
    )

    return features


def finalize_training_features(training_frame: pd.DataFrame) -> pd.DataFrame:
    frame = add_knownness_features(training_frame)

    for column in FEEDBACK_SIGNAL_COLUMNS:
        if column not in frame.columns:
            frame[column] = 0.0

        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)

    frame["feedback_relative_match_scaled"] = (
        frame["feedback_relative_match"].clip(lower=0, upper=100) / 100
    )
    if "recommendation_source" not in frame.columns:
        frame["recommendation_source"] = ""
    else:
        frame["recommendation_source"] = frame["recommendation_source"].fillna("")
    frame["is_song_feedback_label"] = (frame["label_source"] == "song_feedback").astype(
        int
    )
    frame["is_artist_feedback_label"] = (
        frame["label_source"] == "artist_feedback"
    ).astype(int)
    frame["is_proxy_label"] = (
        frame["label_source"] == "proxy_listening_behavior"
    ).astype(int)

    return frame


def add_training_sample_weights(
    training_frame: pd.DataFrame,
    real_feedback_weight: float = 5.0,
    proxy_weight: float = 1.0,
) -> pd.DataFrame:
    frame = training_frame.copy()
    real_sources = {"song_feedback", "artist_feedback"}

    frame["sample_weight"] = np.where(
        frame["label_source"].isin(real_sources),
        real_feedback_weight,
        proxy_weight,
    )
    frame["sample_weight"] = pd.to_numeric(
        frame["sample_weight"],
        errors="coerce",
    ).fillna(proxy_weight)

    return frame


def validate_training_labels(training_frame: pd.DataFrame) -> None:
    label_counts = training_frame["liked_label"].value_counts().to_dict()

    if len(label_counts) < 2:
        raise ValueError(
            "Need both positive and negative labels for training. "
            f"Current labels: {label_counts}."
        )

    minimum_class_count = min(label_counts.values())

    if minimum_class_count < 2:
        raise ValueError(
            "Need at least two examples in each class for train/test split. "
            f"Current labels: {label_counts}."
        )


def normalize_feedback_source_url(source_url: str) -> str:
    clean_url = str(source_url or "").strip()

    if not clean_url:
        raise ValueError("Feedback source URL cannot be empty.")

    return clean_url.rstrip("/")


def build_feedback_export_url(source_url: str, limit: int = 1000) -> str:
    safe_limit = max(1, min(int(limit or 1000), 1000))

    return f"{normalize_feedback_source_url(source_url)}/api/feedback/events?limit={safe_limit}"


def get_https_context() -> ssl.SSLContext:
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()

    return ssl.create_default_context(cafile=certifi.where())


def export_feedback_events_for_training(
    source_url: str,
    feedback_path: str,
    limit: int = 1000,
) -> dict:
    export_url = build_feedback_export_url(source_url, limit=limit)
    request = Request(export_url, headers={"Accept": "application/json"})

    try:
        with urlopen(request, timeout=20, context=get_https_context()) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise ValueError(f"Feedback export failed with HTTP {error.code}.") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ValueError(f"Feedback export failed: {error}.") from error

    if not isinstance(payload.get("events"), list):
        raise ValueError("Feedback API response did not include an events array.")

    output_payload = {
        "version": 1,
        "exported_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "source_url": normalize_feedback_source_url(source_url),
        "status": payload.get("status", {}),
        "storage_mode": payload.get("storage_mode", "unknown"),
        "events": payload["events"],
    }
    output_path = Path(feedback_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output_payload, indent=2) + "\n", encoding="utf-8")

    return {
        "event_count": len(output_payload["events"]),
        "output_path": str(output_path),
        "source_url": export_url,
        "storage_mode": output_payload["storage_mode"],
    }


def build_training_frame(
    data_path: str,
    label_source: str = "proxy",
    feedback_path: str = "data/feedback/events.json",
    include_artist_feedback: bool = True,
    real_feedback_weight: float = 5.0,
    proxy_weight: float = 1.0,
) -> pd.DataFrame:
    history = load_combined_spotify_history(data_path)
    track_features = add_knownness_features(build_track_features(history))

    if label_source == "proxy":
        labeled_tracks = add_proxy_feedback_labels(track_features)
        labeled_tracks["label_source"] = "proxy_listening_behavior"
    elif label_source == "feedback":
        labeled_tracks = build_real_feedback_training_frame(
            track_features,
            feedback_path=feedback_path,
            include_artist_feedback=include_artist_feedback,
        )
    elif label_source == "hybrid":
        labeled_tracks = build_hybrid_feedback_frame(
            track_features,
            feedback_path=feedback_path,
            include_artist_feedback=include_artist_feedback,
        )
    else:
        raise ValueError("label_source must be 'proxy', 'feedback', or 'hybrid'.")

    if labeled_tracks.empty:
        raise ValueError(
            "No labelable training rows were found. "
            "For real labels, export feedback events first."
        )

    labeled_tracks = finalize_training_features(labeled_tracks)
    labeled_tracks = add_training_sample_weights(
        labeled_tracks,
        real_feedback_weight=real_feedback_weight,
        proxy_weight=proxy_weight,
    )
    validate_training_labels(labeled_tracks)

    return labeled_tracks


def predict_probability(x_matrix: np.ndarray, weights: np.ndarray, bias: float):
    return sigmoid(x_matrix @ weights + bias)


def summarize_coefficients(weights: np.ndarray) -> pd.DataFrame:
    return (
        pd.DataFrame(
            {
                "feature": FEATURE_COLUMNS,
                "weight": weights,
                "direction": np.where(weights >= 0, "pushes like", "pushes ignore"),
            }
        )
        .assign(abs_weight=lambda frame: frame["weight"].abs())
        .sort_values("abs_weight", ascending=False)
        .drop(columns="abs_weight")
        .reset_index(drop=True)
    )


def run_feedback_logistic_regression(
    data_path: str = "data/private",
    label_source: str = "proxy",
    feedback_path: str = "data/feedback/events.json",
    include_artist_feedback: bool = True,
    real_feedback_weight: float = 5.0,
    proxy_weight: float = 1.0,
    learning_rate: float = 0.08,
    iterations: int = 1_200,
    regularization_lambda: float = 0.05,
    random_state: int = 42,
) -> dict:
    training_frame = build_training_frame(
        data_path=data_path,
        label_source=label_source,
        feedback_path=feedback_path,
        include_artist_feedback=include_artist_feedback,
        real_feedback_weight=real_feedback_weight,
        proxy_weight=proxy_weight,
    )
    x_matrix = training_frame[FEATURE_COLUMNS].to_numpy(dtype=float)
    y_vector = training_frame["liked_label"].to_numpy(dtype=float)
    sample_weights = training_frame["sample_weight"].to_numpy(dtype=float)
    test_size = max(2, math.ceil(len(training_frame) * 0.25))

    (
        x_train,
        x_test,
        y_train,
        y_test,
        train_sample_weights,
        test_sample_weights,
        train_rows,
        test_rows,
    ) = train_test_split(
        x_matrix,
        y_vector,
        sample_weights,
        training_frame,
        test_size=test_size,
        random_state=random_state,
        stratify=y_vector,
    )
    train_sample_weights = normalize_sample_weights(
        train_sample_weights,
        len(train_sample_weights),
    )
    test_sample_weights = normalize_sample_weights(
        test_sample_weights,
        len(test_sample_weights),
    )
    x_train_scaled, x_test_scaled, means, standard_deviations = standardize_train_test(
        x_train,
        x_test,
    )
    weights, bias, cost_history = run_gradient_descent(
        x_train_scaled,
        y_train,
        sample_weights=train_sample_weights,
        learning_rate=learning_rate,
        iterations=iterations,
        regularization_lambda=regularization_lambda,
    )

    train_probabilities = predict_probability(x_train_scaled, weights, bias)
    test_probabilities = predict_probability(x_test_scaled, weights, bias)
    train_predictions = (train_probabilities >= 0.5).astype(int)
    test_predictions = (test_probabilities >= 0.5).astype(int)

    sklearn_model = LogisticRegression(max_iter=1_000, random_state=random_state)
    sklearn_model.fit(x_train_scaled, y_train, sample_weight=train_sample_weights)
    sklearn_test_probabilities = sklearn_model.predict_proba(x_test_scaled)[:, 1]

    scored_test_rows = test_rows.copy()
    scored_test_rows["manual_p_like"] = test_probabilities
    scored_test_rows["manual_prediction"] = test_predictions

    return {
        "training_frame": training_frame,
        "label_source": label_source,
        "feedback_path": feedback_path if label_source == "feedback" else "",
        "include_artist_feedback": include_artist_feedback,
        "x_shape": x_matrix.shape,
        "y_shape": y_vector.shape,
        "label_counts": training_frame["liked_label"].value_counts().to_dict(),
        "label_source_counts": training_frame["label_source"].value_counts().to_dict(),
        "sample_weight_by_source": training_frame.groupby("label_source")[
            "sample_weight"
        ]
        .mean()
        .to_dict(),
        "means": means,
        "standard_deviations": standard_deviations,
        "weights": weights,
        "bias": bias,
        "cost_history": cost_history,
        "train_accuracy": accuracy_score(
            y_train,
            train_predictions,
            sample_weight=train_sample_weights,
        ),
        "test_accuracy": accuracy_score(
            y_test,
            test_predictions,
            sample_weight=test_sample_weights,
        ),
        "train_log_loss": log_loss(
            y_train,
            train_probabilities,
            sample_weight=train_sample_weights,
        ),
        "test_log_loss": log_loss(
            y_test,
            test_probabilities,
            sample_weight=test_sample_weights,
        ),
        "sklearn_test_accuracy": sklearn_model.score(
            x_test_scaled,
            y_test,
            sample_weight=test_sample_weights,
        ),
        "sklearn_test_log_loss": log_loss(
            y_test,
            sklearn_test_probabilities,
            sample_weight=test_sample_weights,
        ),
        "coefficients": summarize_coefficients(weights),
        "scored_test_rows": scored_test_rows,
    }


def print_experiment_report(results: dict, top_n: int = 8) -> None:
    print("\n=== Python ML experiment: logistic regression feedback model ===")
    print("\nGoal:")
    print("Predict p(like) for a track from Spotify listening features.")

    print("\nCoursera math mapping:")
    print("X = feature matrix")
    print("y = feedback label vector")
    print("z = X @ w + b")
    print("p(like) = sigmoid(z)")
    print("cost = binary cross-entropy + L2 regularization")
    print("w, b are learned with gradient descent")

    print("\nDataset:")
    print(f"label source: {results['label_source']}")
    if results["feedback_path"]:
        print(f"feedback path: {results['feedback_path']}")
        print(f"artist feedback included: {results['include_artist_feedback']}")
    print(f"X shape: {results['x_shape']}")
    print(f"y shape: {results['y_shape']}")
    print(f"labels: {results['label_counts']}")
    print(f"label sources: {results['label_source_counts']}")
    print(f"sample weights: {results['sample_weight_by_source']}")

    print("\nFirst five scaled feature parameters:")
    scaling_preview = pd.DataFrame(
        {
            "feature": FEATURE_COLUMNS[:5],
            "mean": results["means"][:5],
            "std": results["standard_deviations"][:5],
        }
    )
    print(scaling_preview.round(3).to_string(index=False))

    print("\nCost during gradient descent:")
    for step, cost in enumerate(results["cost_history"]):
        print(f"checkpoint {step:02d}: J(w,b) = {cost:.4f}")

    print("\nManual NumPy model:")
    print(f"train accuracy: {results['train_accuracy']:.3f}")
    print(f"test accuracy:  {results['test_accuracy']:.3f}")
    print(f"train log loss: {results['train_log_loss']:.4f}")
    print(f"test log loss:  {results['test_log_loss']:.4f}")
    print(f"bias b:         {results['bias']:.4f}")

    print("\nscikit-learn comparison:")
    print(f"test accuracy:  {results['sklearn_test_accuracy']:.3f}")
    print(f"test log loss:  {results['sklearn_test_log_loss']:.4f}")

    print("\nTop learned coefficients:")
    print(results["coefficients"].head(top_n).round(4).to_string(index=False))

    print("\nExample predictions:")
    columns = [
        "track_name",
        "artist_name",
        "streams",
        "artist_stream_count",
        "skip_rate",
        "listen_strength",
        "feedback_model_score",
        "recommendation_source",
        "liked_label",
        "label_source",
        "manual_p_like",
        "manual_prediction",
    ]
    print(
        results["scored_test_rows"][columns]
        .sort_values("manual_p_like", ascending=False)
        .head(top_n)
        .round(3)
        .to_string(index=False)
    )


def save_feedback_model_artifact(results: dict, output_path: str) -> dict:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    artifact = {
        "version": 1,
        "model_type": "manual_logistic_regression",
        "created_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "label_source": results["label_source"],
        "feature_columns": FEATURE_COLUMNS,
        "weights": results["weights"].tolist(),
        "bias": float(results["bias"]),
        "means": results["means"].tolist(),
        "standard_deviations": results["standard_deviations"].tolist(),
        "default_blend_weight": 0.3,
        "training": {
            "x_shape": list(results["x_shape"]),
            "y_shape": list(results["y_shape"]),
            "label_counts": results["label_counts"],
            "label_source_counts": results["label_source_counts"],
            "sample_weight_by_source": results["sample_weight_by_source"],
            "train_accuracy": float(results["train_accuracy"]),
            "test_accuracy": float(results["test_accuracy"]),
            "train_log_loss": float(results["train_log_loss"]),
            "test_log_loss": float(results["test_log_loss"]),
            "sklearn_test_accuracy": float(results["sklearn_test_accuracy"]),
            "sklearn_test_log_loss": float(results["sklearn_test_log_loss"]),
        },
    }

    path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")

    return {
        "output_path": str(path),
        "feature_count": len(FEATURE_COLUMNS),
        "label_source": artifact["label_source"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a visible NumPy logistic regression model from Spotify listening history.",
    )
    parser.add_argument("--data-path", default="data/private")
    parser.add_argument(
        "--label-source",
        choices=["proxy", "feedback", "hybrid"],
        default="proxy",
        help=(
            "Use proxy listening labels, real exported Like/Ignore feedback, "
            "or hybrid mode where real feedback overrides proxy labels."
        ),
    )
    parser.add_argument(
        "--feedback-path",
        default="data/feedback/events.json",
        help="JSON or CSV export of feedback events for feedback or hybrid labels.",
    )
    parser.add_argument(
        "--export-feedback-url",
        default="",
        help=(
            "Optional app URL to fetch /api/feedback/events before training, "
            "for example https://spotify-ai-sooty.vercel.app."
        ),
    )
    parser.add_argument(
        "--feedback-limit",
        type=int,
        default=1000,
        help="Maximum feedback events to export from the app before training.",
    )
    parser.add_argument(
        "--model-output",
        default="",
        help=(
            "Optional path for the saved logistic model artifact. "
            f"Recommended: {DEFAULT_MODEL_PATH.relative_to(BACKEND_DIR)}."
        ),
    )
    parser.add_argument(
        "--real-feedback-weight",
        type=float,
        default=5.0,
        help="Training weight for exact Like/Ignore feedback rows.",
    )
    parser.add_argument(
        "--proxy-weight",
        type=float,
        default=1.0,
        help="Training weight for listening-behavior proxy rows.",
    )
    parser.add_argument(
        "--no-artist-feedback",
        action="store_true",
        help="Only use exact song feedback labels; ignore artist feedback labels.",
    )
    parser.add_argument("--learning-rate", type=float, default=0.08)
    parser.add_argument("--iterations", type=int, default=1_200)
    parser.add_argument("--lambda", dest="regularization_lambda", type=float, default=0.05)

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        if args.export_feedback_url:
            export_result = export_feedback_events_for_training(
                source_url=args.export_feedback_url,
                feedback_path=args.feedback_path,
                limit=args.feedback_limit,
            )
            print("Feedback exported before training:")
            print(f"source: {export_result['source_url']}")
            print(f"output: {export_result['output_path']}")
            print(f"events: {export_result['event_count']}")
            print(f"storage mode: {export_result['storage_mode']}")

        results = run_feedback_logistic_regression(
            data_path=args.data_path,
            label_source=args.label_source,
            feedback_path=args.feedback_path,
            include_artist_feedback=not args.no_artist_feedback,
            real_feedback_weight=args.real_feedback_weight,
            proxy_weight=args.proxy_weight,
            learning_rate=args.learning_rate,
            iterations=args.iterations,
            regularization_lambda=args.regularization_lambda,
        )
    except (FileNotFoundError, ValueError) as error:
        raise SystemExit(f"\nExperiment stopped:\n{error}") from error

    print_experiment_report(results)

    if args.model_output:
        save_result = save_feedback_model_artifact(results, args.model_output)
        print("\nSaved model artifact:")
        print(f"output: {save_result['output_path']}")
        print(f"features: {save_result['feature_count']}")
        print(f"label source: {save_result['label_source']}")


if __name__ == "__main__":
    main()
