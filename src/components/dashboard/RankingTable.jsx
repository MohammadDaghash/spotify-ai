import RankMovementBadge from "../RankMovementBadge.jsx";

function getFallbackInitial(row) {
  return (row.name || row.artistName || row.albumName || "?").trim().slice(0, 1);
}

function RankingImage({ row, onImageError }) {
  const isArtist = row.imageType === "artist";
  const shapeClass = isArtist ? "rounded-full" : "rounded";

  if (row.imageUrl) {
    return (
      <img
        src={row.imageUrl}
        alt={
          row.name ||
          row.artistName ||
          row.albumName ||
          "Ranking cover or artist image"
        }
        className={`artwork-frame h-12 w-12 object-cover bg-[#2a2a2a] ${shapeClass}`}
        loading="lazy"
        onError={() => onImageError?.(row.imageKey)}
      />
    );
  }

  return (
    <div
      className={`artwork-frame h-12 w-12 bg-[#2a2a2a] text-gray-300 flex items-center justify-center text-sm font-bold ${shapeClass}`}
    >
      {getFallbackInitial(row)}
    </div>
  );
}

function RankingTable({ title, rows, columns, onImageError }) {
  return (
    <div className="bg-[#181818] rounded-lg p-5">
      <h2 className="mb-5 text-lg font-bold">{title}</h2>

      <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
        {rows.length > 0 ? (
          rows.map((row, index) => (
            <div
              key={`${title}-${index}-${row.name || ""}-${row.artistName || ""}-${row.albumName || ""}`}
              className="music-table-row grid grid-cols-[42px_48px_1fr_auto] gap-3 items-center border-b border-white/5 p-2"
            >
              <div>
                <span className="block text-gray-400">#{row.rank || index + 1}</span>
                <RankMovementBadge row={row} />
              </div>

              <RankingImage row={row} onImageError={onImageError} />

              <div>
                <p className="font-semibold">
                  {row.name || row.trackName || row.albumName || row.artistName}
                </p>

                <p className="text-xs text-gray-400">
                  {columns
                    .map((col) => row[col])
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-white">
                  {row.streams?.toLocaleString()} streams
                </p>

                <p className="text-xs text-gray-400">
                  {Math.round(row.minutes || 0).toLocaleString()} min
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-gray-400">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}

export default RankingTable;
