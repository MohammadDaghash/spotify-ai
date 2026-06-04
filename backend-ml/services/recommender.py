from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np


def build_artist_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["is_skip"] = df["minutes_played"] < 0.5

    artist_features = (
        df.groupby("artist_name")
        .agg(
            streams=("track_name", "count"),
            total_minutes=("minutes_played", "sum"),
            unique_tracks=("track_name", "nunique"),
            unique_albums=("album_name", "nunique"),
            active_days=("played_at", lambda x: x.dt.date.nunique()),
            avg_minutes_per_stream=("minutes_played", "mean"),
            skip_rate=("is_skip", "mean"),
        )
        .reset_index()
    )

    artist_features["listen_strength"] = (
        artist_features["total_minutes"] * (1 - artist_features["skip_rate"])
    )

    return artist_features


def get_artist_recommendations(
    df: pd.DataFrame,
    top_n: int = 20,
    max_skip_rate: float = 0.5,
    max_known_artist_streams: int = 50,
):
    artist_features = build_artist_features(df)

    feature_columns = [
        "streams",
        "total_minutes",
        "unique_tracks",
        "unique_albums",
        "active_days",
        "avg_minutes_per_stream",
        "skip_rate",
        "listen_strength",
    ]

    top_user_artists = (
        artist_features.sort_values("listen_strength", ascending=False)
        .head(10)["artist_name"]
        .tolist()
    )

    scaler = StandardScaler()
    feature_matrix = scaler.fit_transform(artist_features[feature_columns])

    artist_features_scaled = pd.DataFrame(
        feature_matrix,
        index=artist_features["artist_name"],
        columns=feature_columns,
    )

    top_artist_vectors = artist_features_scaled.loc[top_user_artists].to_numpy()

    user_vector = np.mean(top_artist_vectors, axis=0).reshape(1, -1)

    similarity_scores = cosine_similarity(
        user_vector,
        artist_features_scaled.values,
    )[0]

    results = pd.DataFrame({
        "artist": artist_features["artist_name"],
        "score": similarity_scores,
        "streams": artist_features["streams"],
        "minutes": artist_features["total_minutes"],
        "skip_rate": artist_features["skip_rate"],
        "listen_strength": artist_features["listen_strength"],
    })

    results = results[~results["artist"].isin(top_user_artists)]
    results = results[results["streams"] < max_known_artist_streams]
    results = results[results["skip_rate"] <= max_skip_rate]

    results = results.sort_values(
        ["score", "streams"],
        ascending=[False, True],
    ).head(top_n)

    return [
        {
            "artist": row["artist"],
            "score": round(float(row["score"]), 3),
            "streams": int(row["streams"]),
            "minutes": round(float(row["minutes"])),
            "skip_rate": round(float(row["skip_rate"]), 2),
            "listen_strength": round(float(row["listen_strength"]), 2),
            "reason": (
                "Similar listening pattern with strong real-play time"
                if row["listen_strength"] > 50
                else "Similar listening pattern with emerging interest signal"
            ),
        }
        for _, row in results.iterrows()
    ]

def get_top_user_artists(df: pd.DataFrame, limit: int = 10):
    artist_features = build_artist_features(df)

    top_artists = (
        artist_features.sort_values("listen_strength", ascending=False)
        .head(limit)
    )

    return top_artists[
        [
            "artist_name",
            "streams",
            "total_minutes",
            "skip_rate",
            "listen_strength",
        ]
    ].to_dict(orient="records")