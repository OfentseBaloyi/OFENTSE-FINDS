import { LogoMark } from "@/components/brand/logo";

export function ExplorerPageSkeleton({ withCover = true }: { withCover?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {withCover && (
        <div className="bg-teal-900">
          <div className="container-page pb-12 pt-14">
            <div className="h-3 w-40 rounded bg-white/15" />
            <div className="mt-5 h-12 w-72 max-w-full rounded-lg bg-white/15" />
            <div className="mt-5 h-4 w-[32rem] max-w-full rounded bg-white/10" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-white/10" />
          </div>
        </div>
      )}
      <div className="container-page pt-5">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(360px,440px)_1fr]">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton h-[84px] w-[84px] shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="relative hidden h-[560px] overflow-hidden rounded-xl bg-sand lg:grid lg:place-items-center">
            <LogoMark className="h-14 w-14 animate-pulse opacity-60" />
          </div>
        </div>
      </div>
    </div>
  );
}
