// Streamed while the dynamic product page renders. Mirrors the two-column
// gallery / details layout so the structure is stable and no shift occurs when
// the real content arrives. Pure server component — zero client JS.

function HeaderBar() {
  return (
    <div
      className="fixed top-0 left-0 z-50 flex w-full items-center justify-between gap-3 border-b border-[rgba(115,92,0,0.12)] bg-[rgba(249,249,247,0.95)] px-[clamp(0.75rem,2vw,2rem)] py-3 backdrop-blur-sm md:py-4"
      aria-hidden="true"
    >
      <div className="nej-skeleton h-6 w-44 rounded md:h-7" />
      <div className="flex items-center gap-3">
        <div className="nej-skeleton h-7 w-7 rounded-full" />
        <div className="nej-skeleton h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export default function ProductLoading() {
  return (
    <main className="pt-24 md:pt-28 pb-20" aria-busy="true" aria-label="Loading product">
      <HeaderBar />
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
        {/* Breadcrumb */}
        <div className="nej-skeleton mb-6 h-3 w-48 rounded" />

        <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div className="flex flex-col gap-3">
            <div className="nej-skeleton aspect-square w-full rounded-2xl" />
            <div className="grid grid-cols-4 gap-2">
              <div className="nej-skeleton aspect-square rounded-lg" />
              <div className="nej-skeleton aspect-square rounded-lg" />
              <div className="nej-skeleton aspect-square rounded-lg" />
              <div className="nej-skeleton aspect-square rounded-lg" />
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4">
            <div className="nej-skeleton h-3 w-28 rounded" />
            <div className="nej-skeleton h-8 w-[85%] rounded" />
            <div className="nej-skeleton h-8 w-[55%] rounded" />
            <div className="nej-skeleton mt-2 h-10 w-40 rounded" />

            {/* Spec grid */}
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              <div className="nej-skeleton h-12 rounded-lg" />
              <div className="nej-skeleton h-12 rounded-lg" />
              <div className="nej-skeleton h-12 rounded-lg" />
              <div className="nej-skeleton h-12 rounded-lg" />
            </div>

            {/* Description lines */}
            <div className="mt-3 flex flex-col gap-2">
              <div className="nej-skeleton h-4 w-full rounded" />
              <div className="nej-skeleton h-4 w-[95%] rounded" />
              <div className="nej-skeleton h-4 w-[88%] rounded" />
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
              <div className="nej-skeleton h-12 w-full rounded-full sm:w-48" />
              <div className="nej-skeleton h-12 w-full rounded-full sm:w-40" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
