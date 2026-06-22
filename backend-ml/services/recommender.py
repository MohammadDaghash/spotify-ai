from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np

from services.spotify_parser import explode_artist_credits, split_artist_names


def _safe_log1p(series: pd.Series) -> pd.Series:
    return np.log1p(series.fillna(0).clip(lower=0))


def _scale_feature_frame(features: pd.DataFrame, feature_columns: list[str]):
    scaler = StandardScaler()
    feature_matrix = scaler.fit_transform(features[feature_columns])

    scaled_features = pd.DataFrame(
        feature_matrix,
        index=features.index,
        columns=feature_columns,
    )

    return feature_matrix, scaled_features


def _weighted_average(vectors: np.ndarray, weights: np.ndarray) -> np.ndarray:
    if len(vectors) == 0:
        raise ValueError("Cannot build a user vector without feature vectors.")

    weights = np.asarray(weights, dtype=float)

    if weights.sum() <= 0:
        weights = np.ones(len(vectors))

    return np.average(vectors, axis=0, weights=weights).reshape(1, -1)


def _calibrate_cosine_scores(scores: np.ndarray) -> np.ndarray:
    return np.clip((scores + 1) / 2, 0, 1)


def _normalize_track_key(track_name: str, artist_name: str = "") -> str:
    return f"{track_name or ''}|{artist_name or ''}".strip().lower()


def _normalize_name_set(names: list[str] | None) -> set[str]:
    return {(name or "").strip().lower() for name in names or [] if name}


def _artist_credit_matches(artist_name: str, artist_names: set[str]) -> bool:
    artist_credits = {
        credit.strip().lower()
        for credit in split_artist_names(artist_name)
        if credit.strip()
    }

    return bool(artist_credits & artist_names)


def _apply_artist_diversity_penalty(
    results: pd.DataFrame,
    artist_column: str,
    score_column: str = "final_score",
    max_per_artist: int = 2,
    penalty_step: float = 0.06,
) -> pd.DataFrame:
    results = results.sort_values(score_column, ascending=False).copy()
    artist_counts: dict[str, int] = {}
    rerank_scores: list[float] = []
    diversity_penalties: list[float] = []

    for _, row in results.iterrows():
        artist = row[artist_column]
        artist_count = artist_counts.get(artist, 0)
        penalty = max(0, artist_count - max_per_artist + 1) * penalty_step
        artist_counts[artist] = artist_count + 1
        diversity_penalties.append(penalty)
        rerank_scores.append(max(0, float(row[score_column]) - penalty))

    results["diversity_penalty"] = diversity_penalties
    results["rerank_score"] = rerank_scores

    return results


