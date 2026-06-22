function getMovementAmount(row) {
  return Math.abs(Number(row?.rankChange ?? row?.rank_change ?? 0));
}

function getDirection(row) {
  return row?.rankDirection || row?.rank_direction || "new";
}

function RankMovementBadge({ row }) {
  const direction = getDirection(row);
  const movement = getMovementAmount(row);

  if (direction === "up") {
    return (
      <span
        title={`Up ${movement} rank${movement === 1 ? "" : "s"}`}
        className="inline-flex min-w-5 justify-center text-sm font-bold text-[#1db954]"
      >
        ↑{movement > 0 ? movement : ""}
      </span>
    );
  }

  if (direction === "down") {
    return (
      <span
        title={`Down ${movement} rank${movement === 1 ? "" : "s"}`}
        className="inline-flex min-w-5 justify-center text-sm font-bold text-red-400"
      >
        ↓{movement > 0 ? movement : ""}
      </span>
    );
  }

  if (direction === "same") {
    return (
      <span
        title="Same rank"
        className="inline-flex min-w-5 justify-center text-sm font-bold text-gray-300"
      >
        -
      </span>
    );
  }

  return (
    <span
      title="New in this ranking"
      className="inline-flex min-w-5 justify-center text-sm font-bold text-blue-400"
    >
      •
    </span>
  );
}

export default RankMovementBadge;
