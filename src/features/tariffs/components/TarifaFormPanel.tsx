'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Save } from 'lucide-react'
import { TarifaRow, upsertTarifa } from '@/app/actions/tariffs'
import { Field } from './Field'
import { inputCls, selectCls } from './tariff-form-utils'

interface Props {
    data: Partial<TarifaRow>
    supply: 'electricity' | 'gas'
    onClose: () => void
    onSaved: (row: TarifaRow) => void
}

export function TarifaFormPanel({ data, supply, onClose, onSaved }: Props) {
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
