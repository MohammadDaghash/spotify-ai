import { useMemo } from "react";

import { buildFeedbackPreferenceSignals } from "../utils/feedbackPreferenceSignals.js";
import { usePrivateFeedbackEvents } from "./usePrivateFeedbackEvents.js";

function mergeUnique(values) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeEventsById(events = []) {
  const byId = new Map();

  for (const event of events) {
    if (!event?.id) continue;
    byId.set(event.id, event);
  }

  return [...byId.values()];
}

export function useActiveRecommendationFeedback({
  feedbackEvents = [],
  ignoredArtists = [],
  ignoredSongs = [],
  likedArtists = [],
  likedSongs = [],
  sessionFeedbackEvents = [],
} = {}) {
  const privateFeedback = usePrivateFeedbackEvents({ limit: 500 });
  const isPersonalFeedbackActive = privateFeedback.user?.provider === "supabase";
  const activeFeedbackEvents = useMemo(() => {
    if (!isPersonalFeedbackActive) return feedbackEvents;

    return dedupeEventsById([
      ...privateFeedback.events,
      ...sessionFeedbackEvents,
    ]);
  }, [
    feedbackEvents,
    isPersonalFeedbackActive,
    privateFeedback.events,
    sessionFeedbackEvents,
  ]);
  const feedbackPreferenceSignals = useMemo(
    () => buildFeedbackPreferenceSignals(activeFeedbackEvents),
    [activeFeedbackEvents],
  );
  const feedbackLikedSongs = useMemo(
    () => mergeUnique([...likedSongs, ...feedbackPreferenceSignals.likedSongs]),
    [feedbackPreferenceSignals.likedSongs, likedSongs],
  );
  const feedbackIgnoredSongs = useMemo(
    () =>
      mergeUnique([...ignoredSongs, ...feedbackPreferenceSignals.ignoredSongs]),
    [feedbackPreferenceSignals.ignoredSongs, ignoredSongs],
  );
  const feedbackLikedArtists = useMemo(
    () =>
      mergeUnique([...likedArtists, ...feedbackPreferenceSignals.likedArtists]),
    [feedbackPreferenceSignals.likedArtists, likedArtists],
  );
  const feedbackIgnoredArtists = useMemo(
    () =>
      mergeUnique([
        ...ignoredArtists,
        ...feedbackPreferenceSignals.ignoredArtists,
      ]),
    [feedbackPreferenceSignals.ignoredArtists, ignoredArtists],
  );

  return {
    activeFeedbackEvents,
    feedbackIgnoredArtists,
    feedbackIgnoredSongs,
    feedbackLikedArtists,
    feedbackLikedSongs,
    feedbackPreferenceSignals,
    isPersonalFeedbackActive,
    privateFeedback,
  };
}
