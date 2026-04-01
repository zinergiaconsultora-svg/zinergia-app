'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import {
    Zap, Flame, BadgePercent, Plus, Edit3, Trash2, ToggleLeft, ToggleRight,
    X, Save, ChevronDown, Search, Users, Building2, AlertTriangle
} from 'lucide-react'
import {
    TarifaRow, TariffCommissionRow,
    upsertTarifa, deleteTarifa, toggleTarifaActive,
    upsertTariffCommission, deleteTariffCommission, saveCollaboratorPct,
} from '@/app/actions/tariffs'

type Tab = 'electricity' | 'gas' | 'commissions'

interface Props {
    initialElectricity: TarifaRow[]
    initialGas: TarifaRow[]
    initialCommissions: TariffCommissionRow[]
    initialCollaboratorPct: number
    isAdmin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODELO_COLORS: Record<string, string> = {
    BASE:  'bg-slate-100 text-slate-700',
    ONE:   'bg-blue-50 text-blue-700',
    SUPRA: 'bg-indigo-50 text-indigo-700',
}

const SUPPLY_COLORS: Record<string, string> = {
    electricity: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    gas:         'bg-orange-50 text-orange-700 border-orange-200',
}

function fmt(n: number, decimals = 6) {
    return n === 0 ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtEur(n: number) {
    return n === 0 ? '—' : `${n.toFixed(2)} €`
}

// ─── Blank forms ─────────────────────────────────────────────────────────────

function blankTarifa(supply: 'electricity' | 'gas'): Partial<TarifaRow> {
    return {
        supply_type: supply, company: '', tariff_name: '', tariff_type: supply === 'gas' ? 'RL.1' : '2.0TD',
        modelo: null, tipo_cliente: 'PYME', codigo_producto: '', offer_type: 'fixed',
        contract_duration: '12 meses',
        power_price_p1: 0, power_price_p2: 0, power_price_p3: 0,
        power_price_p4: 0, power_price_p5: 0, power_price_p6: 0,
        energy_price_p1: 0, energy_price_p2: 0, energy_price_p3: 0,
        energy_price_p4: 0, energy_price_p5: 0, energy_price_p6: 0,
        connection_fee: 0, fixed_fee: 0,
        consumption_min_kwh: 0, consumption_max_kwh: 9999999999,
        fixed_annual_fee_gas: 0, variable_price_kwh_gas: 0,
        logo_color: 'bg-slate-600', notes: '', is_active: true,
    }
}

function blankCommission(): Partial<TariffCommissionRow> {
    return {
        company: '', modelo: null, supply_type: 'electricity', tipo_cliente: 'PYME',
        producto_tipo: 'ELECTRICIDAD_FIJO', consumption_min_mwh: 0, consumption_max_mwh: 9999999999,
        commission_fixed_eur: 0, commission_variable_mwh: 0, servicio: 'LUZ', notes: '', is_active: true,
    }
}

// ─── Shared Input ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</div>
            {children}
        </label>
    )
}

const inputCls = 'w-full text-xs bg-slate-50/50 border border-slate-200/60 rounded-xl px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all'
const selectCls = `${inputCls} appearance-none cursor-pointer`

// ─── Tarifa Form Panel ────────────────────────────────────────────────────────

