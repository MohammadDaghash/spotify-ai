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
from services.spotify_parser import load_spotify_history


FEATURE_COLUMNS = [
    "streams",
    "total_minutes",
    "unique_tracks",
    "unique_albums",
    "active_days",
    "avg_minutes_per_stream",
    "skip_rate",
    "listen_strength",
]


def run_recommendation_experiment(
    data_path: str = "data/private",
    top_user_artist_count: int = 10,
    recommendation_count: int = 10,
    max_skip_rate: float = 0.5,
    max_known_artist_streams: int = 50,
) -> pd.DataFrame:
    df = load_spotify_history(data_path)
    artist_features = build_artist_features(df)

    top_user_artists = (
        artist_features.sort_values("listen_strength", ascending=False)
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
    top_artist_vectors = scaled_features.loc[top_user_artists].to_numpy()
    user_vector = np.mean(top_artist_vectors, axis=0).reshape(1, -1)

    similarity_scores = cosine_similarity(user_vector, X_scaled)[0]

    results = pd.DataFrame(
        {
            "artist": artist_features["artist_name"],
            "score": similarity_scores,
            "streams": artist_features["streams"],
            "minutes": artist_features["total_minutes"],
            "skip_rate": artist_features["skip_rate"],
            "listen_strength": artist_features["listen_strength"],
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
                "streams",
                "minutes",
                "skip_rate",
                "listen_strength",
            ]
        ].round(3)
    )


if __name__ == "__main__":
    main()
