'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Search, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { TarifaRow, TariffCommissionRow, deleteTarifa, toggleTarifaActive } from '@/app/actions/tariffs'
import { MODELO_COLORS, fmt, blankTarifa } from './tariff-form-utils'
import { TarifaFormPanel } from './TarifaFormPanel'
import dynamic from 'next/dynamic'
import { getMarketerLogo, normalizeMarketerName } from '@/lib/marketers/logos'
import Image from 'next/image'

const TariffExcelImportModal = dynamic(
    () => import('./TariffExcelImportModal').then(m => ({ default: m.TariffExcelImportModal })),
    { ssr: false }
)

const logoImageClass = (company: string) => {
    switch (normalizeMarketerName(company)) {
        case 'GANAENERGIA':
            return 'scale-100'
        case 'LOGOS':
        case 'LOGOSENERGIA':
            return 'scale-100'
        case 'NATURGY':
            return 'scale-[1.35]'
        case 'PLENITUDE':
            return 'scale-[1.45]'
        default:
            return 'scale-100'
    }
}

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
    const [showImport, setShowImport] = useState(false)
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
                    <input className="w-full pl-8 pr-3 py-2 text-sm bg-white/80 backdrop-blur border border-slate-200/50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]" placeholder="Buscar tarifa..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar tarifa" />
                </div>
                <div className="flex gap-1 flex-wrap">
                    {['ALL', ...companies].map(c => (
                        <button key={c} type="button" onClick={() => setCompanyFilter(c)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${companyFilter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/80 text-slate-500 border border-slate-200/60 hover:bg-white hover:text-slate-800'}`}>
                            {c === 'ALL' ? 'Todas' : c}
                        </button>
                    ))}
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 transition-all">
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button type="button" onClick={() => setFormData(blankTarifa('electricity'))} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all">
                            <Plus size={14} /> Nueva tarifa
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <table className="w-full table-fixed text-[11px]">
                    <colgroup>
                        <col className="w-[14%]" />
                        <col className="w-[9%]" />
                        <col className="w-[6%]" />
                        <col className="w-[4%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.8%]" />
                        <col className="w-[4.2%]" />
                        {isAdmin && <col className="w-[5%]" />}
                    </colgroup>
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-white">
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Compañía</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Producto</th>
                            <th className="text-left px-2 py-3 font-semibold text-slate-500">Modelo</th>
                            <th className="text-left px-2 py-3 font-semibold text-slate-500">ATR</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Energía P1">E.P1</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Energía P2">E.P2</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Energía P3">E.P3</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-400" title="Energía P4">E.P4</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-400" title="Energía P5">E.P5</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-400" title="Energía P6">E.P6</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Potencia P1">kW P1</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Potencia P2">kW P2</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Potencia P3">kW P3</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Potencia P4">kW P4</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Potencia P5">kW P5</th>
                            <th className="text-right px-2 py-3 font-semibold text-slate-500" title="Potencia P6">kW P6</th>
                            <th className="text-center px-2 py-3 font-semibold text-slate-500">Activa</th>
                            {isAdmin && <th className="px-2 py-3" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {filtered.map(row => {
                            const logo = getMarketerLogo(row.company)

                            return (
                            <tr key={row.id} className={`hover:bg-white hover:shadow-sm hover:scale-[1.002] relative z-0 hover:z-10 transition-all duration-300 ${!row.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                <td className="px-3 py-2.5">
                                    <div className="group/company flex min-w-0 items-center gap-2">
                                        {logo ? (
                                            <div className="relative h-9 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)] ring-1 ring-white transition-all duration-300 group-hover/company:-translate-y-0.5 group-hover/company:border-indigo-200 group-hover/company:shadow-[0_10px_24px_rgba(79,70,229,0.16)]">
                                                <Image
                                                    src={logo}
                                                    alt={`Logo ${row.company}`}
                                                    fill
                                                    sizes="64px"
                                                    className={`object-contain transition-transform duration-300 ${logoImageClass(row.company)}`}
                                                />
                                            </div>
                                        ) : (
                                            <div className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-xl border border-white/70 shadow-sm ring-1 ring-slate-900/5 text-white text-xs font-black tracking-wide ${row.logo_color || 'bg-slate-600'}`}>
                                                {row.company.slice(0, 2)}
                                            </div>
                                        )}
                                        <div className="min-w-0">
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
                                <td className="px-3 py-3 text-slate-600 font-medium truncate" title={row.tariff_name}>{row.tariff_name}</td>
                                <td className="px-2 py-3">
                                    {row.modelo ? (
                                        <span className={`inline-block max-w-full truncate px-2 py-0.5 rounded-full text-[9px] font-bold ${MODELO_COLORS[row.modelo] ?? 'bg-slate-100 text-slate-600'}`}>{row.modelo}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-2 py-2.5 font-mono text-slate-600 tabular-nums">{row.tariff_type ?? '—'}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-700 tabular-nums">{fmt(row.energy_price_p1, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-500 tabular-nums">{fmt(row.energy_price_p2, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-500 tabular-nums">{fmt(row.energy_price_p3, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(row.energy_price_p4 ?? 0, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(row.energy_price_p5 ?? 0, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(row.energy_price_p6 ?? 0, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-600 tabular-nums">{fmt(row.power_price_p1, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-600 tabular-nums">{fmt(row.power_price_p2, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-600 tabular-nums">{fmt(row.power_price_p3, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-500 tabular-nums">{fmt(row.power_price_p4 ?? 0, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-500 tabular-nums">{fmt(row.power_price_p5 ?? 0, 4)}</td>
                                <td className="px-2 py-2.5 text-right font-mono text-slate-500 tabular-nums">{fmt(row.power_price_p6 ?? 0, 4)}</td>
                                <td className="px-2 py-2.5 text-center">
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
                                        <div className="flex items-center justify-end gap-1">
                                            <button type="button" onClick={() => setFormData(row)} aria-label="Editar tarifa" className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 size={13} /></button>
                                            <button type="button" onClick={() => handleDelete(row.id)} aria-label="Eliminar tarifa" className={`p-1.5 rounded-lg transition-colors ${deleteConfirm === row.id ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}>
                                                {deleteConfirm === row.id ? <span className="text-[9px] font-bold px-0.5">OK</span> : <Trash2 size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                            )
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 18 : 17} className="py-24">
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

            {showImport && (
                <TariffExcelImportModal
                    supplyType="electricity"
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { setShowImport(false); toast.success('Recarga la página para ver las tarifas importadas') }}
                />
            )}
        </div>
    )
}
