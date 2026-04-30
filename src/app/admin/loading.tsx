import { SkeletonCard, SkeletonKpi, SkeletonTable } from '@/components/ui/LoadingStates';

export default function AdminLoading() {
    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonKpi key={i} />
                ))}
            </div>
            <SkeletonCard />
            <SkeletonTable rows={6} cols={5} />
        </div>
    );
}
