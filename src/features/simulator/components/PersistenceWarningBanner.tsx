import { AlertTriangle } from 'lucide-react';

interface PersistenceWarningBannerProps {
    message?: string | null;
}

export function PersistenceWarningBanner({ message }: PersistenceWarningBannerProps) {
    if (!message) return null;

    return (
        <div
            role="status"
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 shadow-sm"
        >
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <div>
                    <p className="font-bold">Comparativa pendiente de guardar</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-800">{message}</p>
                </div>
            </div>
        </div>
    );
}
