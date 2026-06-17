'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, Copy, ToggleLeft, ToggleRight, Search, AlertTriangle, FileSpreadsheet, Rows3, Maximize2 } from 'lucide-react'
import { TarifaRow, TariffCommissionRow, deleteTarifa, toggleTarifaActive } from '@/app/actions/tariffs'
import { MODELO_COLORS, fmt, blankTarifa } from './tariff-form-utils'
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

const COMPACT_PERIODS = [1, 2, 3] as const
const ALL_PERIODS = [1, 2, 3, 4, 5, 6] as const

export function ElectricityTab({ rows, commissions, isAdmin, onUpdate }: Props) {
    const router = useRouter()
    const [search, setSearch] = useState('')
    const [companyFilter, setCompanyFilter] = useState('ALL')
    const [formData, setFormData] = useState<Partial<TarifaRow> | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [bulkDelete, setBulkDelete] = useState(false)
    const [showImport, setShowImport] = useState(false)
    const [detailed, setDetailed] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [pending, start] = useTransition()

    const periods = detailed ? ALL_PERIODS : COMPACT_PERIODS

    const companiesWithCommission = useMemo(
        () => new Set(commissions.filter(c => c.supply_type === 'electricity').map(c => c.company)),
        [commissions]
    )
    const companies = useMemo(() => [...new Set(rows.map(r => r.company))].sort(), [rows])
    const filtered = useMemo(() => rows.filter(r =>
        (companyFilter === 'ALL' || r.company === companyFilter) &&
        (r.tariff_name.toLowerCase().includes(search.toLowerCase()) || r.company.toLowerCase().includes(search.toLowerCase()))
    ), [rows, companyFilter, search])

    const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
    const toggleSelect = (id: string) => setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })
    const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(r => r.id)))
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
            try {
                await deleteTarifa(id)
                onUpdate(rows, id)
                toast.success('Tarifa eliminada')
            } catch (e) { toast.error((e as Error).message) }
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

    const colCount = 4 + periods.length * 2 + 1 + (isAdmin ? 2 : 0) // sel + company + producto + modelo + atr + E + P + activa + actions

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
                    <input className="w-full pl-8 pr-3 py-2 text-sm bg-white/80 backdrop-blur border border-slate-200/50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]" placeholder="Buscar tarifa..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar tarifa" />
                </div>
                <div className="flex gap-1 flex-wrap">
                    {['ALL', ...companies].map(c => (
                        <button key={c} type="button" onClick={() => setCompanyFilter(c)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${companyFilter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/80 text-slate-500 border border-slate-200/60 hover:bg-white hover:text-slate-800'}`}>
                            {c === 'ALL' ? 'Todas' : c}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    {/* Compacto / detallado */}
                    <button
                        type="button"
                        onClick={() => setDetailed(d => !d)}
                        title={detailed ? 'Ver compacto (P1-P3)' : 'Ver detallado (P1-P6)'}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200/60 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 transition-all"
                    >
                        {detailed ? <Rows3 size={14} /> : <Maximize2 size={14} />}
                        {detailed ? 'Compacto' : 'Detallado'}
                    </button>
                    {isAdmin && (
                        <>
                            <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 transition-all">
                                <FileSpreadsheet size={14} /> Excel
                            </button>
                            <button type="button" onClick={() => setFormData(blankTarifa('electricity'))} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all">
                                <Plus size={14} /> Nueva tarifa
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Bulk actions bar */}
            {isAdmin && selected.size > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-2xl animate-in fade-in slide-in-from-top-1">
                    <span className="text-xs font-bold text-indigo-700 mr-1">{selected.size} seleccionada(s)</span>
                    <button type="button" onClick={() => handleBulkToggle(true)} disabled={pending} className="px-3 py-1.5 bg-white text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50">Activar</button>
                    <button type="button" onClick={() => handleBulkToggle(false)} disabled={pending} className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">Desactivar</button>
                    <button type="button" onClick={() => setBulkDelete(true)} disabled={pending} className="px-3 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200 transition-colors disabled:opacity-50">Eliminar</button>
                    <button type="button" onClick={clearSelection} className="ml-auto text-xs text-slate-400 hover:text-slate-600">✕ Limpiar</button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/40 overflow-x-auto">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-white">
                            {isAdmin && (
                                <th rowSpan={2} className="px-2 py-3 text-center align-middle">
                                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Seleccionar todas" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" />
                                </th>
                            )}
                            <th rowSpan={2} className="text-left px-1.5 py-3 font-semibold text-slate-500 align-middle sm:px-3">Compañía</th>
                            <th rowSpan={2} className="text-left px-3 py-3 font-semibold text-slate-500 align-middle">Producto</th>
                            <th rowSpan={2} className="text-left px-2 py-3 font-semibold text-slate-500 align-middle">Modelo</th>
                            <th rowSpan={2} className="text-left px-2 py-3 font-semibold text-slate-500 align-middle">ATR</th>
                            <th colSpan={periods.length} className="text-center px-2 py-2 font-bold text-indigo-500 border-l border-slate-100 uppercase tracking-wider text-[9px]">Energía €/kWh</th>
                            <th colSpan={periods.length} className="text-center px-2 py-2 font-bold text-teal-600 border-l border-slate-100 uppercase tracking-wider text-[9px]">Potencia €/kW</th>
                            <th rowSpan={2} className="text-center px-2 py-3 font-semibold text-slate-500 align-middle border-l border-slate-100">Activa</th>
                            {isAdmin && <th rowSpan={2} className="px-2 py-3 align-middle" />}
                        </tr>
                        <tr className="bg-slate-50/50 border-b border-white text-[9px]">
                            {periods.map((p, i) => (
                                <th key={`e${p}`} className={`text-right px-2 py-1.5 font-semibold text-slate-400 ${i === 0 ? 'border-l border-slate-100' : ''}`} title={`Energía P${p}`}>P{p}</th>
                            ))}
                            {periods.map((p, i) => (
                                <th key={`p${p}`} className={`text-right px-2 py-1.5 font-semibold text-slate-400 ${i === 0 ? 'border-l border-slate-100' : ''}`} title={`Potencia P${p}`}>P{p}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {filtered.map(row => (
                            <tr key={row.id} className={`hover:bg-white transition-colors duration-200 ${!row.is_active ? 'opacity-40' : ''} ${selected.has(row.id) ? 'bg-indigo-50/40' : ''}`}>
                                {isAdmin && (
                                    <td className="px-2 py-2.5 text-center">
                                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} aria-label={`Seleccionar ${row.tariff_name}`} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" />
                                    </td>
                                )}
                                <td className="px-1.5 py-2.5 sm:px-3">
                                    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                                        <CompanyCell company={row.company} logoColor={row.logo_color} size="md" showName={false} />
                                        <div className="hidden min-w-0 sm:block">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <span className="truncate text-[11px] font-extrabold tracking-wide text-slate-800" title={row.company}>{row.company}</span>
                                                {!companiesWithCommission.has(row.company) && (
                                                    <span title="Sin comisión configurada" className="shrink-0 text-amber-400/80">
                                                        <AlertTriangle size={13} strokeWidth={2.5} />
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${companiesWithCommission.has(row.company) ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'}`}>
                                                {companiesWithCommission.has(row.company) ? 'Comisión OK' : 'Sin comisión'}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-slate-600 font-medium max-w-[160px] truncate" title={row.tariff_name}>{row.tariff_name}</td>
                                <td className="px-2 py-3">
                                    {row.modelo ? (
                                        <span className={`inline-block max-w-full truncate px-2 py-0.5 rounded-full text-[9px] font-bold ${MODELO_COLORS[row.modelo] ?? 'bg-slate-100 text-slate-600'}`}>{row.modelo}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-2 py-2.5 font-mono text-slate-600 tabular-nums">{row.tariff_type ?? '—'}</td>
                                {periods.map((p, i) => {
                                    const val = (row[`energy_price_p${p}` as keyof TarifaRow] as number) ?? 0
                                    return (
                                        <td key={`e${p}`} className={`px-2 py-2.5 text-right font-mono tabular-nums ${p <= 3 ? 'text-slate-700' : 'text-slate-400'} ${i === 0 ? 'border-l border-slate-100/70' : ''}`}>{fmt(val, 4)}</td>
                                    )
                                })}
                                {periods.map((p, i) => {
                                    const val = (row[`power_price_p${p}` as keyof TarifaRow] as number) ?? 0
                                    return (
                                        <td key={`p${p}`} className={`px-2 py-2.5 text-right font-mono tabular-nums ${p <= 3 ? 'text-slate-600' : 'text-slate-400'} ${i === 0 ? 'border-l border-slate-100/70' : ''}`}>{fmt(val, 4)}</td>
                                    )
                                })}
                                <td className="px-2 py-2.5 text-center border-l border-slate-100/70">
                                    {isAdmin ? (
                                        <button type="button" onClick={() => handleToggle(row)} disabled={pending} aria-label="Activar o desactivar tarifa" className="text-slate-400 hover:text-indigo-600 transition-colors">
                                            {row.is_active ? <ToggleRight size={20} className="text-indigo-500" /> : <ToggleLeft size={20} />}
                                        </button>
                                    ) : (
                                        <span className={`w-2 h-2 rounded-full inline-block ${row.is_active ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                    )}
                                </td>
                                {isAdmin && (
                                    <td className="px-2 py-2.5">
                                        <div className="flex items-center justify-end gap-0.5">
                                            <button type="button" onClick={() => handleDuplicate(row)} aria-label="Duplicar tarifa" title="Duplicar" className="p-1.5 rounded-lg text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Copy size={13} /></button>
                                            <button type="button" onClick={() => setFormData(row)} aria-label="Editar tarifa" title="Editar" className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 size={13} /></button>
                                            <button type="button" onClick={() => setDeleteId(row.id)} aria-label="Eliminar tarifa" title="Eliminar" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={colCount} className="py-24">
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
                    supplyType="electricity"
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { setShowImport(false); toast.success('Tarifas importadas'); router.refresh() }}
                />
            )}
        </div>
    )
}
