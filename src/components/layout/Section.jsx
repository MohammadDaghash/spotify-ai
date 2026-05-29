// src/components/layout/Section.jsx
function Section({ title = "", children = null }) {
  return (
    <div className="mb-20">
      <div className="flex justify-between items-center mb-10">
        <h2 className="font-bold text-lg">{title || "Section"}</h2>

        <button
          type="button"
          className="text-sm text-gray-400 hover:underline cursor-pointer"
        >
          Show all
        </button>
      </div>

      <div className="flex gap-2">
        {children ? (
          children
        ) : (
          <div className="text-sm text-gray-500">Nothing to show yet.</div>
        )}
      </div>
    </div>
  );
}

export default Section;
