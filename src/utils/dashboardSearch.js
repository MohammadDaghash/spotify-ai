import { normalizeTopbarSearchText } from "./topbarSearch.js";

export function rowMatchesDashboardSearch(row, query) {
  const normalizedQuery = normalizeTopbarSearchText(query);

  if (!normalizedQuery) return true;

  const rowText = normalizeTopbarSearchText(
    [
      row.name,
      row.trackName,
      row.artistName,
      row.albumName,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => rowText.includes(token));
}
