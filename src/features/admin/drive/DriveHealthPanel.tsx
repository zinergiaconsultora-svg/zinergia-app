'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    CloudCheck,
    CloudOff,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    HardDrive,
    ShieldX,
    PlugZap,
    Database,
    FileWarning,
    Gauge,
    ShieldCheck,
} from 'lucide-react';
import { triggerDriveReconcileAction, connectDriveAction, type DriveHealth } from '@/app/actions/driveHealth';
import { StatCard } from '@/components/ui/StatCard';

function formatGB(bytes: number): string {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function DriveHealthPanel({ health }: { health: DriveHealth }) {
    const router = useRouter();
    const [running, setRunning] = useState(false);
    const [token, setToken] = useState('');
    const [connecting, setConnecting] = useState(false);

    async function connect() {
        if (!token.trim()) {
            toast.error('Pega el refresh token primero');
            return;
        }
        setConnecting(true);
        try {
            const res = await connectDriveAction(token.trim());
            if (res.success) {
                toast.success('Token guardado. Drive conectado.');
                setToken('');
                router.refresh();
            } else {
                toast.error(res.message ?? 'No se pudo conectar');
            }
        } catch {
            toast.error('No se pudo conectar');
        } finally {
            setConnecting(false);
        }
    }

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
    const syncPct = health.sync.total > 0 ? Math.round((health.sync.archived / health.sync.total) * 100) : 0;
    const statusMeta = !health.connected
        ? {
            label: 'Sin conectar',
            title: 'Drive pendiente de conexión',
            desc: 'Las facturas no se archivarán hasta guardar un refresh token válido.',
            icon: PlugZap,
            className: 'border-slate-200 bg-slate-50 text-slate-700',
            chip: 'bg-slate-200 text-slate-700',
        }
        : health.status === 'degraded'
            ? {
                label: 'Degradada',
                title: 'Drive requiere revisión',
                desc: 'Hay errores recientes en la integración. Revisa el token y reintenta el archivado.',
                icon: AlertTriangle,
                className: 'border-rose-200 bg-rose-50 text-rose-900',
                chip: 'bg-rose-100 text-rose-700',
            }
            : {
                label: 'Activa',
                title: 'Drive operativo',
                desc: 'La integración está configurada y lista para archivar facturas.',
                icon: CloudCheck,
                className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
                chip: 'bg-emerald-100 text-emerald-700',
            };
    const StatusIcon = statusMeta.icon;

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Infraestructura documental</p>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Panel de salud de Drive</h1>
                    <p className="text-sm text-slate-500">Archivado de facturas, cuota, reintentos y trazabilidad RGPD.</p>
                </div>
                <button
                    onClick={reconcile}
                    disabled={running}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                    <RefreshCw size={15} className={running ? 'animate-spin' : ''} />
                    {running ? 'Reintentando...' : 'Reintentar pendientes'}
                </button>
            </header>

            <section className={`rounded-3xl border p-5 shadow-sm ${statusMeta.className}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                            <StatusIcon size={22} />
                        </span>
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-black">{statusMeta.title}</h2>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusMeta.chip}`}>
                                    {statusMeta.label}
                                </span>
                            </div>
                            <p className="max-w-2xl text-sm opacity-80">{statusMeta.desc}</p>
                            {(health.status === 'degraded' || !health.connected) && (
                                <p className="mt-2 text-[12px] opacity-80">
                                    {health.lastError ? <>Último error: <strong>{health.lastError}</strong>. </> : null}
                                    Revisa <code className="rounded bg-white/70 px-1 font-mono">docs/google-drive-setup.md</code>.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[300px]">
                        <MiniMetric label="Config" value={health.configured ? 'OK' : 'NO'} tone={health.configured ? 'emerald' : 'rose'} />
                        <MiniMetric label="Token" value={health.connected ? 'OK' : 'NO'} tone={health.connected ? 'emerald' : 'amber'} />
                        <MiniMetric label="Sync" value={`${syncPct}%`} tone={health.sync.pending > 0 ? 'amber' : 'emerald'} />
                    </div>
                </div>
            </section>

            {/* Conectar / reconectar Drive */}
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-black text-slate-900">Conectar / reconectar Drive</h2>
                        <p className="text-[13px] text-slate-500">
                            Pega el refresh token. El servidor lo cifra y lo guarda en la integración.
                        </p>
                    </div>
                    <PlugZap size={18} className="text-slate-300" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="1//0..."
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 font-mono text-sm focus:border-energy-500 focus:ring-1 focus:ring-energy-500 outline-none"
                    />
                    <button
                        onClick={connect}
                        disabled={connecting}
                        className="shrink-0 py-2.5 px-4 rounded-xl bg-energy-600 text-white font-semibold hover:bg-energy-700 transition-colors disabled:opacity-50"
                    >
                        {connecting ? 'Guardando…' : 'Conectar Drive'}
                    </button>
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><HardDrive size={15} /> Archivado de facturas</h2>
                            <p className="text-[12px] text-slate-500">Progreso global de OCR → Drive.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{syncPct}% archivado</span>
                    </div>
                    <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(syncPct, 100)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard label="Total" value={health.sync.total} icon={Database} />
                        <StatCard label="Archivadas" value={health.sync.archived} icon={CloudCheck} tone="emerald" />
                        <StatCard label="Pendientes" value={health.sync.pending} icon={CloudOff} tone={health.sync.pending > 0 ? 'amber' : 'slate'} />
                        <StatCard label="OCR fallidas" value={health.sync.failed} icon={FileWarning} tone={health.sync.failed > 0 ? 'rose' : 'slate'} />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <OperationalHint
                            title="Pendientes"
                            text={health.sync.pending > 0 ? 'Ejecuta reintento y revisa credenciales si no bajan.' : 'No hay cola pendiente.'}
                            tone={health.sync.pending > 0 ? 'amber' : 'emerald'}
                        />
                        <OperationalHint
                            title="Errores OCR"
                            text={health.sync.failed > 0 ? 'Revisar cola OCR fallida en Leads.' : 'Sin fallos OCR acumulados.'}
                            tone={health.sync.failed > 0 ? 'rose' : 'emerald'}
                        />
                        <OperationalHint
                            title="RGPD"
                            text="Las purgas y huérfanos quedan auditados."
                            tone="slate"
                        />
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Gauge size={15} /> Cuota de Drive</h2>
                            <p className="text-[12px] text-slate-500">Capacidad disponible para facturas archivadas.</p>
                        </div>
                        {quotaPct !== null && (
                            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${quotaPct >= 80 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                {quotaPct}%
                            </span>
                        )}
                    </div>
                    {health.quota ? (
                        <>
                            <div className="mb-2 flex items-end justify-between gap-3">
                                <p className="text-2xl font-black tabular-nums text-slate-950">{formatGB(health.quota.usage)}</p>
                                <p className="pb-1 text-[12px] text-slate-500">{health.quota.limit ? `de ${formatGB(health.quota.limit)}` : 'sin límite informado'}</p>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${quotaTone}`} style={{ width: `${Math.min(quotaPct ?? 3, 100)}%` }} />
                            </div>
                            <p className={`mt-3 rounded-2xl px-3 py-2 text-[12px] ${quotaPct !== null && quotaPct >= 80 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {quotaPct !== null && quotaPct >= 80
                                    ? 'Cuota alta. Conviene liberar espacio o migrar a Google Workspace.'
                                    : 'Cuota dentro de un margen saludable.'}
                            </p>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-sm font-bold text-slate-700">Cuota no disponible</p>
                            <p className="mt-1 text-[12px] text-slate-500">Integración sin conectar, sin permisos o sin respuesta de Google.</p>
                            <div className="mt-3 space-y-1 text-[12px] text-slate-600">
                                <p>Configuración env: <strong className={health.configured ? 'text-emerald-700' : 'text-rose-700'}>{health.configured ? 'sí' : 'NO'}</strong></p>
                                <p>Token en BD: <strong className={health.connected ? 'text-emerald-700' : 'text-rose-700'}>{health.connected ? 'sí' : 'NO'}</strong></p>
                                <p className="break-words">Motivo: <span className="text-rose-600">{health.quotaError ?? '—'}</span></p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* RGPD */}
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldX size={15} /> Borrados RGPD recientes</h2>
                        <p className="text-[12px] text-slate-500">Supresiones y limpieza de huérfanos en Drive.</p>
                    </div>
                    <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                        <ShieldCheck size={16} />
                    </span>
                </div>
                {health.rgpd.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Sin borrados registrados.</p>
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
            </section>
        </div>
    );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'rose' }) {
    const toneClass = tone === 'emerald'
        ? 'text-emerald-700 bg-emerald-100'
        : tone === 'amber'
            ? 'text-amber-700 bg-amber-100'
            : 'text-rose-700 bg-rose-100';
    return (
        <div className="rounded-2xl bg-white/75 px-3 py-2 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{label}</p>
            <p className={`mt-1 rounded-xl px-2 py-1 text-sm font-black ${toneClass}`}>{value}</p>
        </div>
    );
}

function OperationalHint({ title, text, tone }: { title: string; text: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' }) {
    const dot = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'rose' ? 'bg-rose-500' : 'bg-slate-300';
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="mb-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                <p className="text-[12px] font-black text-slate-800">{title}</p>
            </div>
            <p className="text-[12px] leading-snug text-slate-500">{text}</p>
        </div>
    );
}
