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


def build_track_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["is_skip"] = df["minutes_played"] < 0.5

    max_played_at = df["played_at"].max()
    last_7_days = df["played_at"] >= max_played_at - pd.Timedelta(days=7)
    last_14_days = df["played_at"] >= max_played_at - pd.Timedelta(days=14)
    last_30_days = df["played_at"] >= max_played_at - pd.Timedelta(days=30)
    df["recent_7d_stream"] = last_7_days.astype(int)
    df["recent_14d_stream"] = last_14_days.astype(int)
    df["recent_30d_stream"] = last_30_days.astype(int)
    df["recent_7d_minutes"] = df["minutes_played"].where(last_7_days, 0)
    df["recent_14d_minutes"] = df["minutes_played"].where(last_14_days, 0)
    df["recent_30d_minutes"] = df["minutes_played"].where(last_30_days, 0)

    track_features = (
        df.groupby(["track_name", "artist_name", "album_name"])
        .agg(
            streams=("track_name", "count"),
            total_minutes=("minutes_played", "sum"),
            recent_7d_streams=("recent_7d_stream", "sum"),
            recent_14d_streams=("recent_14d_stream", "sum"),
            recent_30d_streams=("recent_30d_stream", "sum"),
            recent_7d_minutes=("recent_7d_minutes", "sum"),
            recent_14d_minutes=("recent_14d_minutes", "sum"),
            recent_30d_minutes=("recent_30d_minutes", "sum"),
            active_days=("played_at", lambda x: x.dt.date.nunique()),
            avg_minutes_per_stream=("minutes_played", "mean"),
            skip_rate=("is_skip", "mean"),
            last_played_at=("played_at", "max"),
        )
        .reset_index()
    )

    track_features["listen_strength"] = (
        track_features["total_minutes"] * (1 - track_features["skip_rate"])
    )
    track_features["recent_listen_strength"] = (
        (
            track_features["recent_7d_minutes"] * 4
            + track_features["recent_14d_minutes"] * 2
            + track_features["recent_30d_minutes"]
        )
        * (1 - track_features["skip_rate"])
    )

    days_since_last_play = (
        max_played_at - track_features["last_played_at"]
    ).dt.days.clip(lower=0)
    track_features["recency_score"] = 1 / (1 + days_since_last_play)
    track_features["group_score"] = (
        track_features["recent_listen_strength"] * 0.65
        + track_features["listen_strength"] * 0.25
        + track_features["recency_score"] * 10
    )

    return track_features


def get_track_recommendations(
    df: pd.DataFrame,
    top_n: int = 20,
    max_play_count: int = 10,
    max_skip_rate: float = 0.6,
    liked_tracks: list[str] | None = None,
    ignored_tracks: list[str] | None = None,
):
    track_features = build_track_features(df)
    liked_tracks = liked_tracks or []
    ignored_tracks = ignored_tracks or []

    feature_columns = [
        "streams",
        "total_minutes",
        "active_days",
        "avg_minutes_per_stream",
        "skip_rate",
        "listen_strength",
        "recency_score",
    ]

    top_user_tracks = (
        track_features.sort_values("listen_strength", ascending=False)
        .head(25)["track_name"]
        .tolist()
    )

    user_vector_tracks = list(dict.fromkeys(top_user_tracks + liked_tracks))

    scaler = StandardScaler()
    feature_matrix = scaler.fit_transform(track_features[feature_columns])

    track_features_scaled = pd.DataFrame(
        feature_matrix,
        index=track_features["track_name"],
        columns=feature_columns,
    )

    available_user_vector_tracks = [
        track
        for track in user_vector_tracks
        if track in track_features_scaled.index
    ]

    if available_user_vector_tracks:
        user_track_vectors = track_features_scaled.loc[
            available_user_vector_tracks
        ].to_numpy()
    else:
        user_track_vectors = (
            track_features_scaled
            .loc[top_user_tracks]
            .to_numpy()
        )

    user_vector = np.mean(user_track_vectors, axis=0).reshape(1, -1)

    similarity_scores = cosine_similarity(
        user_vector,
        feature_matrix,
    )[0]

    results = pd.DataFrame({
        "track_name": track_features["track_name"],
        "artist_name": track_features["artist_name"],
        "album_name": track_features["album_name"],
        "score": similarity_scores,
        "streams": track_features["streams"],
        "minutes": track_features["total_minutes"],
        "skip_rate": track_features["skip_rate"],
        "listen_strength": track_features["listen_strength"],
        "recency_score": track_features["recency_score"],
    })

    results = results[~results["track_name"].isin(top_user_tracks)]
    results = results[~results["track_name"].isin(liked_tracks)]
    results = results[~results["track_name"].isin(ignored_tracks)]
    results = results[results["streams"] < max_play_count]
    results = results[results["skip_rate"] <= max_skip_rate]

    results = results.sort_values(
        ["score", "listen_strength"],
        ascending=[False, False],
    ).head(top_n)

    return [
        {
            "track_name": row["track_name"],
            "artist_name": row["artist_name"],
            "album_name": row["album_name"],
            "score": round(float(row["score"]), 3),
            "streams": int(row["streams"]),
            "minutes": round(float(row["minutes"])),
            "skip_rate": round(float(row["skip_rate"]), 2),
            "listen_strength": round(float(row["listen_strength"]), 2),
            "recency_score": round(float(row["recency_score"]), 3),
            "reason": (
                "Similar to your strongest listening patterns, but still under-played"
                if row["listen_strength"] > 10
                else "Lightly played track with a similar listening profile"
            ),
        }
        for _, row in results.iterrows()
    ]


