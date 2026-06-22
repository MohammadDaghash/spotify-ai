// src/components/cards/TrackCard.jsx
function TrackCard({
  title = "Unknown title",
  artist = "Unknown artist",
  image = "",
}) {
  return (
    <div className="bg-[#181818] hover:bg-[#252525] transition p-4 rounded-lg w-[180px]">
      {image ? (
        <img
          src={image}
          alt={title}
          className="artwork-frame mb-3 w-full h-[140px] object-cover rounded"
          loading="lazy"
        />
      ) : (
        <div className="artwork-frame mb-3 w-full h-[140px] rounded bg-[#2a2a2a] flex items-center justify-center text-sm text-gray-300">
          No image
        </div>
      )}

      <h3 className="text-sm font-semibold truncate">{title}</h3>
      <p className="text-xs text-gray-400 truncate">{artist}</p>
    </div>
  );
}

export default TrackCard;
