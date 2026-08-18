import { Skeleton } from '@/components/ui/skeleton';

export default function CounterLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-5 w-40" />
    </div>
  );
}
