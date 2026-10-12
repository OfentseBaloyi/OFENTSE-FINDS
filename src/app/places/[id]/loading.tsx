export default function Loading() {
  return (
    <div className="container-page pt-8" aria-busy="true" aria-label="Loading place">
      <div className="skeleton h-3 w-48" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <div className="skeleton aspect-[16/9] w-full rounded-2xl" />
          <div className="skeleton mt-6 h-5 w-28 rounded-full" />
          <div className="skeleton mt-3 h-10 w-3/4" />
          <div className="skeleton mt-3 h-4 w-1/2" />
        </div>
        <div className="space-y-5">
          <div className="skeleton h-64" />
          <div className="skeleton h-40" />
        </div>
      </div>
    </div>
  );
}
