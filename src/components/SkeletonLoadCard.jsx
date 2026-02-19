export default function SkeletonLoadCard() {
  return (
    <div className="w-full p-4 rounded-3xl bg-slate-800/40 border border-slate-700/50 relative overflow-hidden">
      {/* Price skeleton */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="skeleton-loader w-32 h-7 mb-2" />
          <div className="skeleton-loader w-24 h-3" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="skeleton-loader w-16 h-5 rounded-lg" />
          <div className="skeleton-loader w-14 h-5 rounded-full" />
        </div>
      </div>

      {/* Route skeleton */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/50 border border-slate-700/30 mb-3">
        <div className="flex-1">
          <div className="skeleton-loader w-12 h-2.5 mb-1.5" />
          <div className="skeleton-loader w-16 h-4" />
        </div>
        <div className="flex flex-col items-center">
          <div className="skeleton-loader w-10 h-2 mb-1" />
          <div className="skeleton-loader w-12 h-0.5" />
        </div>
        <div className="flex-1 flex flex-col items-end">
          <div className="skeleton-loader w-12 h-2.5 mb-1.5" />
          <div className="skeleton-loader w-16 h-4" />
        </div>
      </div>

      {/* Bottom info skeleton */}
      <div className="flex items-center justify-between">
        <div className="skeleton-loader w-16 h-3" />
        <div className="skeleton-loader w-12 h-3" />
        <div className="skeleton-loader w-20 h-3" />
      </div>
    </div>
  );
}
