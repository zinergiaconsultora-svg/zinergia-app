'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Search, AlertTriangle } from 'lucide-react'
import { TarifaRow, TariffCommissionRow, deleteTarifa, toggleTarifaActive } from '@/app/actions/tariffs'
import { MODELO_COLORS, fmt, blankTarifa } from './tariff-form-utils'
import { TarifaFormPanel } from './TarifaFormPanel'

interface Props {
    rows: TarifaRow[]
    commissions: TariffCommissionRow[]
    isAdmin: boolean
    onUpdate: (updated: TarifaRow[], deleted?: string) => void
}

export function ElectricityTab({ rows, commissions, isAdmin, onUpdate }: Props) {
    const [search, setSearch] = useState('')
    const [companyFilter, setCompanyFilter] = useState('ALL')
    const [formData, setFormData] = useState<Partial<TarifaRow> | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [pending, start] = useTransition()

    const companiesWithCommission = useMemo(
        () => new Set(commissions.filter(c => c.supply_type === 'electricity').map(c => c.company)),
        [commissions]
    )
    const companies = useMemo(() => [...new Set(rows.map(r => r.company))].sort(), [rows])
    const filtered = useMemo(() => rows.filter(r =>
        (companyFilter === 'ALL' || r.company === companyFilter) &&
        (r.tariff_name.toLowerCase().includes(search.toLowerCase()) || r.company.toLowerCase().includes(search.toLowerCase()))
    ), [rows, companyFilter, search])

    const handleToggle = (row: TarifaRow) => start(async () => {
        try {
            await toggleTarifaActive(row.id, !row.is_active)
            onUpdate(rows.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
        } catch (e) { toast.error((e as Error).message) }
    })

    const handleDelete = (id: string) => {
        if (deleteConfirm !== id) { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); return }
        start(async () => {
            try {
                await deleteTarifa(id)
                onUpdate(rows, id)
                toast.success('Tarifa eliminada')
            } catch (e) { toast.error((e as Error).message) }
            setDeleteConfirm(null)
        })
    }

    return (
        <div className="space-y-4">
            {formData && (
                <TarifaFormPanel
                    data={formData}
                    supply="electricity"
                    onClose={() => setFormData(null)}
                    onSaved={saved => {
                        const exists = rows.find(r => r.id === saved.id)
                        onUpdate(exists ? rows.map(r => r.id === saved.id ? saved : r) : [saved, ...rows])
                        setFormData(null)
                    }}
                />
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="w-full pl-8 pr-3 py-2 text-sm bg-white/80 backdrop-blur border border-slate-200/50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]" placeholder="Buscar tarifa..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 flex-wrap">
                    {['ALL', ...companies].map(c => (
                        <button key={c} type="button" onClick={() => setCompanyFilter(c)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${companyFilter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/80 text-slate-500 border border-slate-200/60 hover:bg-white hover:text-slate-800'}`}>
                            {c === 'ALL' ? 'Todas' : c}
                        </button>
                    ))}
                </div>
                {isAdmin && (
                    <button type="button" onClick={() => setFormData(blankTarifa('electricity'))} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all ml-auto">
                        <Plus size={14} /> Nueva tarifa
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-white">
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Compañía</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Producto</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Modelo</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">ATR</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">E.P1</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">E.P2</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">E.P3</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-400">E.P4</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-400">E.P5</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-400">E.P6</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Pot. P1</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500">Activa</th>
                            {isAdmin && <th className="px-3 py-3" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {filtered.map(row => (
                            <tr key={row.id} className={`hover:bg-white hover:shadow-sm hover:scale-[1.002] relative z-0 hover:z-10 transition-all duration-300 ${!row.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg shadow-sm flex items-center justify-center text-white text-[10px] font-black ${row.logo_color || 'bg-slate-600'}`}>
                                            {row.company.slice(0, 2)}
                                        </div>
                                        <span className="font-bold text-slate-800">{row.company}</span>
                                        {!companiesWithCommission.has(row.company) && (
                                            <span title="Sin comisión configurada" className="text-amber-400/80">
                                                <AlertTriangle size={13} strokeWidth={2.5} />
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-medium max-w-[180px] truncate">{row.tariff_name}</td>
                                <td className="px-3 py-3">
                                    {row.modelo ? (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${MODELO_COLORS[row.modelo] ?? 'bg-slate-100 text-slate-600'}`}>{row.modelo}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-slate-600">{row.tariff_type ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmt(row.energy_price_p1, 4)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmt(row.energy_price_p2, 4)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmt(row.energy_price_p3, 4)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmt(row.energy_price_p4 ?? 0, 4)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmt(row.energy_price_p5 ?? 0, 4)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmt(row.energy_price_p6 ?? 0, 4)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmt(row.power_price_p1, 4)}</td>
                                <td className="px-3 py-2.5 text-center">
                                    {isAdmin ? (
                                        <button type="button" onClick={() => handleToggle(row)} disabled={pending} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                            {row.is_active ? <ToggleRight size={20} className="text-indigo-500" /> : <ToggleLeft size={20} />}
                                        </button>
                                    ) : (
                                        <span className={`w-2 h-2 rounded-full inline-block ${row.is_active ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                    )}
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
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={13} className="py-24">
                                    <div className="flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-2">
                                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center mb-5 rotate-3 shadow-sm">
                                            <Search size={22} className="text-slate-300" />
                                        </div>
                                        <p className="text-slate-700 font-extrabold text-sm mb-1">No se encontraron tarifas de luz</p>
                                        <p className="text-slate-400 text-xs">Ajusta los filtros o intenta con otra búsqueda.</p>
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
