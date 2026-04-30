'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, AlertCircle, CheckCircle2, FileText, Download } from 'lucide-react';
import { importClientsFromCsvAction, type CsvClientRow } from '@/app/actions/crm';
import type { ClientType, ClientStatus } from '@/types/crm';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

const EXPECTED_HEADERS = [
    'nombre', 'email', 'telefono', 'cups', 'factura_media',
    'proveedor', 'tipo_tarifa', 'tipo', 'estado', 'dni_cif', 'ciudad', 'codigo_postal',
];

const TYPE_MAP: Record<string, ClientType> = {
    residencial: 'residential',
    residential: 'residential',
    empresa: 'company',
    company: 'company',
    administracion: 'public_admin',
    public_admin: 'public_admin',
    particular: 'particular',
};

const STATUS_MAP: Record<string, ClientStatus> = {
    nuevo: 'new', new: 'new',
    contactado: 'contacted', contacted: 'contacted',
    en_proceso: 'in_process', in_process: 'in_process',
    ganado: 'won', won: 'won',
    perdido: 'lost', lost: 'lost',
};

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/[ñ]/g, 'n'));
    const rows = lines.slice(1).map(l => parseCsvLine(l));
    return { headers, rows };
}

function mapRowToClient(headers: string[], row: string[]): CsvClientRow {
    const get = (key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? row[idx]?.trim() ?? '' : '';
    };
    const billRaw = get('factura_media');
    const bill = billRaw ? parseFloat(billRaw.replace(',', '.')) : undefined;
    return {
        name: get('nombre'),
        email: get('email') || undefined,
        phone: get('telefono') || undefined,
        cups: get('cups') || undefined,
        average_monthly_bill: (bill !== undefined && !isNaN(bill)) ? bill : undefined,
        current_supplier: get('proveedor') || undefined,
        tariff_type: get('tipo_tarifa') || undefined,
        type: TYPE_MAP[get('tipo').toLowerCase()] ?? 'particular',
        status: STATUS_MAP[get('estado').toLowerCase()] ?? 'new',
        dni_cif: get('dni_cif') || undefined,
        city: get('ciudad') || undefined,
        zip_code: get('codigo_postal') || undefined,
    };
}

function downloadTemplate() {
    const header = EXPECTED_HEADERS.join(',');
    const example = [
        'Juan García', 'juan@email.com', '612345678', 'ES0031300000000001JN0F', '150',
        'Endesa', 'fija', 'particular', 'nuevo', '12345678A', 'Madrid', '28001'
    ].join(',');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + '\r\n' + example + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
}

type Step = 'upload' | 'preview' | 'done';

export default function CsvImportModal({ onClose, onSuccess }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [parsed, setParsed] = useState<CsvClientRow[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);

    const processFile = useCallback((file: File) => {
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            setParseError('El archivo debe ser un CSV (.csv)');
            return;
        }
        setParseError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const { headers, rows } = parseCsv(text);
            if (!headers.includes('nombre')) {
                setParseError('El CSV debe tener una columna "nombre". Descarga la plantilla para ver el formato correcto.');
                return;
            }
            const clients = rows
                .filter(r => r.some(cell => cell.trim()))
                .map(r => mapRowToClient(headers, r))
                .filter(c => c.name);
            if (clients.length === 0) {
                setParseError('No se encontraron clientes válidos en el archivo.');
                return;
            }
            if (clients.length > 500) {
                setParseError('El archivo supera el límite de 500 clientes por importación.');
                return;
            }
            setParsed(clients);
            setStep('preview');
        };
        reader.readAsText(file, 'UTF-8');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleImport = async () => {
        setLoading(true);
        try {
            const res = await importClientsFromCsvAction(parsed);
            setResult(res);
            setStep('done');
            if (res.inserted > 0) onSuccess();
        } catch (err) {
            setParseError(err instanceof Error ? err.message : 'Error al importar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Importar clientes</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Sube un CSV con tu lista de clientes</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {step === 'upload' && (
                        <div className="space-y-4">
                            {/* Drop zone */}
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isDragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => inputRef.current?.click()}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <Upload size={24} className="text-indigo-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Arrastra tu CSV aquí</p>
                                    <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar archivo</p>
                                </div>
                                <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                            </div>

                            {parseError && (
                                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-3">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <span>{parseError}</span>
                                </div>
                            )}

                            {/* Template download */}
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <FileText size={16} className="text-slate-400" />
                                    <span className="text-sm">¿Primera vez? Descarga la plantilla</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); downloadTemplate(); }}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                >
                                    <Download size={13} /> Plantilla CSV
                                </button>
                            </div>

                            {/* Format guide */}
                            <div className="text-xs text-slate-400 space-y-1">
                                <p className="font-medium text-slate-500 dark:text-slate-400">Columnas soportadas:</p>
                                <p className="font-mono bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-[11px] leading-relaxed break-all">
                                    nombre*, email, telefono, cups, factura_media, proveedor, tipo_tarifa, tipo, estado, dni_cif, ciudad, codigo_postal
                                </p>
                                <p>* obligatorio · tipo: particular/empresa/residencial · estado: nuevo/contactado/en_proceso/ganado/perdido</p>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                {parsed.length} clientes listos para importar
                            </div>

                            {/* Preview table */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="overflow-x-auto max-h-72">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                            <tr>
                                                {['Nombre', 'Email', 'CUPS', 'Factura', 'Tipo', 'Estado'].map(h => (
                                                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {parsed.slice(0, 20).map((c, i) => (
                                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 max-w-[140px] truncate">{c.name}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[140px] truncate">{c.email ?? '—'}</td>
                                                    <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{c.cups ?? '—'}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{c.average_monthly_bill ? `${c.average_monthly_bill}€` : '—'}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{c.type ?? '—'}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{c.status ?? 'new'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {parsed.length > 20 && (
                                    <div className="px-3 py-2 text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                                        Mostrando 20 de {parsed.length} filas
                                    </div>
                                )}
                            </div>

                            {parseError && (
                                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-3">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <span>{parseError}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="space-y-4 py-4">
                            <div className="flex flex-col items-center gap-3 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">Importación completada</p>
                                    <p className="text-sm text-slate-500 mt-1">{result.inserted} clientes importados</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Importados', value: result.inserted, color: 'text-emerald-600' },
                                    { label: 'Omitidos (dup.)', value: result.skipped, color: 'text-amber-600' },
                                    { label: 'Errores', value: result.errors.length, color: 'text-red-500' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                        <div className="text-[11px] text-slate-500 mt-1">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {result.errors.length > 0 && (
                                <div className="rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4">
                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Filas con errores:</p>
                                    <ul className="space-y-1">
                                        {result.errors.map((e, i) => (
                                            <li key={i} className="text-xs text-red-600 dark:text-red-400">{e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3">
                    {step === 'preview' && (
                        <button
                            type="button"
                            onClick={() => { setStep('upload'); setParsed([]); setParseError(null); }}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                        >
                            ← Cambiar archivo
                        </button>
                    )}
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            {step === 'done' ? 'Cerrar' : 'Cancelar'}
                        </button>
                        {step === 'preview' && (
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={loading}
                                className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Importando…' : `Importar ${parsed.length} clientes`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
