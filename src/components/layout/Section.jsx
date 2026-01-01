function Section({ title, children }) {
  return (
    <div className="mb-20">
      <div className="flex justify-between items-center mb-10">
        <h2 className="font-bold text-lg">{title}</h2>
        <span className="text-sm text-gray-400 hover:underline cursor-pointer">
          Show all
        </span>
      </div>

      <div className="flex gap-2">
        {children}
      </div>
    </div>
  );
}

export default Section;
