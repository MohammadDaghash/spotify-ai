import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  delay,
  getBestSpotifyImage,
  getRetryAfterMs,
  getStoredRankingImages,
  IMAGE_LOOKUP_DELAY_MS,
  storeRankingImages,
} from "../utils/dashboardImageUtils.js";

export function useDashboardRankingImages({
  canLoadSpotifyArtwork,
  rankingImageRows,
  searchAlbum,
  searchArtist,
  searchTrack,
}) {
  const [rankingImages, setRankingImages] = useState(getStoredRankingImages);
  const [rankingImageStatus, setRankingImageStatus] = useState({
    requested: 0,
    loaded: 0,
    failed: 0,
    done: false,
    rateLimited: false,
    authError: false,
  });
  const [imageLoadVersion, setImageLoadVersion] = useState(0);
  const rankingImagesRef = useRef(rankingImages);

  useEffect(() => {
    rankingImagesRef.current = rankingImages;
  }, [rankingImages]);

  const rankingImageRequestKey = useMemo(() => {
    return rankingImageRows
      .map((row) => row.imageKey)
      .join("|");
  }, [rankingImageRows]);

  const cachedRankingImageCount = useMemo(() => {
    return rankingImageRows.filter((row) => rankingImages[row.imageKey]).length;
  }, [rankingImageRows, rankingImages]);

  const retryRankingImages = () => {
    setRankingImages({});
    rankingImagesRef.current = {};
    storeRankingImages({});
    setRankingImageStatus({
      requested: 0,
      loaded: 0,
      failed: 0,
      done: false,
      rateLimited: false,
      authError: false,
    });
    setImageLoadVersion((version) => version + 1);
  };

  const removeBrokenRankingImage = (imageKey) => {
    if (!imageKey) return;

    setRankingImages((prev) => {
      if (!prev[imageKey]) return prev;

      const nextImages = { ...prev };
      delete nextImages[imageKey];
      storeRankingImages(nextImages);
      return nextImages;
    });
  };

  const addImagesToRows = useCallback(
    (rows) =>
      rows.map((row) => ({
        ...row,
        imageUrl: rankingImages[row.imageKey],
      })),
    [rankingImages],
  );

  useEffect(() => {
    if (!rankingImageRequestKey) return;

    if (!canLoadSpotifyArtwork) {
      setRankingImageStatus({
        requested: 0,
        loaded: 0,
        failed: 0,
        done: true,
        rateLimited: false,
        authError: false,
      });
      return;
    }

    let isCancelled = false;
    const rows = rankingImageRows;

    async function fetchRowImage(row) {
      if (row.imageType === "artist") {
        const artist = await searchArtist(row.name);
        return getBestSpotifyImage(artist?.images);
      }

      if (row.imageType === "album") {
        const album = await searchAlbum(row.name, row.artistName);
        return getBestSpotifyImage(album?.images);
      }

      const track = await searchTrack(row.name, row.artistName);
      const trackImage = getBestSpotifyImage(track?.album?.images);

      if (trackImage || !row.albumName) {
        return trackImage;
      }

      const album = await searchAlbum(row.albumName, row.artistName);
      return getBestSpotifyImage(album?.images);
    }

    async function loadRankingImages() {
      const missingRows = rows.filter(
        (row) => !rankingImagesRef.current[row.imageKey],
      );

      setRankingImageStatus({
        requested: missingRows.length,
        loaded: 0,
        failed: 0,
        done: missingRows.length === 0,
        rateLimited: false,
        authError: false,
      });

      for (const row of missingRows) {
        if (isCancelled) return;

        try {
          let imageUrl = "";

          try {
            imageUrl = await fetchRowImage(row);
          } catch (error) {
            const retryAfterMs = getRetryAfterMs(error);

            if (retryAfterMs > 0) {
              setRankingImageStatus((status) => ({
                ...status,
                rateLimited: true,
              }));
              await delay(retryAfterMs);
              if (isCancelled) return;
              imageUrl = await fetchRowImage(row);
            } else {
              throw error;
            }
          }

          if (imageUrl) {
            setRankingImages((prev) => {
              if (prev[row.imageKey]) {
                return prev;
              }

              const mergedImages = {
                ...prev,
                [row.imageKey]: imageUrl,
              };
              storeRankingImages(mergedImages);
              return mergedImages;
            });
            setRankingImageStatus((status) => ({
              ...status,
              loaded: status.loaded + 1,
            }));
          } else {
            setRankingImageStatus((status) => ({
              ...status,
              failed: status.failed + 1,
            }));
          }

          await delay(IMAGE_LOOKUP_DELAY_MS);
        } catch (error) {
          setRankingImageStatus((status) => ({
            ...status,
            failed: status.failed + 1,
            authError:
              status.authError ||
              error?.response?.status === 401 ||
              error?.response?.status === 403,
            rateLimited: status.rateLimited || error?.response?.status === 429,
          }));
          console.warn("Could not load ranking image", row.name, error);
        }
      }

      if (!isCancelled) {
        setRankingImageStatus((status) => ({
          ...status,
          done: true,
        }));
      }
    }

    loadRankingImages();

    return () => {
      isCancelled = true;
    };
  }, [
    imageLoadVersion,
    rankingImageRequestKey,
    rankingImageRows,
    searchAlbum,
    searchArtist,
    searchTrack,
    canLoadSpotifyArtwork,
  ]);

  return {
    addImagesToRows,
    cachedRankingImageCount,
    rankingImageStatus,
    removeBrokenRankingImage,
    retryRankingImages,
  };
}
