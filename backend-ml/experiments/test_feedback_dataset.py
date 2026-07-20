import sys
from pathlib import Path

import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services.feedback_dataset import join_feedback_labels_to_track_features


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


if __name__ == "__main__":
    test_feedback_labels_join_to_tracks()
    print("Feedback dataset tests passed")
