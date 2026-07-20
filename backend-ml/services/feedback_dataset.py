from pathlib import Path
import json
import re
import unicodedata

import pandas as pd


POSITIVE_ACTIONS = {"like", "save"}
NEGATIVE_ACTIONS = {"ignore"}
LABELABLE_ITEM_TYPES = {"song", "artist"}


def _clean_text(value) -> str:
    if pd.isna(value):
        return ""

    return str(value or "").strip()


def _normalize_key(value) -> str:
    clean_value = unicodedata.normalize("NFD", _clean_text(value).lower())
    clean_value = "".join(
        char for char in clean_value if unicodedata.category(char) != "Mn"
    )
    clean_value = clean_value.replace("&", " and ").replace("'", "").replace("’", "")
    clean_value = re.sub(r"[^\w]+", " ", clean_value, flags=re.UNICODE)

    return re.sub(r"\s+", " ", clean_value).strip()


def _track_key(track_name, artist_name) -> str:
    return f"{_normalize_key(track_name)}::{_normalize_key(artist_name)}"


def _load_json_feedback(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict) and isinstance(payload.get("events"), list):
        return payload["events"]

    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return payload["data"]

    raise ValueError(
        "Feedback JSON must be an event array or an object with an 'events' array."
    )


def load_feedback_events(feedback_path: str) -> pd.DataFrame:
    path = Path(feedback_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Feedback file not found: {feedback_path}. "
            "Export Supabase user_feedback_events rows or save /api/feedback/events "
            "JSON to this path."
        )

    if path.suffix.lower() == ".csv":
        raw_events = pd.read_csv(path)
    else:
        raw_events = pd.DataFrame(_load_json_feedback(path))

    if raw_events.empty:
        return pd.DataFrame()

    events = raw_events.rename(
        columns={
            "eventTimestamp": "event_timestamp",
            "itemType": "item_type",
            "itemName": "item_name",
            "itemArtist": "item_artist",
            "itemAlbum": "item_album",
        }
    ).copy()

    if "event_timestamp" not in events.columns:
        events["event_timestamp"] = events.get("timestamp", events.get("created_at"))

    required_columns = ["action", "item_type", "item_name"]
    missing_columns = [
        column for column in required_columns if column not in events.columns
    ]

    if missing_columns:
        raise ValueError(f"Feedback events are missing columns: {missing_columns}")

    for column in [
        "action",
        "label",
        "item_type",
        "item_name",
        "item_artist",
        "item_album",
        "event_timestamp",
    ]:
        if column not in events.columns:
            events[column] = ""

    events["action"] = events["action"].map(_clean_text).str.lower()
    events["label"] = events["label"].map(_clean_text).str.lower()
    events["item_type"] = events["item_type"].map(_clean_text).str.lower()
    events["item_name"] = events["item_name"].map(_clean_text)
    events["item_artist"] = events["item_artist"].map(_clean_text)
    events["item_album"] = events["item_album"].map(_clean_text)
    events["event_timestamp"] = pd.to_datetime(
        events["event_timestamp"],
        utc=True,
        errors="coerce",
    )

    return events


def _event_label(row) -> float | None:
    action = row["action"]
    label = row["label"]

    if action in POSITIVE_ACTIONS or label == "positive":
        return 1.0

    if action in NEGATIVE_ACTIONS or label == "negative":
        return 0.0

    return None


def build_feedback_label_frame(feedback_events: pd.DataFrame) -> pd.DataFrame:
    if feedback_events.empty:
        return pd.DataFrame(
            columns=[
                "item_type",
                "track_key",
                "artist_key",
                "liked_label",
                "feedback_action",
                "feedback_event_timestamp",
            ]
        )

    label_rows = []

    for _, event in feedback_events.iterrows():
        if event["item_type"] not in LABELABLE_ITEM_TYPES:
            continue

        liked_label = _event_label(event)

        if liked_label is None:
            continue

        label_rows.append(
            {
                "item_type": event["item_type"],
                "track_key": _track_key(event["item_name"], event["item_artist"]),
                "artist_key": _normalize_key(
                    event["item_artist"]
                    if event["item_type"] == "song"
                    else event["item_name"]
                ),
                "liked_label": liked_label,
                "feedback_action": event["action"],
                "feedback_event_timestamp": event["event_timestamp"],
            }
        )

    labels = pd.DataFrame(label_rows)

    if labels.empty:
        return labels

    return (
        labels.sort_values("feedback_event_timestamp")
        .drop_duplicates(["item_type", "track_key", "artist_key"], keep="last")
        .reset_index(drop=True)
    )


def join_feedback_labels_to_track_features(
    track_features: pd.DataFrame,
    feedback_events: pd.DataFrame,
    include_artist_feedback: bool = True,
) -> pd.DataFrame:
    labels = build_feedback_label_frame(feedback_events)

    if labels.empty:
        return track_features.iloc[0:0].copy()

    features = track_features.copy()
    features["track_key"] = features.apply(
        lambda row: _track_key(row["track_name"], row["artist_name"]),
        axis=1,
    )
    features["artist_key"] = features["artist_name"].map(_normalize_key)

    song_labels = labels[labels["item_type"] == "song"][
        [
            "track_key",
            "liked_label",
            "feedback_action",
            "feedback_event_timestamp",
        ]
    ].rename(
        columns={
            "liked_label": "song_liked_label",
            "feedback_action": "song_feedback_action",
            "feedback_event_timestamp": "song_feedback_event_timestamp",
        }
    )
    labeled_tracks = features.merge(song_labels, on="track_key", how="left")

    if include_artist_feedback:
        artist_labels = labels[labels["item_type"] == "artist"][
            [
                "artist_key",
                "liked_label",
                "feedback_action",
                "feedback_event_timestamp",
            ]
        ].rename(
            columns={
                "liked_label": "artist_liked_label",
                "feedback_action": "artist_feedback_action",
                "feedback_event_timestamp": "artist_feedback_event_timestamp",
            }
        )
        labeled_tracks = labeled_tracks.merge(
            artist_labels,
            on="artist_key",
            how="left",
        )
    else:
        labeled_tracks["artist_liked_label"] = pd.NA
        labeled_tracks["artist_feedback_action"] = ""
        labeled_tracks["artist_feedback_event_timestamp"] = pd.NaT

    labeled_tracks["liked_label"] = labeled_tracks["song_liked_label"].combine_first(
        labeled_tracks["artist_liked_label"]
    )
    labeled_tracks["label_source"] = "song_feedback"
    labeled_tracks.loc[
        labeled_tracks["song_liked_label"].isna()
        & labeled_tracks["artist_liked_label"].notna(),
        "label_source",
    ] = "artist_feedback"
    labeled_tracks["feedback_action"] = labeled_tracks[
        "song_feedback_action"
    ].combine_first(labeled_tracks["artist_feedback_action"])
    labeled_tracks["feedback_event_timestamp"] = labeled_tracks[
        "song_feedback_event_timestamp"
    ].combine_first(labeled_tracks["artist_feedback_event_timestamp"])

    labeled_tracks = labeled_tracks.dropna(subset=["liked_label"]).copy()
    labeled_tracks["liked_label"] = labeled_tracks["liked_label"].astype(float)

    return labeled_tracks


def build_real_feedback_training_frame(
    track_features: pd.DataFrame,
    feedback_path: str,
    include_artist_feedback: bool = True,
) -> pd.DataFrame:
    feedback_events = load_feedback_events(feedback_path)

    return join_feedback_labels_to_track_features(
        track_features,
        feedback_events,
        include_artist_feedback=include_artist_feedback,
    )
