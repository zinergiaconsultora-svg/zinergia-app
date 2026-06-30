'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { SupplyPoint, SupplyType } from '@/types/energy';
import { createSupplyPointAction, deleteSupplyPointAction, getSupplyPointsAction } from '@/app/actions/energy';
import { Zap, Flame, Plus, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    clientId: string;
}

export default function SupplyPointsPanel({ clientId }: Props) {
    const [points, setPoints] = useState<SupplyPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newCups, setNewCups] = useState('');
    const [newType, setNewType] = useState<SupplyType>('electricity');
    const [newAddress, setNewAddress] = useState('');
    const [newMarketer, setNewMarketer] = useState('');

    const loadPoints = useCallback(async () => {
        try {
            const data = await getSupplyPointsAction(clientId);
            setPoints(data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los suministros');
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        loadPoints();
    }, [loadPoints]);

    async function addPoint() {
        if (!newCups.trim()) return toast.error('El CUPS es obligatorio');
        try {
            await createSupplyPointAction({
                clientId,
                cups: newCups.trim(),
                supplyType: newType,
                address: newAddress,
                currentMarketer: newMarketer,
            });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al crear punto de suministro');
            return;
        }
        toast.success('Punto de suministro añadido');
        setNewCups(''); setNewAddress(''); setNewMarketer('');
        setShowForm(false);
        loadPoints();
    }

    async function deletePoint(id: string) {
        try {
            await deleteSupplyPointAction(id, clientId);
            setPoints(prev => prev.filter(p => p.id !== id));
            toast.success('Punto eliminado');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
        }
    }

    if (loading) return <div className="h-24 animate-pulse bg-slate-100 rounded-xl" />;

    return (
        <div className="space-y-2">
            {points.length === 0 && !showForm && (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400 mb-2">Sin puntos de suministro registrados</p>
                </div>
            )}

            {points.map(point => (
                <div key={point.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 group">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        point.supply_type === 'gas'
                            ? 'bg-orange-50 text-orange-600'
                            : 'bg-amber-50 text-amber-600'
                    }`}>
                        {point.supply_type === 'gas' ? <Flame size={16} /> : <Zap size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-800 font-mono tracking-wide truncate">{point.cups}</p>
                            {point.is_primary && (
                                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 shrink-0">PRINCIPAL</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            {point.address && <span className="flex items-center gap-0.5 truncate"><MapPin size={9} /> {point.address}</span>}
                            {point.current_marketer && <span className="truncate">{point.current_marketer}</span>}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => deletePoint(point.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 shrink-0"
                        aria-label="Eliminar punto de suministro"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}

            {/* Inline add form */}
            {showForm ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCups}
                            onChange={e => setNewCups(e.target.value.toUpperCase())}
                            placeholder="CUPS (ES...)"
                            aria-label="CUPS del nuevo punto de suministro"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                        <select
                            value={newType}
                            onChange={e => setNewType(e.target.value as SupplyType)}
                            aria-label="Tipo de energía"
                            className="px-2 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="electricity">Luz</option>
                            <option value="gas">Gas</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newAddress}
                            onChange={e => setNewAddress(e.target.value)}
                            placeholder="Dirección (opcional)"
                            aria-label="Dirección del punto de suministro"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                            type="text"
                            value={newMarketer}
                            onChange={e => setNewMarketer(e.target.value)}
                            placeholder="Comercializadora"
                            aria-label="Comercializadora actual"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={addPoint} className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                            Añadir
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all"
                >
                    <Plus size={14} /> Añadir punto de suministro
                </button>
            )}
        </div>
    );
}
