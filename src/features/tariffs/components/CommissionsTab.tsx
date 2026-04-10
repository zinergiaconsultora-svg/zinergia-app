'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, BadgePercent, Users, Building2 } from 'lucide-react'
import { TariffCommissionRow, deleteTariffCommission, saveCollaboratorPct } from '@/app/actions/tariffs'
import { MODELO_COLORS, SUPPLY_COLORS, blankCommission } from './tariff-form-utils'
import { CommissionFormPanel } from './CommissionFormPanel'

interface Props {
    rows: TariffCommissionRow[]
    collaboratorPct: number
    isAdmin: boolean
    onUpdate: (updated: TariffCommissionRow[], deleted?: string) => void
    onPctSaved?: (pct: number) => void
}

export function CommissionsTab({ rows, collaboratorPct: initPct, isAdmin, onUpdate, onPctSaved }: Props) {
    const [pct, setPct] = useState(initPct)
    const [pctEdit, setPctEdit] = useState(String(Math.round(initPct * 100)))
    const [editingPct, setEditingPct] = useState(false)
    const [formData, setFormData] = useState<Partial<TariffCommissionRow> | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [pending, start] = useTransition()

    const handleSavePct = () => start(async () => {
        const val = parseFloat(pctEdit) / 100
        if (isNaN(val) || val < 0 || val > 1) { toast.error('Introduce un valor entre 0 y 100'); return }
        try {
            await saveCollaboratorPct(val)
            setPct(val)
            onPctSaved?.(val)
            setEditingPct(false)
            toast.success('% colaborador actualizado')
        } catch (e) { toast.error((e as Error).message) }
    })

    const handleDelete = (id: string) => {
        if (deleteConfirm !== id) { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); return }
        start(async () => {
            try { await deleteTariffCommission(id); onUpdate(rows, id); toast.success('Comisión eliminada') }
            catch (e) { toast.error((e as Error).message) }
            setDeleteConfirm(null)
        })
    }

    const formatBruta = (row: TariffCommissionRow) => {
        if (row.commission_fixed_eur > 0) return `${row.commission_fixed_eur.toFixed(2)} €/contrato`
        if (row.commission_variable_mwh > 0) return `${row.commission_variable_mwh.toFixed(2)} €/MWh`
        return '—'
    }

    const formatColaborador = (row: TariffCommissionRow) => {
        if (row.commission_fixed_eur > 0) return `${(row.commission_fixed_eur * pct).toFixed(2)} €/contrato`
        if (row.commission_variable_mwh > 0) return `${(row.commission_variable_mwh * pct).toFixed(2)} €/MWh`
        return '—'
    }

    return (
        <div className="space-y-6">
            {formData && (
                <CommissionFormPanel
                    data={formData}
                    onClose={() => setFormData(null)}
                    onSaved={saved => {
                        const exists = rows.find(r => r.id === saved.id)
                        onUpdate(exists ? rows.map(r => r.id === saved.id ? saved : r) : [saved, ...rows])
                        setFormData(null)
                    }}
                />
            )}

            {/* Collaborator % Card */}
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-2xl rounded-[1.5rem] p-6 shadow-sm shadow-slate-200/30 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl items-center justify-center text-indigo-600">
                        <BadgePercent size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-slate-900 text-sm font-bold tracking-tight">Condiciones del Colaborador</p>
                        <p className="text-slate-500 text-[11px] max-w-sm mt-0.5 leading-relaxed">El agente recibe este porcentaje de la subcomisión total por contrato válido.</p>
                    </div>
                </div>
                <div className="text-right">
                    {editingPct && isAdmin ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <div className="relative">
                                <input
                                    type="number" min="0" max="100" step="1"
                                    value={pctEdit}
                                    onChange={e => setPctEdit(e.target.value)}
                                    className="w-24 text-2xl font-black bg-white border border-slate-200 rounded-[1rem] px-3 py-2.5 text-slate-900 text-center outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <button type="button" onClick={handleSavePct} disabled={pending} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all disabled:opacity-50">Guardar</button>
                                <button type="button" onClick={() => setEditingPct(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all">Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="flex items-baseline gap-1 bg-slate-50/80 px-5 py-2.5 rounded-2xl border border-slate-100">
                                <span className="text-3xl font-light tracking-tight text-slate-800">{Math.round(pct * 100)}</span>
                                <span className="text-base font-medium text-slate-400">%</span>
                            </div>
                            {isAdmin && (
                                <button type="button" onClick={() => { setPctEdit(String(Math.round(pct * 100))); setEditingPct(true) }} className="p-2.5 bg-white border border-slate-200 rounded-[0.8rem] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 shadow-sm">
                                    <Edit3 size={16} strokeWidth={2} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Commission Table */}
            <div className="flex items-center justify-between mt-8 mb-4 px-1">
                <div>
                    <h3 className="font-bold text-slate-900 text-[15px] tracking-tight">Reglas de comisión activas</h3>
                    <p className="text-slate-500 text-[11px] mt-0.5">Configuración de márgenes por compañía y producto.</p>
                </div>
                {isAdmin && (
                    <button type="button" onClick={() => setFormData(blankCommission())} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12px] font-semibold rounded-xl hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/20 transition-all active:scale-95">
                        <Plus size={14} strokeWidth={2.5} /> Nueva regla
                    </button>
                )}
            </div>

            <div className="bg-white/80 backdrop-blur-2xl rounded-[1.5rem] border border-slate-200/60 shadow-sm shadow-slate-200/30 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200/60">
                            <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Compañía</th>
                            <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Modelo</th>
                            <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tipo cliente</th>
                            <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                            <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Consumo MWh</th>
                            <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Com. bruta</th>
                            <th className="text-right px-3 py-3 text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Colaborador</th>
                            <th className="text-center px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Servicio</th>
                            {isAdmin && <th className="px-3 py-3 w-20" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                        {rows.map(row => (
                            <tr key={row.id} className={`hover:bg-slate-50 hover:shadow-sm relative z-0 hover:z-10 transition-all duration-200 ${!row.is_active ? 'opacity-40 cursor-not-allowed' : 'bg-transparent'}`}>
                                <td className="px-4 py-3 font-semibold text-slate-900">{row.company}</td>
                                <td className="px-3 py-3">
                                    {row.modelo ? (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${MODELO_COLORS[row.modelo] ?? 'bg-slate-100 text-slate-600'}`}>{row.modelo}</span>
                                    ) : <span className="text-slate-300">Todos</span>}
                                </td>
                                <td className="px-3 py-3">
                                    <span className="flex items-center gap-1.5 text-slate-600">
                                        {row.tipo_cliente === 'PYME' ? <Building2 size={12} className="text-slate-400" /> : <Users size={12} className="text-slate-400" />}
                                        {row.tipo_cliente}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-slate-600 max-w-[140px] truncate">{row.producto_tipo ?? '—'}</td>
                                <td className="px-3 py-3 text-right text-slate-500 tabular-nums">
                                    {row.consumption_min_mwh} – {row.consumption_max_mwh >= 9999999999 ? '∞' : row.consumption_max_mwh}
                                </td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-800 tabular-nums">{formatBruta(row)}</td>
                                <td className="px-3 py-3 text-right">
                                    <span className="inline-block font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-lg text-[11px] tabular-nums">
                                        {formatColaborador(row)}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${row.servicio === 'GAS' ? SUPPLY_COLORS.gas : SUPPLY_COLORS.electricity}`}>
                                        {row.servicio ?? '—'}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-0.5">
                                            <button type="button" onClick={() => setFormData(row)} className="p-2 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90"><Edit3 size={14} /></button>
                                            <button type="button" onClick={() => handleDelete(row.id)} className={`p-2 rounded-lg transition-all active:scale-90 ${deleteConfirm === row.id ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}>
                                                {deleteConfirm === row.id ? <span className="text-[9px] font-bold px-0.5">OK</span> : <Trash2 size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={9} className="py-24">
                                    <div className="flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-2">
                                        <div className="w-16 h-16 bg-indigo-50/50 border border-indigo-100/50 rounded-[1.5rem] flex items-center justify-center mb-5 rotate-3 shadow-sm">
                                            <BadgePercent size={24} className="text-indigo-400" />
                                        </div>
                                        <p className="text-slate-700 font-extrabold text-sm mb-2">Sin reglas de comisión</p>
                                        <p className="text-slate-400 text-xs text-balance max-w-sm">No hay reglas de comisión configuradas. Añade reglas para que los agentes puedan visualizar los márgenes correspondientes de cada contrato.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
