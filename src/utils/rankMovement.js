const ALBUM_EDITION_PATTERN =
  /\s*(?:(?:\(|\[|\{)\s*(?:.*?\bdeluxe\b.*?|.*?\bexpanded\b.*?|.*?\bbonus\b.*?|.*?\banniversary\b.*?|.*?\bremaster(?:ed)?\b.*?|.*?\bspecial\b.*?\bedition\b.*?|.*?\bcomplete\b.*?)\s*(?:\)|\]|\})|(?:-|–|—|:)\s*(?:.*?\bdeluxe\b.*?|.*?\bexpanded\b.*?|.*?\bbonus\b.*?|.*?\banniversary\b.*?|.*?\bremaster(?:ed)?\b.*?|.*?\bspecial\b.*?\bedition\b.*?|.*?\bcomplete\b.*?)|\s+(?:\bdeluxe\b.*?|\bexpanded\b.*?|\bbonus\b.*?|\banniversary\b.*?|\bremaster(?:ed)?\b.*?|\bspecial\b.*?\bedition\b.*?|\bcomplete\b.*?))\s*$/i;

function normalizeRankKeyPart(value, fieldName = "") {
  let normalizedValue = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .trim();

  if (/album/i.test(fieldName)) {
    let previousValue = "";

    while (normalizedValue && previousValue !== normalizedValue) {
      previousValue = normalizedValue;
      normalizedValue = normalizedValue.replace(ALBUM_EDITION_PATTERN, "").trim();
    }
  }

  return normalizedValue.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function getRowKey(row, keyFields) {
  return keyFields
    .map((field) => normalizeRankKeyPart(row?.[field], field))
    .join("::");
}

export function getRankMovement(currentRank, previousRank) {
  if (previousRank === undefined || previousRank === null) {
    return {
      previous_rank: null,
      rank_change: null,
      rank_direction: "new",
    };
  }

  const safeCurrentRank = Number(currentRank);
  const safePreviousRank = Number(previousRank);

  if (!Number.isFinite(safeCurrentRank) || !Number.isFinite(safePreviousRank)) {
    return {
      previous_rank: null,
      rank_change: null,
      rank_direction: "new",
    };
  }

  const rankChange = safePreviousRank - safeCurrentRank;

  if (safeCurrentRank < safePreviousRank) {
    return {
      previous_rank: safePreviousRank,
      rank_change: rankChange,
      rank_direction: "up",
    };
  }

  if (safeCurrentRank > safePreviousRank) {
    return {
      previous_rank: safePreviousRank,
      rank_change: rankChange,
      rank_direction: "down",
    };
  }

  return {
    previous_rank: safePreviousRank,
    rank_change: 0,
    rank_direction: "same",
  };
}

export function addRankMovementToRows(currentRows, previousRows, keyFields) {
  const previousRankByKey = new Map(
    (previousRows || [])
      .filter((row) => getRowKey(row, keyFields))
      .map((row, index) => [
        getRowKey(row, keyFields),
        Number(row.rank || index + 1),
      ]),
  );

  return (currentRows || []).map((row, index) => {
    const rank = Number(row.rank || index + 1);
    const previousRank = previousRankByKey.get(getRowKey(row, keyFields));
    const movement = getRankMovement(rank, previousRank);

    return {
      ...row,
      rank,
      ...movement,
    };
  });
}

export function getPreviousHistoryWindow(
  history,
  { timeRange = "all", selectedYear = "all", now = new Date() } = {},
) {
  const datedHistory = (history || []).filter((item) => {
    const playedAt = new Date(item.ts);
    return !Number.isNaN(playedAt.getTime());
  });

  if (selectedYear !== "all") {
    const currentYear = Number(selectedYear);

    if (!Number.isFinite(currentYear)) return [];

    return datedHistory.filter(
      (item) => new Date(item.ts).getFullYear() === currentYear - 1,
    );
  }

  if (timeRange === "30d") {
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 30);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 30);

    return datedHistory.filter((item) => {
      const playedAt = new Date(item.ts);
      return playedAt >= previousStart && playedAt < currentStart;
    });
  }

  if (timeRange === "6m") {
    const currentStart = new Date(now);
    currentStart.setMonth(currentStart.getMonth() - 6);

    const previousStart = new Date(currentStart);
    previousStart.setMonth(previousStart.getMonth() - 6);

    return datedHistory.filter((item) => {
      const playedAt = new Date(item.ts);
      return playedAt >= previousStart && playedAt < currentStart;
    });
  }

  const previousCutoff = new Date(now);
  previousCutoff.setDate(previousCutoff.getDate() - 30);

  return datedHistory.filter((item) => new Date(item.ts) < previousCutoff);
}