def build_artist_features(df: pd.DataFrame) -> pd.DataFrame:
    df = explode_artist_credits(df)
    df["is_skip"] = df["minutes_played"] < 0.5
    max_played_at = df["played_at"].max()
    last_7_days = df["played_at"] >= max_played_at - pd.Timedelta(days=7)
    last_30_days = df["played_at"] >= max_played_at - pd.Timedelta(days=30)
    df["recent_7d_stream"] = last_7_days.astype(int)
    df["recent_30d_stream"] = last_30_days.astype(int)
    df["recent_7d_minutes"] = df["minutes_played"].where(last_7_days, 0)
    df["recent_30d_minutes"] = df["minutes_played"].where(last_30_days, 0)

    artist_features = (
        df.groupby("artist_name")
        .agg(
            streams=("track_name", "count"),
            total_minutes=("minutes_played", "sum"),
            recent_7d_streams=("recent_7d_stream", "sum"),
            recent_30d_streams=("recent_30d_stream", "sum"),
            recent_7d_minutes=("recent_7d_minutes", "sum"),
            recent_30d_minutes=("recent_30d_minutes", "sum"),
            unique_tracks=("track_name", "nunique"),
            unique_albums=("album_name", "nunique"),
            active_days=("played_at", lambda x: x.dt.date.nunique()),
            avg_minutes_per_stream=("minutes_played", "mean"),
            skip_rate=("is_skip", "mean"),
            last_played_at=("played_at", "max"),
        )
        .reset_index()
    )

    artist_features["listen_strength"] = (
        artist_features["total_minutes"] * (1 - artist_features["skip_rate"])
    )
    artist_features["recent_listen_strength"] = (
        (
            artist_features["recent_7d_minutes"] * 3
            + artist_features["recent_30d_minutes"]
        )
        * (1 - artist_features["skip_rate"])
    )
    days_since_last_play = (
        max_played_at - artist_features["last_played_at"]
    ).dt.days.clip(lower=0)
    artist_features["recency_score"] = 1 / (1 + days_since_last_play)

    artist_features["log_streams"] = _safe_log1p(artist_features["streams"])
    artist_features["log_total_minutes"] = _safe_log1p(
        artist_features["total_minutes"]
    )
    artist_features["log_unique_tracks"] = _safe_log1p(
        artist_features["unique_tracks"]
    )
    artist_features["log_unique_albums"] = _safe_log1p(
        artist_features["unique_albums"]
    )
    artist_features["log_active_days"] = _safe_log1p(artist_features["active_days"])
    artist_features["log_listen_strength"] = _safe_log1p(
        artist_features["listen_strength"]
    )
    artist_features["log_recent_listen_strength"] = _safe_log1p(
        artist_features["recent_listen_strength"]
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
    track_features["completion_signal"] = (
        1 - track_features["skip_rate"]
    ) * track_features["avg_minutes_per_stream"]

    track_features["log_streams"] = _safe_log1p(track_features["streams"])
    track_features["log_total_minutes"] = _safe_log1p(
        track_features["total_minutes"]
    )
    track_features["log_active_days"] = _safe_log1p(track_features["active_days"])
    track_features["log_listen_strength"] = _safe_log1p(
        track_features["listen_strength"]
    )
    track_features["log_recent_listen_strength"] = _safe_log1p(
        track_features["recent_listen_strength"]
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
    liked_track_names = _normalize_name_set(liked_tracks)
    ignored_track_names = _normalize_name_set(ignored_tracks)
    track_features["track_key"] = track_features.apply(
        lambda row: _normalize_track_key(row["track_name"], row["artist_name"]),
        axis=1,
    )
    liked_track_keys = {
        _normalize_track_key(track)
        for track in liked_tracks
    }
    ignored_track_keys = {
        _normalize_track_key(track)
        for track in ignored_tracks
    }

    feature_columns = [
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

    top_user_tracks = (
        track_features.sort_values(
            ["recent_listen_strength", "listen_strength"],
            ascending=[False, False],
        )
        .head(35)["track_key"]
        .tolist()
    )

    user_vector_tracks = list(dict.fromkeys(top_user_tracks + list(liked_track_keys)))

    feature_matrix, track_features_scaled = _scale_feature_frame(
        track_features,
        feature_columns,
    )
    track_features_scaled.index = track_features["track_key"]

    available_user_vector_tracks = [
        track
        for track in user_vector_tracks
        if track in track_features_scaled.index
    ]

    if available_user_vector_tracks:
        user_track_vectors = track_features_scaled.loc[
            available_user_vector_tracks
        ].to_numpy()
        user_track_features = track_features.set_index("track_key").loc[
            available_user_vector_tracks
        ]
        user_weights = (
            _safe_log1p(user_track_features["listen_strength"])
            + _safe_log1p(user_track_features["recent_listen_strength"]) * 1.5
            + user_track_features["track_name"].isin(liked_tracks).astype(int) * 4
            + 1
        ).to_numpy()
    else:
        user_track_vectors = (
            track_features_scaled
            .loc[top_user_tracks]
            .to_numpy()
        )
        user_weights = np.ones(len(user_track_vectors))

    user_vector = _weighted_average(user_track_vectors, user_weights)

    similarity_scores = cosine_similarity(
        user_vector,
        feature_matrix,
    )[0]
    calibrated_similarity_scores = _calibrate_cosine_scores(similarity_scores)

    quality_score = (
        (1 - track_features["skip_rate"]) * 0.45
        + track_features["recency_score"] * 0.25
        + np.minimum(track_features["recent_30d_streams"], 5) / 5 * 0.2
        + np.minimum(track_features["active_days"], 4) / 4 * 0.1
    )
    known_track_penalty = (
        np.minimum(track_features["streams"], max_play_count) / max_play_count
    ) * 0.08
    final_scores = (
        calibrated_similarity_scores * 0.72
        + quality_score.to_numpy() * 0.28
        - known_track_penalty.to_numpy()
    )
    final_scores = np.clip(final_scores, 0, 1)

    results = pd.DataFrame({
        "track_name": track_features["track_name"],
        "artist_name": track_features["artist_name"],
        "album_name": track_features["album_name"],
        "score": calibrated_similarity_scores,
        "raw_similarity_score": similarity_scores,
        "final_score": final_scores,
        "quality_score": quality_score,
        "known_track_penalty": known_track_penalty,
        "streams": track_features["streams"],
        "minutes": track_features["total_minutes"],
        "skip_rate": track_features["skip_rate"],
        "listen_strength": track_features["listen_strength"],
        "recent_listen_strength": track_features["recent_listen_strength"],
        "recency_score": track_features["recency_score"],
        "track_key": track_features["track_key"],
    })

    results = results[~results["track_key"].isin(top_user_tracks)]
    results = results[~results["track_key"].isin(liked_track_keys)]
    results = results[~results["track_key"].isin(ignored_track_keys)]
    results = results[
        ~results["track_name"].str.strip().str.lower().isin(liked_track_names)
    ]
    results = results[
        ~results["track_name"].str.strip().str.lower().isin(ignored_track_names)
    ]
    results = results[results["streams"] < max_play_count]
    results = results[results["skip_rate"] <= max_skip_rate]
    results = results[results["listen_strength"] > 0]

    results = _apply_artist_diversity_penalty(
        results,
        artist_column="artist_name",
    )
    results = results.sort_values(
        ["rerank_score", "final_score", "recent_listen_strength", "listen_strength"],
        ascending=[False, False, False, False],
    ).head(top_n)

    results = results.sort_values(
        ["rerank_score", "final_score", "recent_listen_strength", "listen_strength"],
        ascending=[False, False, False, False],
    )

    return [
        {
            "track_name": row["track_name"],
            "artist_name": row["artist_name"],
            "album_name": row["album_name"],
            "score": round(float(row["final_score"]), 3),
            "similarity_score": round(float(row["score"]), 3),
            "raw_similarity_score": round(float(row["raw_similarity_score"]), 3),
            "quality_score": round(float(row["quality_score"]), 3),
            "confidence": round(
                float(
                    min(
                        1,
                        0.45
                        + row["score"] * 0.35
                        + (1 - row["skip_rate"]) * 0.2,
                    )
                ),
                3,
            ),
            "diversity_penalty": round(float(row["diversity_penalty"]), 3),
            "known_track_penalty": round(float(row["known_track_penalty"]), 3),
            "streams": int(row["streams"]),
            "minutes": round(float(row["minutes"])),
            "skip_rate": round(float(row["skip_rate"]), 2),
            "listen_strength": round(float(row["listen_strength"]), 2),
            "recent_listen_strength": round(float(row["recent_listen_strength"]), 2),
            "recency_score": round(float(row["recency_score"]), 3),
            "reason": (
                "Recently connected with your taste and still under-played"
                if row["recent_listen_strength"] > 5
                else "Similar to your strongest listening patterns, but still under-played"
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
    survey_liked_artist_names = _normalize_name_set(survey_liked_artists)
    survey_ignored_artist_names = _normalize_name_set(survey_ignored_artists)
    track_features["survey_artist_boost"] = track_features["artist_name"].apply(
        lambda artist_name: int(
            _artist_credit_matches(artist_name, survey_liked_artist_names)
        )
    )
    track_features["survey_artist_penalty"] = track_features["artist_name"].apply(
        lambda artist_name: int(
            _artist_credit_matches(artist_name, survey_ignored_artist_names)
        )
    )
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
    liked_artist_names = _normalize_name_set(liked_artists)
    ignored_artist_names = _normalize_name_set(ignored_artists)

    feature_columns = [
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

    top_user_artists = (
        artist_features.sort_values(
            ["recent_listen_strength", "listen_strength"],
            ascending=[False, False],
        )
        .head(15)["artist_name"]
        .tolist()
    )

    user_vector_artists = list(dict.fromkeys(top_user_artists + liked_artists))

    feature_matrix, artist_features_scaled = _scale_feature_frame(
        artist_features,
        feature_columns,
    )
    artist_features_scaled.index = artist_features["artist_name"]

    available_user_vector_artists = [
        artist
        for artist in user_vector_artists
        if artist in artist_features_scaled.index
    ]

    top_artist_vectors = artist_features_scaled.loc[
        available_user_vector_artists
    ].to_numpy()
    top_artist_features = artist_features.set_index("artist_name").loc[
        available_user_vector_artists
    ]
    artist_weights = (
        _safe_log1p(top_artist_features["listen_strength"])
        + _safe_log1p(top_artist_features["recent_listen_strength"]) * 1.5
        + top_artist_features.index.isin(liked_artists).astype(int) * 4
        + 1
    ).to_numpy()

    user_vector = _weighted_average(top_artist_vectors, artist_weights)

    similarity_scores = cosine_similarity(
        user_vector,
        artist_features_scaled.values,
    )[0]
    calibrated_similarity_scores = _calibrate_cosine_scores(similarity_scores)
    quality_score = (
        (1 - artist_features["skip_rate"]) * 0.4
        + artist_features["recency_score"] * 0.25
        + np.minimum(artist_features["recent_30d_streams"], 10) / 10 * 0.2
        + np.minimum(artist_features["unique_tracks"], 5) / 5 * 0.15
    )
    known_artist_penalty = (
        np.minimum(artist_features["streams"], max_known_artist_streams)
        / max_known_artist_streams
    ) * 0.08
    final_scores = (
        calibrated_similarity_scores * 0.72
        + quality_score.to_numpy() * 0.28
        - known_artist_penalty.to_numpy()
    )
    final_scores = np.clip(final_scores, 0, 1)

    results = pd.DataFrame({
        "artist": artist_features["artist_name"],
        "score": calibrated_similarity_scores,
        "raw_similarity_score": similarity_scores,
        "final_score": final_scores,
        "quality_score": quality_score,
        "known_artist_penalty": known_artist_penalty,
        "streams": artist_features["streams"],
        "minutes": artist_features["total_minutes"],
        "skip_rate": artist_features["skip_rate"],
        "listen_strength": artist_features["listen_strength"],
        "recent_listen_strength": artist_features["recent_listen_strength"],
        "recency_score": artist_features["recency_score"],
    })

    results = results[~results["artist"].isin(top_user_artists)]
    results = results[
        ~results["artist"].str.strip().str.lower().isin(liked_artist_names)
    ]
    results = results[
        ~results["artist"].str.strip().str.lower().isin(ignored_artist_names)
    ]
    results = results[results["streams"] < max_known_artist_streams]
    results = results[results["skip_rate"] <= max_skip_rate]

    results = _apply_artist_diversity_penalty(
        results,
        artist_column="artist",
        max_per_artist=1,
        penalty_step=0,
    )
    results = results.sort_values(
        ["rerank_score", "final_score", "recent_listen_strength", "streams"],
        ascending=[False, False, False, True],
    ).head(top_n)

    return [
        {
            "artist": row["artist"],
            "score": round(float(row["final_score"]), 3),
            "similarity_score": round(float(row["score"]), 3),
            "raw_similarity_score": round(float(row["raw_similarity_score"]), 3),
            "quality_score": round(float(row["quality_score"]), 3),
            "confidence": round(
                float(
                    min(
                        1,
                        0.45
                        + row["score"] * 0.35
                        + (1 - row["skip_rate"]) * 0.2,
                    )
                ),
                3,
            ),
            "known_artist_penalty": round(float(row["known_artist_penalty"]), 3),
            "streams": int(row["streams"]),
            "minutes": round(float(row["minutes"])),
            "skip_rate": round(float(row["skip_rate"]), 2),
            "listen_strength": round(float(row["listen_strength"]), 2),
            "recent_listen_strength": round(float(row["recent_listen_strength"]), 2),
            "recency_score": round(float(row["recency_score"]), 3),
            "reason": (
                "Similar pattern with recent listening momentum"
                if row["recent_listen_strength"] > 20
                else "Similar listening pattern with strong real-play time"
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
