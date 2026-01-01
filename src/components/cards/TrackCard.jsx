function TrackCard({ title, artist, image }) {
  return (
    <div className="bg-[#181818] hover:bg-[#252525] transition p-4 rounded-lg w-[180px]">
      <img src={image} className="mb-2" />
      <h3 className="text-sm font-semibold truncate">{title}</h3>
      <p className="text-xs text-gray-400 truncate">{artist}</p>
    </div>
  );
}

export default TrackCard;
