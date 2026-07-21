import { useMemo } from "react";

import { allSpotifyHistory } from "../data/loadSpotifyHistory.js";
import { buildArtistStreamCountMap } from "../utils/artistStreamCounts.js";
import { buildTrackPlayCountMap } from "../utils/trackPlayCounts.js";

export function useRecommendationDiscoveryCounts({
  isPrivateRecommendationMode,
  localSpotifyHistory,
}) {
  return useMemo(() => {
    const history = isPrivateRecommendationMode
      ? localSpotifyHistory
      : allSpotifyHistory;

    return {
      artistStreamCounts: buildArtistStreamCountMap(history),
      trackPlayCounts: buildTrackPlayCountMap(history),
    };
  }, [isPrivateRecommendationMode, localSpotifyHistory]);
}
