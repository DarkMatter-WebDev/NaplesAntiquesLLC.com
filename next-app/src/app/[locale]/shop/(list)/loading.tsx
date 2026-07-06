// Streamed instantly while the dynamic /shop page renders on the server. It
// mirrors the real catalog layout (fixed-header spacer, hero band, filter bar,
// product grid) so the structure appears immediately and the live content swaps
// in without a layout shift. Pure server component — zero client JS.

const SKELETON_CARD_COUNT = 12;

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[rgba(115,92,0,0.12)] bg-white/60 p-2.5">
      {/* Square image well — reserves the same aspect ratio as a real card */}
      <div className="nej-skeleton aspect-square w-full rounded-lg" />
      {/* Title (two lines) */}
      <div className="nej-skeleton mt-1 h-3.5 w-[92%] rounded" />
      <div className="nej-skeleton h-3.5 w-[64%] rounded" />
      {/* Price */}
      <div className="nej-skeleton mt-1 h-5 w-[45%] rounded" />
      {/* Spec chips row */}
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        <div className="nej-skeleton h-6 rounded-md" />
        <div className="nej-skeleton h-6 rounded-md" />
        <div className="nej-skeleton h-6 rounded-md" />
      </div>
      {/* Action button */}
      <div className="nej-skeleton mt-1 h-9 w-full rounded-full" />
    </div>
  );
}

function HeaderBar() {
  // Matches the real fixed header's height/position so nothing jumps when the
  // live <SiteHeader> (rendered by the page) replaces it.
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

export default function ShopLoading() {
  return (
    <main className="pt-20 md:pt-28 pb-20" aria-busy="true" aria-label="Loading shop">
      <HeaderBar />
      <div className="mx-auto w-full max-w-[2400px] px-[clamp(1rem,3vw,3rem)]">
        {/* Hero band */}
        <div className="mb-6 md:mb-8 overflow-hidden rounded-2xl border border-[rgba(115,92,0,0.16)] bg-white/50 px-6 py-8 md:px-14 md:py-12">
          <div className="nej-skeleton h-3 w-40 rounded" />
          <div className="nej-skeleton mt-4 h-8 w-2/3 max-w-md rounded md:h-10" />
          <div className="nej-skeleton mt-4 hidden h-4 w-full max-w-xl rounded md:block" />
          <div className="nej-skeleton mt-2 hidden h-4 w-3/4 max-w-md rounded md:block" />
        </div>

        {/* Filter toolbar row */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="nej-skeleton h-10 w-32 rounded-full" />
          <div className="nej-skeleton h-10 w-40 rounded-lg" />
        </div>

        {/* Product grid — responsive columns approximate the live grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
