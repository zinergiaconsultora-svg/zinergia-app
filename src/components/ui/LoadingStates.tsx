export function DashboardSkeleton() {
    return (
        <div className="space-y-6 p-6 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-32 bg-gray-200 rounded" />
                <div className="h-32 bg-gray-200 rounded" />
                <div className="h-32 bg-gray-200 rounded" />
            </div>
            <div className="h-64 bg-gray-200 rounded" />
        </div>
    )
}

export function SimulatorLoading() {
    return (
        <div className="space-y-8 p-6 max-w-4xl mx-auto animate-pulse">
            <div className="h-12 w-64 bg-gray-200 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-24 bg-gray-200 rounded" />
                <div className="h-24 bg-gray-200 rounded" />
            </div>
            <div className="h-96 bg-gray-200 rounded" />
        </div>
    )
}

export function SkeletonCard() {
    return (
        <div className="p-6 border rounded-lg space-y-4 animate-pulse">
            <div className="h-6 w-3/4 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 rounded" />
        </div>
    )
}

export function SkeletonKpi() {
    return (
        <div className="p-4 border rounded-lg animate-pulse">
            <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-3/4 bg-gray-200 rounded" />
        </div>
    )
}

export function SkeletonTable() {
    return (
        <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-gray-200 rounded" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
        </div>
    )
}
