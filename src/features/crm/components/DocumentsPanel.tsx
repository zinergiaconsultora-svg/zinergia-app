'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    File,
    Upload,
    Download,
    Trash2,
    Loader2,
    FileText,
    CreditCard,
    User,
    Building2,
    Paperclip,
} from 'lucide-react';
import { ClientDocument, DocumentCategory } from '@/types/crm';
import { documentsService } from '@/services/crm/documents';
import { toast } from 'sonner';

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: React.ElementType; color: string }> = {
    factura: { label: 'Factura', icon: FileText, color: 'text-amber-500' },
    contrato: { label: 'Contrato', icon: CreditCard, color: 'text-blue-500' },
    dni: { label: 'DNI/NIE', icon: User, color: 'text-indigo-500' },
    escritura: { label: 'Escritura', icon: Building2, color: 'text-purple-500' },
    otro: { label: 'Otro', icon: Paperclip, color: 'text-slate-400' },
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsPanelProps {
    clientId: string;
}

export default function DocumentsPanel({ clientId }: DocumentsPanelProps) {
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('otro');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await documentsService.getDocumentsByClient(clientId);
            if (cancelled) return;
            setDocuments(data);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [clientId]);

    const load = useCallback(async () => {
        const data = await documentsService.getDocumentsByClient(clientId);
        setDocuments(data);
    }, [clientId]);

    const handleUpload = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        // Validación Defensiva
        const MAX_SIZE = 15 * 1024 * 1024; // 15MB
        const BANNED_EXTENSIONS = ['.exe', '.bat', '.sh', '.js', '.cmd', '.msi'];

        const validFiles = fileArray.filter(file => {
            if (file.size > MAX_SIZE) {
                toast.error(`${file.name} supera el límite de 15MB`);
                return false;
            }
            const nameLower = file.name.toLowerCase();
            if (BANNED_EXTENSIONS.some(ext => nameLower.endsWith(ext))) {
                toast.error(`${file.name}: tipo de archivo no permitido por seguridad`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        setUploading(true);
        for (const file of validFiles) {
            await documentsService.uploadDocument(clientId, file, uploadCategory);
        }
        setUploading(false);
        load();
    };

    const handleDownload = async (doc: ClientDocument) => {
        const url = await documentsService.getDownloadUrl(doc);
        if (!url) return;
        window.open(url, '_blank');
    };

    const handleDelete = async (doc: ClientDocument) => {
        await documentsService.deleteDocument(doc);
        load();
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const fileArray = Array.from(e.dataTransfer.files);
        if (fileArray.length === 0) return;
        const MAX_SIZE = 15 * 1024 * 1024;
        const BANNED_EXTENSIONS = ['.exe', '.bat', '.sh', '.js', '.cmd', '.msi'];
        const validFiles = fileArray.filter(file => {
            if (file.size > MAX_SIZE) { toast.error(`${file.name} supera el límite de 15MB`); return false; }
            const nameLower = file.name.toLowerCase();
            if (BANNED_EXTENSIONS.some(ext => nameLower.endsWith(ext))) { toast.error(`${file.name}: tipo de archivo no permitido`); return false; }
            return true;
        });
        if (validFiles.length === 0) return;
        setUploading(true);
        (async () => {
            for (const file of validFiles) {
                await documentsService.uploadDocument(clientId, file, uploadCategory);
            }
            setUploading(false);
            const data = await documentsService.getDocumentsByClient(clientId);
            setDocuments(data);
        })();
    }, [uploadCategory, clientId]);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const onDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Documentos</h3>
                {documents.length > 0 && (
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {documents.length}
                    </span>
                )}
            </div>

            {/* Drop zone */}
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors mb-3 ${
                    dragOver
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
                />
                {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto" />
                ) : (
                    <>
                        <Upload className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] text-slate-400">Arrastra archivos o haz clic</p>
                    </>
                )}
            </div>

            {/* Category selector for next upload */}
            <div className="flex flex-wrap gap-1 mb-3">
                {(Object.keys(CATEGORY_CONFIG) as DocumentCategory[]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setUploadCategory(cat)}
                        className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                            uploadCategory === cat
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {CATEGORY_CONFIG[cat].label}
                    </button>
                ))}
            </div>

            {/* Document list */}
            {documents.length === 0 ? (
                <p className="text-center text-[10px] text-slate-400 py-4">Sin documentos</p>
            ) : (
                <div className="space-y-1.5">
                    {documents.map(doc => {
                        const catConfig = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.otro;
                        const CatIcon = catConfig.icon;

                        return (
                            <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${doc.category === 'otro' ? 'bg-slate-50' : 'bg-slate-50'}`}>
                                    <CatIcon size={14} className={catConfig.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{doc.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-slate-400">{formatFileSize(doc.size_bytes)}</span>
                                        <span className={`text-[9px] px-1 py-0.5 rounded bg-slate-50 ${catConfig.color}`}>{catConfig.label}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Descargar"
                                    >
                                        <Download size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(doc)}
                                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