function TarifaFormPanel({
    data, supply, onClose, onSaved,
}: {
    data: Partial<TarifaRow>
    supply: 'electricity' | 'gas'
    onClose: () => void
    onSaved: (row: TarifaRow) => void
}) {
    const [form, setForm] = useState<Partial<TarifaRow>>(data)
    const [pending, start] = useTransition()

    const set = (k: keyof TarifaRow, v: unknown) => setForm(f => ({ ...f, [k]: v }))
    const setN = (k: keyof TarifaRow) => (e: React.ChangeEvent<HTMLInputElement>) =>
        set(k, parseFloat(e.target.value) || 0)

    const handleSave = () => {
        if (!form.company?.trim()) { toast.error('La compañía es obligatoria'); return }
        if (!form.tariff_name?.trim()) { toast.error('El nombre del producto es obligatorio'); return }
        if (!form.tariff_type?.trim()) { toast.error('La tarifa ATR es obligatoria'); return }
        if (!form.codigo_producto?.trim()) { toast.error('El código de producto es obligatorio'); return }

        start(async () => {
            try {
                const row = await upsertTarifa(form)
                onSaved(row)
                toast.success(form.id ? 'Tarifa actualizada' : 'Tarifa creada')
                onClose()
            } catch (e) {
                toast.error((e as Error).message)
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/50">
                    <h2 className="font-black text-slate-900 text-lg">{form.id ? 'Editar Tarifa' : 'Nueva Tarifa'}</h2>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-5">
                    <Field label="Compañía">
                        <input className={inputCls} value={form.company ?? ''} onChange={e => set('company', e.target.value)} />
                    </Field>
                    <Field label="Nombre del producto">
                        <input className={inputCls} value={form.tariff_name ?? ''} onChange={e => set('tariff_name', e.target.value)} />
                    </Field>
                    <Field label="Código producto">
                        <input className={inputCls} value={form.codigo_producto ?? ''} onChange={e => set('codigo_producto', e.target.value)} />
                    </Field>
                    <Field label="Tarifa ATR">
                        <input className={inputCls} value={form.tariff_type ?? ''} onChange={e => set('tariff_type', e.target.value)} placeholder="2.0TD, 3.0TD, RL.1..." />
                    </Field>
                    {supply === 'electricity' && (
                        <Field label="Modelo / Canal">
                            <select className={selectCls} value={form.modelo ?? ''} onChange={e => set('modelo', e.target.value || null)}>
                                <option value="">Sin modelo</option>
                                <option value="BASE">BASE</option>
                                <option value="ONE">ONE</option>
                                <option value="SUPRA">SUPRA</option>
                            </select>
                        </Field>
                    )}
                    <Field label="Tipo cliente">
                        <select className={selectCls} value={form.tipo_cliente ?? 'PYME'} onChange={e => set('tipo_cliente', e.target.value)}>
                            <option value="PYME">PYME</option>
                            <option value="RESIDENCIAL">Residencial</option>
                            <option value="GRAN_CUENTA">Gran Cuenta</option>
                        </select>
                    </Field>
                    <Field label="Tipo oferta">
                        <select className={selectCls} value={form.offer_type ?? 'fixed'} onChange={e => set('offer_type', e.target.value)}>
                            <option value="fixed">Precio fijo</option>
                            <option value="indexed">Indexado</option>
                        </select>
                    </Field>
                    <Field label="Permanencia">
                        <input className={inputCls} value={form.contract_duration ?? ''} onChange={e => set('contract_duration', e.target.value)} placeholder="12 meses" />
                    </Field>

                    {supply === 'electricity' ? (
                        <>
                            <div className="col-span-2 bg-slate-50/40 p-5 rounded-2xl border border-slate-100/40 shadow-sm">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Precios Potencia (€/kW/día)</p>
                                <div className="grid grid-cols-6 gap-3">
                                    {[1,2,3,4,5,6].map(p => (
                                        <Field key={p} label={`P${p}`}>
                                            <input type="number" step="0.000001" className={inputCls} value={(form as Record<string,unknown>)[`power_price_p${p}`] as number ?? 0} onChange={setN(`power_price_p${p}` as keyof TarifaRow)} />
                                        </Field>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2 bg-slate-50/40 p-5 rounded-2xl border border-slate-100/40 shadow-sm">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Precios Energía (€/kWh)</p>
                                <div className="grid grid-cols-6 gap-3">
                                    {[1,2,3,4,5,6].map(p => (
                                        <Field key={p} label={`P${p}`}>
                                            <input type="number" step="0.000001" className={inputCls} value={(form as Record<string,unknown>)[`energy_price_p${p}`] as number ?? 0} onChange={setN(`energy_price_p${p}` as keyof TarifaRow)} />
                                        </Field>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <Field label="Consumo mín (kWh)">
                                <input type="number" className={inputCls} value={form.consumption_min_kwh ?? 0} onChange={setN('consumption_min_kwh')} />
                            </Field>
                            <Field label="Consumo máx (kWh)">
                                <input type="number" className={inputCls} value={form.consumption_max_kwh ?? 0} onChange={setN('consumption_max_kwh')} />
                            </Field>
                            <Field label="Término fijo anual (€/año)">
                                <input type="number" step="0.000001" className={inputCls} value={form.fixed_annual_fee_gas ?? 0} onChange={setN('fixed_annual_fee_gas')} />
                            </Field>
                            <Field label="Término variable (€/kWh)">
                                <input type="number" step="0.000001" className={inputCls} value={form.variable_price_kwh_gas ?? 0} onChange={setN('variable_price_kwh_gas')} />
                            </Field>
                        </>
                    )}

                    <Field label="Notas">
                        <input className={inputCls} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
                    </Field>
                </div>
                <div className="flex justify-end gap-3 px-6 py-5 bg-slate-50/50 border-t border-slate-100/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-200/50">Cancelar</button>
                    <button type="button" onClick={handleSave} disabled={pending} className="px-5 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50">
                        <Save size={14} />{pending ? 'Guardando…' : 'Guardar tarifa'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Commission Form Panel ────────────────────────────────────────────────────

function CommissionFormPanel({
    data, onClose, onSaved,
}: {
    data: Partial<TariffCommissionRow>
    onClose: () => void
    onSaved: (row: TariffCommissionRow) => void
}) {
    const [form, setForm] = useState<Partial<TariffCommissionRow>>(data)
    const [pending, start] = useTransition()

    const set = (k: keyof TariffCommissionRow, v: unknown) => setForm(f => ({ ...f, [k]: v }))
    const setN = (k: keyof TariffCommissionRow) => (e: React.ChangeEvent<HTMLInputElement>) =>
        set(k, parseFloat(e.target.value) || 0)

    const handleSave = () => {
        if (!form.company?.trim()) { toast.error('La compañía es obligatoria'); return }
        if (!form.producto_tipo?.trim()) { toast.error('El tipo de producto es obligatorio'); return }
        if ((form.commission_fixed_eur ?? 0) === 0 && (form.commission_variable_mwh ?? 0) === 0) {
            toast.error('Introduce al menos una comisión (fija o variable)'); return
        }

        start(async () => {
            try {
                const row = await upsertTariffCommission(form)
                onSaved(row)
                toast.success(form.id ? 'Comisión actualizada' : 'Comisión creada')
                onClose()
            } catch (e) {
                toast.error((e as Error).message)
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/50">
                    <h2 className="font-black text-slate-900 text-lg">{form.id ? 'Editar Regla de Comisión' : 'Nueva Regla'}</h2>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-5">
                    <Field label="Compañía">
                        <input className={inputCls} value={form.company ?? ''} onChange={e => set('company', e.target.value)} />
                    </Field>
                    <Field label="Modelo">
                        <select className={selectCls} value={form.modelo ?? ''} onChange={e => set('modelo', e.target.value || null)}>
                            <option value="">Todos</option>
                            <option value="BASE">BASE</option>
                            <option value="ONE">ONE</option>
                            <option value="SUPRA">SUPRA</option>
                        </select>
                    </Field>
                    <Field label="Suministro">
                        <select className={selectCls} value={form.supply_type ?? 'electricity'} onChange={e => set('supply_type', e.target.value)}>
                            <option value="electricity">Electricidad</option>
                            <option value="gas">Gas</option>
                        </select>
                    </Field>
                    <Field label="Tipo cliente">
                        <select className={selectCls} value={form.tipo_cliente ?? 'PYME'} onChange={e => set('tipo_cliente', e.target.value)}>
                            <option value="PYME">PYME</option>
                            <option value="RESIDENCIAL">Residencial</option>
                            <option value="GRAN_CUENTA">Gran Cuenta</option>
                        </select>
                    </Field>
                    <Field label="Tipo producto">
                        <input className={inputCls} value={form.producto_tipo ?? ''} onChange={e => set('producto_tipo', e.target.value)} placeholder="ELECTRICIDAD_FIJO, GAS..." />
                    </Field>
                    <Field label="Servicio">
                        <select className={selectCls} value={form.servicio ?? 'LUZ'} onChange={e => set('servicio', e.target.value)}>
                            <option value="LUZ">LUZ</option>
                            <option value="GAS">GAS</option>
                        </select>
                    </Field>
                    <Field label="Consumo mín (MWh/año)">
                        <input type="number" className={inputCls} value={form.consumption_min_mwh ?? 0} onChange={setN('consumption_min_mwh')} />
                    </Field>
                    <Field label="Consumo máx (MWh/año)">
                        <input type="number" className={inputCls} value={form.consumption_max_mwh ?? 0} onChange={setN('consumption_max_mwh')} />
                    </Field>
                    <Field label="Comisión fija (€/contrato)">
                        <input type="number" step="0.01" className={inputCls} value={form.commission_fixed_eur ?? 0} onChange={setN('commission_fixed_eur')} />
                    </Field>
                    <Field label="Comisión variable (€/MWh)">
                        <input type="number" step="0.01" className={inputCls} value={form.commission_variable_mwh ?? 0} onChange={setN('commission_variable_mwh')} />
                    </Field>
                    <div className="col-span-2">
                        <Field label="Notas">
                            <input className={inputCls} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
                        </Field>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-5 bg-slate-50/50 border-t border-slate-100/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-200/50">Cancelar</button>
                    <button type="button" onClick={handleSave} disabled={pending} className="px-5 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50">
                        <Save size={14} />{pending ? 'Guardando…' : 'Guardar regla'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Electricity Tab ──────────────────────────────────────────────────────────

function ElectricityTab({ rows, commissions, isAdmin, onUpdate }: { rows: TarifaRow[]; commissions: TariffCommissionRow[]; isAdmin: boolean; onUpdate: (updated: TarifaRow[], deleted?: string) => void }) {
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

// ─── Gas Tab ──────────────────────────────────────────────────────────────────

function GasTab({ rows, commissions, isAdmin, onUpdate }: { rows: TarifaRow[]; commissions: TariffCommissionRow[]; isAdmin: boolean; onUpdate: (updated: TarifaRow[], deleted?: string) => void }) {
    const [formData, setFormData] = useState<Partial<TarifaRow> | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
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
                <div className="flex justify-end mb-4 bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 shadow-sm">
                    <button type="button" onClick={() => setFormData(blankTarifa('gas'))} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20 transition-all ml-auto">
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
                                        <button type="button" onClick={() => handleToggle(row)} disabled={pending} className="text-slate-400 hover:text-orange-600 transition-colors">
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
        </div>
    )
}

// ─── Commissions Tab ──────────────────────────────────────────────────────────

function CommissionsTab({ rows, collaboratorPct: initPct, isAdmin, onUpdate, onPctSaved }: {
    rows: TariffCommissionRow[]
    collaboratorPct: number
    isAdmin: boolean
    onUpdate: (updated: TariffCommissionRow[], deleted?: string) => void
    onPctSaved?: (pct: number) => void
}) {
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

// ─── Main View ────────────────────────────────────────────────────────────────

export default function TarifasAdminView({ initialElectricity, initialGas, initialCommissions, initialCollaboratorPct, isAdmin }: Props) {
    const [tab, setTab] = useState<Tab>('electricity')
    const [electricity, setElectricity] = useState(initialElectricity)
    const [gas, setGas] = useState(initialGas)
    const [commissions, setCommissions] = useState(initialCommissions)
    const [collaboratorPct, setCollaboratorPct] = useState(initialCollaboratorPct)

    const handleElecUpdate = (updated: TarifaRow[], deleted?: string) => {
        setElectricity(deleted ? updated.filter(r => r.id !== deleted) : updated)
    }
    const handleGasUpdate = (updated: TarifaRow[], deleted?: string) => {
        setGas(deleted ? updated.filter(r => r.id !== deleted) : updated)
    }
    const handleCommUpdate = (updated: TariffCommissionRow[], deleted?: string) => {
        setCommissions(deleted ? updated.filter(r => r.id !== deleted) : updated)
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
        { id: 'electricity', label: 'Electricidad', icon: <Zap size={15} />, count: electricity.length },
        { id: 'gas',         label: 'Gas',          icon: <Flame size={15} />, count: gas.length },
        { id: 'commissions', label: 'Comisiones',   icon: <BadgePercent size={15} />, count: commissions.length },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Zap size={20} fill="currentColor" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900">Gestión de Tarifas</h1>
                    <p className="text-xs text-slate-400">{isAdmin ? 'Panel administrador — edición completa' : 'Vista de lectura'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <ChevronDown size={14} className="text-slate-300" />
                    <span className="text-xs text-slate-400">{electricity.length + gas.length} tarifas · {commissions.length} reglas</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1.5 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[1.5rem] w-fit shadow-lg shadow-slate-200/50 relative">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${
                            tab === t.id
                                ? 'text-white shadow-md bg-indigo-600'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors ${tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'electricity' && (
                <ElectricityTab rows={electricity} commissions={commissions} isAdmin={isAdmin} onUpdate={handleElecUpdate} />
            )}
            {tab === 'gas' && (
                <GasTab rows={gas} commissions={commissions} isAdmin={isAdmin} onUpdate={handleGasUpdate} />
            )}
            {tab === 'commissions' && (
                <CommissionsTab rows={commissions} collaboratorPct={collaboratorPct} isAdmin={isAdmin} onUpdate={handleCommUpdate} onPctSaved={setCollaboratorPct} />
            )}
        </div>
    )
}
