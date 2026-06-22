from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services.recommender import build_artist_features
from services.spotify_parser import load_combined_spotify_history


FEATURE_COLUMNS = [
    "log_streams",
    "log_total_minutes",
    "log_unique_tracks",
    "log_unique_albums",
    "log_active_days",
    "avg_minutes_per_stream",
    "skip_rate",
    "log_listen_strength",
    "log_recent_listen_strength",
    "recency_score",
]


def run_recommendation_experiment(
    data_path: str = "data/private",
    top_user_artist_count: int = 10,
    recommendation_count: int = 10,
    max_skip_rate: float = 0.5,
    max_known_artist_streams: int = 50,
) -> pd.DataFrame:
    df = load_combined_spotify_history(data_path)
    artist_features = build_artist_features(df)

    top_user_artists = (
        artist_features.sort_values(
            ["recent_listen_strength", "listen_strength"],
            ascending=[False, False],
        )
        .head(top_user_artist_count)["artist_name"]
        .tolist()
    )

    # Coursera concept: X is the feature matrix for a multiple-variable model.
    X = artist_features[FEATURE_COLUMNS].to_numpy()

    # Coursera concept: feature scaling puts large and small features on fair ground.
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    scaled_features = pd.DataFrame(
        X_scaled,
        index=artist_features["artist_name"],
        columns=FEATURE_COLUMNS,
    )

    # Coursera concept: NumPy vectorization builds one user vector from many rows.
    # Practical upgrade: stronger/recent artists get larger weights.
    top_artist_vectors = scaled_features.loc[top_user_artists].to_numpy()
    top_artist_features = artist_features.set_index("artist_name").loc[
        top_user_artists
    ]
    weights = (
        np.log1p(top_artist_features["listen_strength"])
        + np.log1p(top_artist_features["recent_listen_strength"]) * 1.5
        + 1
    ).to_numpy()
    user_vector = np.average(
        top_artist_vectors,
        axis=0,
        weights=weights,
    ).reshape(1, -1)

    similarity_scores = cosine_similarity(user_vector, X_scaled)[0]
    calibrated_similarity_scores = np.clip((similarity_scores + 1) / 2, 0, 1)
    quality_scores = (
        (1 - artist_features["skip_rate"]) * 0.4
        + artist_features["recency_score"] * 0.25
        + np.minimum(artist_features["recent_30d_streams"], 10) / 10 * 0.2
        + np.minimum(artist_features["unique_tracks"], 5) / 5 * 0.15
    )

    results = pd.DataFrame(
        {
            "artist": artist_features["artist_name"],
            "similarity_score": calibrated_similarity_scores,
            "raw_similarity_score": similarity_scores,
            "quality_score": quality_scores,
            "score": calibrated_similarity_scores * 0.72
            + quality_scores.to_numpy() * 0.28,
            "streams": artist_features["streams"],
            "minutes": artist_features["total_minutes"],
            "skip_rate": artist_features["skip_rate"],
            "listen_strength": artist_features["listen_strength"],
            "recent_listen_strength": artist_features["recent_listen_strength"],
        }
    )

    results = results[~results["artist"].isin(top_user_artists)]
    results = results[results["streams"] < max_known_artist_streams]
    results = results[results["skip_rate"] <= max_skip_rate]

    return results.sort_values(["score", "streams"], ascending=[False, True]).head(
        recommendation_count
    )


def main():
    recommendations = run_recommendation_experiment()

    print("\nTop experiment recommendations:")
    print(
        recommendations[
            [
                "artist",
                "score",
                "similarity_score",
                "raw_similarity_score",
                "quality_score",
                "streams",
                "minutes",
                "skip_rate",
                "listen_strength",
                "recent_listen_strength",
            ]
        ].round(3)
    )


if __name__ == "__main__":
    main()
