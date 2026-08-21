import { Skeleton } from '@/components/ui/skeleton';

export default function ExampleLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
