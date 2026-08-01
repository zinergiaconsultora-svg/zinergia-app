export default function DashboardLoading() {
    return (
        <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-0" aria-label="Cargando trabajo">
            <div className="h-8 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-8 flex gap-2">
                {[96, 88, 92].map(width => (
                    <div
                        key={width}
                        className="h-9 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
                        style={{ width }}
                    />
                ))}
            </div>
            <div className="mt-5 h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-8 space-y-3">
                {[1, 2, 3, 4].map(item => (
                    <div key={item} className="h-20 animate-pulse bg-white dark:bg-slate-900" />
                ))}
            </div>
        </div>
    );
}
