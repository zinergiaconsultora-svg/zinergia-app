'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, Copy, ToggleLeft, ToggleRight, AlertTriangle, Flame, FileSpreadsheet } from 'lucide-react'
import { TarifaRow, TariffCommissionRow, deleteTarifa, toggleTarifaActive } from '@/app/actions/tariffs'
import { fmtEur, blankTarifa } from './tariff-form-utils'
import { TarifaFormPanel } from './TarifaFormPanel'
import { ConfirmDialog } from './ConfirmDialog'
import dynamic from 'next/dynamic'
import { CompanyCell } from './CompanyCell'

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
    const router = useRouter()
    const [formData, setFormData] = useState<Partial<TarifaRow> | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [bulkDelete, setBulkDelete] = useState(false)
    const [showImport, setShowImport] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [pending, start] = useTransition()

    const companiesWithCommission = useMemo(
        () => new Set(commissions.filter(c => c.supply_type === 'gas').map(c => c.company)),
        [commissions]
    )

    const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
    const toggleSelect = (id: string) => setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })
    const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))
    const clearSelection = () => setSelected(new Set())

    const handleToggle = (row: TarifaRow) => start(async () => {
        try {
            await toggleTarifaActive(row.id, !row.is_active)
            onUpdate(rows.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
        } catch (e) { toast.error((e as Error).message) }
    })

    const handleDelete = () => {
        const id = deleteId
        if (!id) return
        start(async () => {
            try { await deleteTarifa(id); onUpdate(rows, id); toast.success('Tarifa eliminada') }
            catch (e) { toast.error((e as Error).message) }
            setDeleteId(null)
        })
    }

    const handleDuplicate = (row: TarifaRow) => {
        setFormData({ ...row, id: undefined, tariff_name: `${row.tariff_name} (copia)`, is_active: true })
    }

    const handleBulkToggle = (active: boolean) => start(async () => {
        const ids = [...selected]
        try {
            await Promise.all(ids.map(id => toggleTarifaActive(id, active)))
            onUpdate(rows.map(r => selected.has(r.id) ? { ...r, is_active: active } : r))
            toast.success(`${ids.length} tarifa(s) ${active ? 'activadas' : 'desactivadas'}`)
            clearSelection()
        } catch (e) { toast.error((e as Error).message) }
    })

    const handleBulkDelete = () => start(async () => {
        const ids = [...selected]
        try {
            await Promise.all(ids.map(id => deleteTarifa(id)))
            onUpdate(rows.filter(r => !selected.has(r.id)))
            toast.success(`${ids.length} tarifa(s) eliminadas`)
            clearSelection()
        } catch (e) { toast.error((e as Error).message) }
        setBulkDelete(false)
    })

    const colCount = (isAdmin ? 1 : 0) + 6 + (isAdmin ? 1 : 0)

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

            {/* Bulk actions bar */}
            {isAdmin && selected.size > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-2xl animate-in fade-in slide-in-from-top-1">
                    <span className="text-xs font-bold text-orange-700 mr-1">{selected.size} seleccionada(s)</span>
                    <button type="button" onClick={() => handleBulkToggle(true)} disabled={pending} className="px-3 py-1.5 bg-white text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50">Activar</button>
                    <button type="button" onClick={() => handleBulkToggle(false)} disabled={pending} className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">Desactivar</button>
                    <button type="button" onClick={() => setBulkDelete(true)} disabled={pending} className="px-3 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200 transition-colors disabled:opacity-50">Eliminar</button>
                    <button type="button" onClick={clearSelection} className="ml-auto text-xs text-slate-400 hover:text-slate-600">✕ Limpiar</button>
                </div>
            )}

            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/40 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-white">
                            {isAdmin && (
                                <th className="px-2 py-3 text-center">
                                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Seleccionar todas" className="rounded border-slate-300 text-orange-600 focus:ring-orange-500/30" />
                                </th>
                            )}
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
                            <tr key={row.id} className={`hover:bg-white transition-colors duration-200 ${!row.is_active ? 'opacity-40' : ''} ${selected.has(row.id) ? 'bg-orange-50/40' : ''}`}>
                                {isAdmin && (
                                    <td className="px-2 py-2.5 text-center">
                                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} aria-label={`Seleccionar ${row.tariff_name}`} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500/30" />
                                    </td>
                                )}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <CompanyCell company={row.company} logoColor={row.logo_color} showName />
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
                                        <div className="flex items-center gap-0.5">
                                            <button type="button" title="Duplicar tarifa" onClick={() => handleDuplicate(row)} className="p-1.5 rounded-lg text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Copy size={13} /></button>
                                            <button type="button" title="Editar tarifa" onClick={() => setFormData(row)} className="p-1.5 rounded-lg text-slate-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"><Edit3 size={13} /></button>
                                            <button type="button" title="Eliminar tarifa" onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={colCount} className="py-24">
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

            <ConfirmDialog
                open={deleteId !== null}
                title="Eliminar tarifa"
                message="Esta acción no se puede deshacer. La tarifa dejará de estar disponible."
                busy={pending}
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
            <ConfirmDialog
                open={bulkDelete}
                title={`Eliminar ${selected.size} tarifa(s)`}
                message="Vas a eliminar varias tarifas a la vez. Esta acción no se puede deshacer."
                confirmLabel={`Eliminar ${selected.size}`}
                busy={pending}
                onConfirm={handleBulkDelete}
                onCancel={() => setBulkDelete(false)}
            />

            {showImport && (
                <TariffExcelImportModal
                    supplyType="gas"
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { setShowImport(false); toast.success('Tarifas importadas'); router.refresh() }}
                />
            )}
        </div>
    )
}
