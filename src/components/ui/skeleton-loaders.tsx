import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Shimmer({ className }: SkeletonProps) {
  return <div className={cn('skeleton-shimmer', className)} />;
}

export function PropertyCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Shimmer className="aspect-[4/3] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Shimmer className="h-5 w-3/4" />
        <Shimmer className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function GroupCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <Shimmer className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-5 w-2/3" />
        <div className="flex gap-3">
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-4 w-20" />
        </div>
      </div>
      <Shimmer className="h-8 w-12 rounded-lg flex-shrink-0" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Shimmer className="h-7 w-16" />
          <Shimmer className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function PropertyGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 stagger">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GroupListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 stagger">
      {Array.from({ length: count }).map((_, i) => (
        <GroupCardSkeleton key={i} />
      ))}
    </div>
  );
}