def get_trip_playlists(
    df: pd.DataFrame,
    limit: int = 25,
    new_song_max_plays: int = 5,
    survey_liked_artists: list[str] | None = None,
    survey_ignored_artists: list[str] | None = None,
):
    track_features = build_track_features(df)
    survey_liked_artists = survey_liked_artists or []
    survey_ignored_artists = survey_ignored_artists or []
    track_features["survey_artist_boost"] = track_features["artist_name"].isin(
        survey_liked_artists,
    ).astype(int)
    track_features["survey_artist_penalty"] = track_features["artist_name"].isin(
        survey_ignored_artists,
    ).astype(int)
    track_features["group_score"] = (
        track_features["group_score"]
        + track_features["survey_artist_boost"] * 25
        - track_features["survey_artist_penalty"] * 40
    )
    track_features = track_features[track_features["survey_artist_penalty"] == 0]

    shared_tracks = (
        track_features[
            (track_features["streams"] >= 10)
            & (track_features["skip_rate"] <= 0.45)
        ]
        .sort_values(["group_score", "recent_7d_streams"], ascending=[False, False])
        .head(limit)
    )

    bridge_tracks = (
        track_features[
            (track_features["streams"] >= new_song_max_plays)
            & (track_features["streams"] < 10)
            & (track_features["skip_rate"] <= 0.5)
        ]
        .sort_values(["group_score", "recency_score"], ascending=[False, False])
        .head(limit)
    )

    new_tracks = (
        track_features[
            (track_features["streams"] < new_song_max_plays)
            & (track_features["skip_rate"] <= 0.5)
        ]
        .sort_values("group_score", ascending=False)
        .head(limit)
    )

    def serialize_playlist(rows: pd.DataFrame, playlist_type: str):
        return [
            {
                "track_name": row["track_name"],
                "artist_name": row["artist_name"],
                "album_name": row["album_name"],
                "streams": int(row["streams"]),
                "minutes": round(float(row["total_minutes"])),
                "skip_rate": round(float(row["skip_rate"]), 2),
                "listen_strength": round(float(row["listen_strength"]), 2),
                "recent_7d_streams": int(row["recent_7d_streams"]),
                "recent_30d_streams": int(row["recent_30d_streams"]),
                "group_score": round(float(row["group_score"]), 2),
                "reason": playlist_type,
            }
            for _, row in rows.iterrows()
        ]

    return {
        "shared": {
            "name": "Group Mix - Shared Favorites",
            "description": "Songs the group is already likely to know and enjoy.",
            "tracks": serialize_playlist(
                shared_tracks,
                "Strong shared-history candidate",
            ),
        },
        "bridge": {
            "name": "Group Mix - Bridge Picks",
            "description": "Songs not common to everyone yet, but likely to work for the group.",
            "tracks": serialize_playlist(
                bridge_tracks,
                "Known by at least one listener and likely to transfer",
            ),
        },
        "new": {
            "name": "Group Mix - New Discoveries",
            "description": f"Songs everyone should know less than {new_song_max_plays} times.",
            "tracks": serialize_playlist(
                new_tracks,
                "New-to-the-group discovery candidate",
            ),
        },
    }


def get_artist_recommendations(
    df: pd.DataFrame,
    top_n: int = 20,
    max_skip_rate: float = 0.5,
    max_known_artist_streams: int = 50,
    liked_artists: list[str] | None = None,
    ignored_artists: list[str] | None = None,
):
    artist_features = build_artist_features(df)
    liked_artists = liked_artists or []
    ignored_artists = ignored_artists or []

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

    user_vector_artists = list(dict.fromkeys(top_user_artists + liked_artists))

    scaler = StandardScaler()
    feature_matrix = scaler.fit_transform(artist_features[feature_columns])

    artist_features_scaled = pd.DataFrame(
        feature_matrix,
        index=artist_features["artist_name"],
        columns=feature_columns,
    )

    available_user_vector_artists = [
        artist
        for artist in user_vector_artists
        if artist in artist_features_scaled.index
    ]

    top_artist_vectors = artist_features_scaled.loc[
        available_user_vector_artists
    ].to_numpy()

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
    results = results[~results["artist"].isin(liked_artists)]
    results = results[~results["artist"].isin(ignored_artists)]
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
