from pathlib import Path
import argparse
import math
import sys

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import train_test_split


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services.feedback_dataset import build_real_feedback_training_frame
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
) -> float:
    sample_count = y_vector.shape[0]
    predictions = sigmoid(x_matrix @ weights + bias)
    epsilon = 1e-9
    predictions = np.clip(predictions, epsilon, 1 - epsilon)
    data_loss = -np.mean(
        y_vector * np.log(predictions)
        + (1 - y_vector) * np.log(1 - predictions)
    )
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
) -> tuple[np.ndarray, float]:
    sample_count = y_vector.shape[0]
    errors = sigmoid(x_matrix @ weights + bias) - y_vector
    weight_gradient = (x_matrix.T @ errors) / sample_count
    weight_gradient += (regularization_lambda / sample_count) * weights
    bias_gradient = np.sum(errors) / sample_count

    return weight_gradient, float(bias_gradient)


def run_gradient_descent(
    x_matrix: np.ndarray,
    y_vector: np.ndarray,
    learning_rate: float = 0.08,
    iterations: int = 1_200,
    regularization_lambda: float = 0.05,
) -> tuple[np.ndarray, float, list[float]]:
    weights = np.zeros(x_matrix.shape[1])
    bias = 0.0
    cost_history = []

    for iteration in range(iterations):
        weight_gradient, bias_gradient = compute_gradient(
            x_matrix,
            y_vector,
            weights,
            bias,
            regularization_lambda,
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
                )
            )

    return weights, bias, cost_history


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


def build_training_frame(
    data_path: str,
    label_source: str = "proxy",
    feedback_path: str = "data/feedback/events.json",
    include_artist_feedback: bool = True,
) -> pd.DataFrame:
    history = load_combined_spotify_history(data_path)
    track_features = build_track_features(history)

    if label_source == "proxy":
        labeled_tracks = add_proxy_feedback_labels(track_features)
        labeled_tracks["label_source"] = "proxy_listening_behavior"
    elif label_source == "feedback":
        labeled_tracks = build_real_feedback_training_frame(
            track_features,
            feedback_path=feedback_path,
            include_artist_feedback=include_artist_feedback,
        )
    else:
        raise ValueError("label_source must be 'proxy' or 'feedback'.")

    if labeled_tracks.empty:
        raise ValueError(
            "No labelable training rows were found. "
            "For --label-source feedback, export feedback events first."
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
    )
    x_matrix = training_frame[FEATURE_COLUMNS].to_numpy(dtype=float)
    y_vector = training_frame["liked_label"].to_numpy(dtype=float)
    test_size = max(2, math.ceil(len(training_frame) * 0.25))

    x_train, x_test, y_train, y_test, train_rows, test_rows = train_test_split(
        x_matrix,
        y_vector,
        training_frame,
        test_size=test_size,
        random_state=random_state,
        stratify=y_vector,
    )
    x_train_scaled, x_test_scaled, means, standard_deviations = standardize_train_test(
        x_train,
        x_test,
    )
    weights, bias, cost_history = run_gradient_descent(
        x_train_scaled,
        y_train,
        learning_rate=learning_rate,
        iterations=iterations,
        regularization_lambda=regularization_lambda,
    )

    train_probabilities = predict_probability(x_train_scaled, weights, bias)
    test_probabilities = predict_probability(x_test_scaled, weights, bias)
    train_predictions = (train_probabilities >= 0.5).astype(int)
    test_predictions = (test_probabilities >= 0.5).astype(int)

    sklearn_model = LogisticRegression(max_iter=1_000, random_state=random_state)
    sklearn_model.fit(x_train_scaled, y_train)
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
        "means": means,
        "standard_deviations": standard_deviations,
        "weights": weights,
        "bias": bias,
        "cost_history": cost_history,
        "train_accuracy": accuracy_score(y_train, train_predictions),
        "test_accuracy": accuracy_score(y_test, test_predictions),
        "train_log_loss": log_loss(y_train, train_probabilities),
        "test_log_loss": log_loss(y_test, test_probabilities),
        "sklearn_test_accuracy": sklearn_model.score(x_test_scaled, y_test),
        "sklearn_test_log_loss": log_loss(y_test, sklearn_test_probabilities),
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
        "skip_rate",
        "listen_strength",
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a visible NumPy logistic regression model from Spotify listening history.",
    )
    parser.add_argument("--data-path", default="data/private")
    parser.add_argument(
        "--label-source",
        choices=["proxy", "feedback"],
        default="proxy",
        help="Use proxy listening labels or real exported Like/Ignore feedback.",
    )
    parser.add_argument(
        "--feedback-path",
        default="data/feedback/events.json",
        help="JSON or CSV export of feedback events for --label-source feedback.",
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
        results = run_feedback_logistic_regression(
            data_path=args.data_path,
            label_source=args.label_source,
            feedback_path=args.feedback_path,
            include_artist_feedback=not args.no_artist_feedback,
            learning_rate=args.learning_rate,
            iterations=args.iterations,
            regularization_lambda=args.regularization_lambda,
        )
    except (FileNotFoundError, ValueError) as error:
        raise SystemExit(f"\nExperiment stopped:\n{error}") from error

    print_experiment_report(results)


if __name__ == "__main__":
    main()
