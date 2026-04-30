'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Flame, FileSpreadsheet } from 'lucide-react'
import { TarifaRow, TariffCommissionRow, deleteTarifa, toggleTarifaActive } from '@/app/actions/tariffs'
import { fmtEur, blankTarifa } from './tariff-form-utils'
import { TarifaFormPanel } from './TarifaFormPanel'
import dynamic from 'next/dynamic'

const TariffExcelImportModal = dynamic(
    () => import('./TariffExcelImportModal').then(m => ({ default: m.TariffExcelImportModal })),
    { ssr: false }
)

interface Props {
    rows: TarifaRow[]
    commissions: TariffCommissionRow[]
    isAdmin: boolean
    onUpdate: (updated: TarifaRow[], deleted?: string) => void
}

export function GasTab({ rows, commissions, isAdmin, onUpdate }: Props) {
    const [formData, setFormData] = useState<Partial<TarifaRow> | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [showImport, setShowImport] = useState(false)
    const [pending, start] = useTransition()

    const companiesWithCommission = useMemo(
        () => new Set(commissions.filter(c => c.supply_type === 'gas').map(c => c.company)),
        [commissions]
    )

    const handleToggle = (row: TarifaRow) => start(async () => {
        try {
            await toggleTarifaActive(row.id, !row.is_active)
            onUpdate(rows.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
        } catch (e) { toast.error((e as Error).message) }
    })

    const handleDelete = (id: string) => {
        if (deleteConfirm !== id) { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); return }
        start(async () => {
            try { await deleteTarifa(id); onUpdate(rows, id); toast.success('Tarifa eliminada') }
            catch (e) { toast.error((e as Error).message) }
            setDeleteConfirm(null)
        })
    }

    return (
        <div className="space-y-4">
            {formData && (
                <TarifaFormPanel
                    data={formData}
                    supply="gas"
                    onClose={() => setFormData(null)}
                    onSaved={saved => {
                        const exists = rows.find(r => r.id === saved.id)
                        onUpdate(exists ? rows.map(r => r.id === saved.id ? saved : r) : [saved, ...rows])
                        setFormData(null)
                    }}
                />
            )}

            {isAdmin && (
                <div className="flex justify-end gap-2 mb-4 bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 shadow-sm">
                    <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 transition-all">
                        <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button type="button" onClick={() => setFormData(blankTarifa('gas'))} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20 transition-all">
                        <Plus size={14} /> Nueva tarifa gas
                    </button>
                </div>
            )}

            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-white">
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Compañía</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Producto</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">ATR/Tramo</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Consumo (kWh)</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Fijo €/año</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Variable €/kWh</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500">Activa</th>
                            {isAdmin && <th className="px-3 py-3" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {rows.map(row => (
                            <tr key={row.id} className={`hover:bg-white hover:shadow-sm hover:scale-[1.002] relative z-0 hover:z-10 transition-all duration-300 ${!row.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg shadow-sm flex items-center justify-center text-white text-[10px] font-black ${row.logo_color || 'bg-orange-500'}`}>
                                            {row.company.slice(0, 2)}
                                        </div>
                                        <span className="font-bold text-slate-800">{row.company}</span>
                                        {!companiesWithCommission.has(row.company) && (
                                            <span title="Sin comisión configurada" className="text-amber-400">
                                                <AlertTriangle size={12} />
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 text-slate-700">{row.tariff_name}</td>
                                <td className="px-3 py-2.5 font-mono text-slate-600">{row.tariff_type ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right text-slate-600">
                                    {row.consumption_min_kwh.toLocaleString()} – {row.consumption_max_kwh >= 9999999999 ? '∞' : row.consumption_max_kwh.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmtEur(row.fixed_annual_fee_gas)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-700">{row.variable_price_kwh_gas === 0 ? '—' : `${row.variable_price_kwh_gas.toFixed(6)} €`}</td>
                                <td className="px-3 py-2.5 text-center">
                                    {isAdmin ? (
                                        <button type="button" onClick={() => handleToggle(row)} disabled={pending} aria-label="Activar o desactivar tarifa" className="text-slate-400 hover:text-orange-600 transition-colors">
                                            {row.is_active ? <ToggleRight size={20} className="text-orange-500" /> : <ToggleLeft size={20} />}
                                        </button>
                                    ) : (
                                        <span className={`w-2 h-2 rounded-full inline-block ${row.is_active ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                    )}
                                </td>
                                {isAdmin && (
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1">
                                            <button type="button" title="Editar tarifa" onClick={() => setFormData(row)} className="p-1.5 rounded-lg text-slate-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"><Edit3 size={13} /></button>
                                            <button type="button" title="Eliminar tarifa" onClick={() => handleDelete(row.id)} className={`p-1.5 rounded-lg transition-colors ${deleteConfirm === row.id ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}>
                                                {deleteConfirm === row.id ? <span className="text-[9px] font-bold px-0.5">OK</span> : <Trash2 size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-24">
                                    <div className="flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-2">
                                        <div className="w-16 h-16 bg-orange-50/50 border border-orange-100/50 rounded-[1.5rem] flex items-center justify-center mb-5 rotate-3 shadow-sm">
                                            <Flame size={24} className="text-orange-300" />
                                        </div>
                                        <p className="text-slate-700 font-extrabold text-sm mb-1">Sin tarifas de gas activas</p>
                                        <p className="text-slate-400 text-xs">Crea tu primera tarifa de gas para comenzar.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showImport && (
                <TariffExcelImportModal
                    supplyType="gas"
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { setShowImport(false); toast.success('Recarga la página para ver las tarifas importadas') }}
                />
            )}
        </div>
    )
}
