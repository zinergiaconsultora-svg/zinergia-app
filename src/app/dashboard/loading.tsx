import { SkeletonCard, SkeletonKpi } from '@/components/ui/LoadingStates';

export default function DashboardLoading() {
    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonKpi key={i} />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    );
}
