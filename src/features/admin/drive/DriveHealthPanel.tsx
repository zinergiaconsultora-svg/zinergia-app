'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    CloudCheck,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    HardDrive,
    ShieldX,
    PlugZap,
} from 'lucide-react';
import { triggerDriveReconcileAction, type DriveHealth } from '@/app/actions/driveHealth';
import { StatCard } from '@/components/ui/StatCard';

function formatGB(bytes: number): string {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function DriveHealthPanel({ health }: { health: DriveHealth }) {
    const router = useRouter();
    const [running, setRunning] = useState(false);

    async function reconcile() {
        setRunning(true);
        try {
            const res = await triggerDriveReconcileAction();
            toast.success(`Reconciliación: ${res.archived} archivadas, ${res.failed} fallidas de ${res.processed}`);
            router.refresh();
        } catch {
            toast.error('No se pudo ejecutar la reconciliación');
        } finally {
            setRunning(false);
        }
    }

    const quotaPct =
        health.quota && health.quota.limit ? Math.round((health.quota.usage / health.quota.limit) * 100) : null;
    const quotaTone = quotaPct === null ? 'bg-slate-300' : quotaPct >= 80 ? 'bg-rose-500' : quotaPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="space-y-5">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Estado de Facturas / Drive</h1>
                <p className="text-sm text-slate-500">Salud del archivado en Drive, cuota y cumplimiento RGPD.</p>
            </header>

            {/* Integración */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            !health.connected ? 'bg-slate-100 text-slate-500'
                            : health.status === 'degraded' ? 'bg-rose-100 text-rose-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}>
                            {!health.connected ? <PlugZap size={18} /> : health.status === 'degraded' ? <AlertTriangle size={18} /> : <CloudCheck size={18} />}
                        </span>
                        <div>
                            <p className="font-bold text-slate-900">Integración Google Drive</p>
                            <p className="text-[13px] text-slate-500">
                                {!health.configured ? 'No configurada (faltan variables de entorno).'
                                    : !health.connected ? 'Sin conectar (no hay refresh token guardado).'
                                    : health.status === 'degraded' ? 'Degradada — requiere reconexión.'
                                    : 'Activa y funcionando.'}
                            </p>
                        </div>
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${
                        !health.connected ? 'bg-slate-100 text-slate-500'
                        : health.status === 'degraded' ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                        {!health.connected ? 'Sin conectar' : health.status === 'degraded' ? 'Degradada' : 'Activa'}
                    </span>
                </div>
                {(health.status === 'degraded' || !health.connected) && (
                    <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 text-[13px] text-amber-800">
                        {health.lastError && <p className="mb-1"><strong>Último error:</strong> {health.lastError}</p>}
                        Para reconectar: ejecuta <code className="font-mono bg-amber-100 px-1 rounded">scripts/google-drive-auth.mjs</code> y
                        guarda el token con <code className="font-mono bg-amber-100 px-1 rounded">google-drive-save-token.mjs</code>.
                        Ver <code className="font-mono">docs/google-drive-setup.md</code>.
                    </div>
                )}
            </div>

            {/* Sync */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><HardDrive size={15} /> Archivado en Drive</h2>
                    <button
                        onClick={reconcile}
                        disabled={running}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Reintentando…' : 'Reintentar ahora'}
                    </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total facturas" value={health.sync.total} />
                    <StatCard label="Archivadas" value={health.sync.archived} tone="emerald" />
                    <StatCard label="Pendientes" value={health.sync.pending} tone={health.sync.pending > 0 ? 'amber' : 'slate'} />
                    <StatCard label="OCR fallidas" value={health.sync.failed} tone={health.sync.failed > 0 ? 'rose' : 'slate'} />
                </div>
            </div>

            {/* Cuota */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-800 mb-3">Cuota de Drive</h2>
                {health.quota ? (
                    <>
                        <div className="flex items-center justify-between text-[13px] mb-1.5">
                            <span className="text-slate-600">
                                {formatGB(health.quota.usage)} {health.quota.limit ? `de ${formatGB(health.quota.limit)}` : '(sin límite)'}
                            </span>
                            {quotaPct !== null && <span className={`font-bold ${quotaPct >= 80 ? 'text-rose-600' : 'text-slate-600'}`}>{quotaPct}%</span>}
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${quotaTone}`} style={{ width: `${Math.min(quotaPct ?? 3, 100)}%` }} />
                        </div>
                        {quotaPct !== null && quotaPct >= 80 && (
                            <p className="mt-2 text-[12px] text-rose-600">Cuota alta — considera migrar a Google Workspace o liberar espacio.</p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-slate-400">No disponible (integración sin conectar o sin acceso).</p>
                )}
            </div>

            {/* RGPD */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><ShieldX size={15} /> Borrados RGPD recientes en Drive</h2>
                {health.rgpd.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin borrados registrados.</p>
                ) : (
                    <ul className="space-y-2">
                        {health.rgpd.map((e, i) => (
                            <li key={i} className="flex items-center justify-between text-[13px] border-t border-slate-50 pt-2 first:border-0 first:pt-0">
                                <span className="flex items-center gap-2 text-slate-600">
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    {e.action === 'rgpd_drive_orphan_deletion' ? 'Huérfano eliminado' : 'Borrado por supresión'}
                                    <span className="font-mono text-slate-400 truncate max-w-[160px]">{e.driveFileId ?? '—'}</span>
                                </span>
                                <span className="text-slate-400">{new Date(e.createdAt).toLocaleDateString('es-ES')}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
