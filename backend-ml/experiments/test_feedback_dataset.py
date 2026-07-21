import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services.feedback_dataset import join_feedback_labels_to_track_features
from feedback_logistic_regression import (
    add_training_sample_weights,
    build_hybrid_feedback_frame,
)


def test_feedback_labels_join_to_tracks():
    track_features = pd.DataFrame(
        [
            {
                "track_name": "Song A",
                "artist_name": "Artist One",
                "album_name": "Album A",
            },
            {
                "track_name": "Song B",
                "artist_name": "Artist Two",
                "album_name": "Album B",
            },
            {
                "track_name": "Song C",
                "artist_name": "Artist Three",
                "album_name": "Album C",
            },
        ]
    )
    feedback_events = pd.DataFrame(
        [
            {
                "event_timestamp": "2026-07-01T10:00:00Z",
                "action": "like",
                "label": "positive",
                "item_type": "song",
                "item_name": "Song A",
                "item_artist": "Artist One",
                "score": 0.82,
                "relative_match": 94,
                "source": "recommendations",
                "context": {
                    "recommendationSource": "catalog-backfill",
                    "modelFeatures": {
                        "similarityScore": 0.7,
                        "qualityScore": 0.8,
                        "confidence": 0.75,
                        "recencyScore": 0.6,
                        "knownTrackPenalty": 0.1,
                        "diversityPenalty": 0.05,
                        "feedbackScoreDelta": 0.12,
                        "historyPlayCount": 2,
                    },
                },
            },
            {
                "event_timestamp": "2026-07-01T10:05:00Z",
                "action": "ignore",
                "label": "negative",
                "item_type": "artist",
                "item_name": "Artist Two",
                "item_artist": "",
            },
            {
                "event_timestamp": "2026-07-01T10:10:00Z",
                "action": "open_spotify",
                "label": "neutral",
                "item_type": "song",
                "item_name": "Song C",
                "item_artist": "Artist Three",
            },
        ]
    )
    feedback_events["event_timestamp"] = pd.to_datetime(
        feedback_events["event_timestamp"],
        utc=True,
    )

    labeled_tracks = join_feedback_labels_to_track_features(
        track_features,
        feedback_events,
        include_artist_feedback=True,
    )

    label_by_track = dict(
        zip(labeled_tracks["track_name"], labeled_tracks["liked_label"])
    )
    source_by_track = dict(
        zip(labeled_tracks["track_name"], labeled_tracks["label_source"])
    )

    assert label_by_track == {
        "Song A": 1.0,
        "Song B": 0.0,
    }
    assert source_by_track == {
        "Song A": "song_feedback",
        "Song B": "artist_feedback",
    }

    song_a = labeled_tracks[labeled_tracks["track_name"] == "Song A"].iloc[0]

    assert song_a["recommendation_source"] == "catalog-backfill"
    assert song_a["feedback_model_score"] == 0.82
    assert song_a["feedback_relative_match"] == 94
    assert song_a["feedback_similarity_score"] == 0.7
    assert song_a["feedback_quality_score"] == 0.8
    assert song_a["feedback_confidence"] == 0.75
    assert song_a["feedback_recency_score"] == 0.6
    assert song_a["feedback_known_track_penalty"] == 0.1
    assert song_a["feedback_diversity_penalty"] == 0.05
    assert song_a["feedback_score_delta"] == 0.12
    assert song_a["feedback_history_play_count"] == 2
    assert song_a["feedback_is_catalog_backfill"] == 1.0


def test_hybrid_feedback_overrides_proxy_labels():
    track_features = pd.DataFrame(
        [
            {
                "track_name": "Song A",
                "artist_name": "Artist One",
                "album_name": "Album A",
                "streams": 50,
                "listen_strength": 100,
                "recent_listen_strength": 80,
                "skip_rate": 0.1,
                "avg_minutes_per_stream": 3.0,
            },
            {
                "track_name": "Song B",
                "artist_name": "Artist Two",
                "album_name": "Album B",
                "streams": 1,
                "listen_strength": 0.1,
                "recent_listen_strength": 0,
                "skip_rate": 0.9,
                "avg_minutes_per_stream": 0.2,
            },
            {
                "track_name": "Song C",
                "artist_name": "Artist Three",
                "album_name": "Album C",
                "streams": 6,
                "listen_strength": 6,
                "recent_listen_strength": 2,
                "skip_rate": 0.4,
                "avg_minutes_per_stream": 2.0,
            },
        ]
    )
    events = {
        "events": [
            {
                "timestamp": "2026-07-20T10:00:00Z",
                "action": "ignore",
                "label": "negative",
                "item_type": "song",
                "item_name": "Song A",
                "item_artist": "Artist One",
            },
            {
                "timestamp": "2026-07-20T10:05:00Z",
                "action": "like",
                "label": "positive",
                "item_type": "artist",
                "item_name": "Artist Two",
            },
        ]
    }

    with TemporaryDirectory() as temp_dir:
        feedback_path = Path(temp_dir) / "events.json"
        feedback_path.write_text(json.dumps(events), encoding="utf-8")

        hybrid_tracks = build_hybrid_feedback_frame(
            track_features,
            feedback_path=str(feedback_path),
        )
        weighted_tracks = add_training_sample_weights(
            hybrid_tracks,
            real_feedback_weight=7,
            proxy_weight=1,
        )

    by_track = weighted_tracks.set_index("track_name")

    assert by_track.loc["Song A", "liked_label"] == 0.0
    assert by_track.loc["Song A", "label_source"] == "song_feedback"
    assert by_track.loc["Song A", "sample_weight"] == 7
    assert by_track.loc["Song B", "liked_label"] == 1.0
    assert by_track.loc["Song B", "label_source"] == "artist_feedback"
    assert by_track.loc["Song B", "sample_weight"] == 7


if __name__ == "__main__":
    test_feedback_labels_join_to_tracks()
    test_hybrid_feedback_overrides_proxy_labels()
    print("Feedback dataset tests passed")
