import { Skeleton, SkeletonCard } from '@/components/ui/LoadingStates';

export default function SimulatorLoading() {
    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6 animate-in fade-in duration-300">
            <Skeleton height={32} width="50%" />
            <Skeleton height={16} width="70%" />
            <div className="mt-8 flex flex-col items-center justify-center gap-4 py-16">
                <Skeleton variant="circular" width={80} height={80} />
                <Skeleton height={20} width="40%" />
                <Skeleton height={14} width="60%" />
            </div>
            <SkeletonCard />
        </div>
    );
}
