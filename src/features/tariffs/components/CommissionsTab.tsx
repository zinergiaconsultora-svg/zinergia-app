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
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-900/40 border border-indigo-400/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-2">Porcentaje colaborador</p>
                        <p className="text-slate-200 text-xs max-w-sm leading-relaxed">El agente recibe este porcentaje de la subcomisión total acordada con la comercializadora por el cierre de contrato.</p>
                    </div>
                    <div className="text-right">
                        {editingPct && isAdmin ? (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                                <div className="relative">
                                    <input
                                        type="number" min="0" max="100" step="1"
                                        value={pctEdit}
                                        onChange={e => setPctEdit(e.target.value)}
                                        className="w-28 text-3xl font-black bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-center outline-none focus:bg-white/20 focus:border-white/40 transition-all shadow-inner"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 font-black text-xl">%</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <button type="button" onClick={handleSavePct} disabled={pending} className="px-4 py-2 bg-white text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-50 hover:shadow-lg transition-all disabled:opacity-50">Guardar</button>
                                    <button type="button" onClick={() => setEditingPct(false)} className="px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition-all">Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="text-5xl font-black">{Math.round(pct * 100)}<span className="text-2xl">%</span></div>
                                {isAdmin && (
                                    <button type="button" onClick={() => { setPctEdit(String(Math.round(pct * 100))); setEditingPct(true) }} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors">
                                        <Edit3 size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Commission Table */}
            <div className="flex items-center justify-between bg-white/40 backdrop-blur-md p-2 pl-5 rounded-2xl border border-white/60 shadow-sm mt-8 mb-4">
                <h3 className="font-black text-slate-800 text-sm">Reglas de comisión activas</h3>
                {isAdmin && (
                    <button type="button" onClick={() => setFormData(blankCommission())} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all">
                        <Plus size={14} /> Nueva regla
                    </button>
                )}
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-white">
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Compañía</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Modelo</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Tipo cliente</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Producto</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Consumo MWh</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Comisión bruta</th>
                            <th className="text-right px-3 py-3 font-semibold text-emerald-600">Colaborador recibe</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500">Servicio</th>
                            {isAdmin && <th className="px-3 py-3" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {rows.map(row => (
                            <tr key={row.id} className={`hover:bg-white hover:shadow-sm hover:scale-[1.002] relative z-0 hover:z-10 transition-all duration-300 ${!row.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                <td className="px-4 py-2.5 font-semibold text-slate-800">{row.company}</td>
                                <td className="px-3 py-2.5">
                                    {row.modelo ? (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${MODELO_COLORS[row.modelo] ?? 'bg-slate-100 text-slate-600'}`}>{row.modelo}</span>
                                    ) : <span className="text-slate-300">Todos</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className="flex items-center gap-1 text-slate-600">
                                        {row.tipo_cliente === 'PYME' ? <Building2 size={11} /> : <Users size={11} />}
                                        {row.tipo_cliente}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 max-w-[130px] truncate">{row.producto_tipo ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right text-slate-600">
                                    {row.consumption_min_mwh} – {row.consumption_max_mwh >= 9999999999 ? '∞' : row.consumption_max_mwh}
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{formatBruta(row)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{formatColaborador(row)}</td>
                                <td className="px-3 py-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.servicio === 'GAS' ? SUPPLY_COLORS.gas : SUPPLY_COLORS.electricity}`}>
                                        {row.servicio ?? '—'}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => setFormData(row)} className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 size={13} /></button>
                                            <button type="button" onClick={() => handleDelete(row.id)} className={`p-1.5 rounded-lg transition-colors ${deleteConfirm === row.id ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}>
                                                {deleteConfirm === row.id ? <span className="text-[9px] font-bold px-0.5">OK</span> : <Trash2 size={13} />}
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
