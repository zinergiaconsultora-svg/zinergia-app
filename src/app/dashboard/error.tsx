'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className="h-full w-full flex items-center justify-center bg-[#F8F9FC]">
            <ErrorState
                title="Error en el Dashboard"
                description="No pudimos cargar esta sección del dashboard. Por favor intenta recargar."
                retry={reset}
            />
        </div>
    );
}
