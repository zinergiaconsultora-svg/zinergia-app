'use client';

import React, { useState, useCallback, useTransition } from 'react';
import {
    createAcademyResource,
    updateAcademyResource,
    deleteAcademyResource,
    type AcademyResource,
} from '@/app/actions/academy';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, EyeOff, FileText, Video, Link as LinkIcon, X, Check } from 'lucide-react';

const CATEGORIES = [
    { value: 'training', label: 'Formación' },
    { value: 'contract', label: 'Contratos' },
    { value: 'marketing', label: 'Marketing' },
];

const FILE_TYPES = [
    { value: 'pdf', label: 'PDF', icon: FileText },
    { value: 'video', label: 'Vídeo', icon: Video },
    { value: 'link', label: 'Enlace', icon: LinkIcon },
];

const ROLE_RESTRICTIONS = [
    { value: 'agent', label: 'Todos (Agentes+)' },
    { value: 'franchise', label: 'Franquicia+' },
    { value: 'admin', label: 'Solo Admin' },
];

const EMPTY_FORM = {
    title: '',
    description: '',
    category: 'training',
    file_url: '',
    file_type: 'pdf',
    role_restriction: 'agent',
    is_published: true,
};

interface Props {
    initialResources: AcademyResource[];
}

export default function AcademyAdmin({ initialResources }: Props) {
    const [resources, setResources] = useState<AcademyResource[]>(initialResources);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isPending, startTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
    };

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(true);
    };

    const openEdit = (res: AcademyResource) => {
        setForm({
            title: res.title,
            description: res.description ?? '',
            category: res.category,
            file_url: res.file_url,
            file_type: res.file_type ?? 'pdf',
            role_restriction: res.role_restriction,
            is_published: res.is_published,
        });
        setEditingId(res.id);
        setShowForm(true);
    };

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim() || !form.file_url.trim()) {
            toast.error('Título y URL son obligatorios');
            return;
        }

        startTransition(async () => {
            try {
                if (editingId) {
                    await updateAcademyResource(editingId, form);
                    setResources(prev => prev.map(r => r.id === editingId ? { ...r, ...form } : r));
                    toast.success('Recurso actualizado');
                } else {
                    const created = await createAcademyResource(form);
                    setResources(prev => [created, ...prev]);
                    toast.success('Recurso creado');
                }
                resetForm();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Error al guardar');
            }
        });
    }, [form, editingId]);

    const handleTogglePublish = useCallback((res: AcademyResource) => {
        startTransition(async () => {
            try {
                await updateAcademyResource(res.id, { is_published: !res.is_published });
                setResources(prev => prev.map(r => r.id === res.id ? { ...r, is_published: !r.is_published } : r));
            } catch {
                toast.error('Error al cambiar visibilidad');
            }
        });
    }, []);

    const handleDelete = useCallback((id: string) => {
        setDeletingId(id);
    }, []);

    const confirmDelete = useCallback((id: string) => {
        startTransition(async () => {
            try {
                await deleteAcademyResource(id);
                setResources(prev => prev.filter(r => r.id !== id));
                toast.success('Recurso eliminado');
            } catch {
                toast.error('Error al eliminar');
            } finally {
                setDeletingId(null);
            }
        });
    }, []);

    const typeIcon = (type: string | null) => {
        if (type === 'video') return <Video size={14} />;
        if (type === 'link') return <LinkIcon size={14} />;
        return <FileText size={14} />;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Recursos Academy</h2>
                    <p className="text-xs text-slate-400 mt-1">{resources.length} recurso{resources.length !== 1 ? 's' : ''} en total</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
                >
                    <Plus size={16} />
                    Nuevo recurso
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form
                        onSubmit={handleSubmit}
                        className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-semibold text-white">
                                {editingId ? 'Editar recurso' : 'Nuevo recurso'}
                            </h3>
                            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Título *</label>
                            <input
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                placeholder="Ej: Manual de Bienvenida"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 resize-none"
                                rows={2}
                                placeholder="Descripción breve del recurso"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Categoría</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                >
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Tipo de archivo</label>
                                <select
                                    value={form.file_type}
                                    onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                >
                                    {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">URL del recurso *</label>
                            <input
                                value={form.file_url}
                                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 font-mono"
                                placeholder="https://... o ruta en Supabase Storage"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Visibilidad de rol</label>
                                <select
                                    value={form.role_restriction}
                                    onChange={e => setForm(f => ({ ...f, role_restriction: e.target.value }))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                >
                                    {ROLE_RESTRICTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div
                                        onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${form.is_published ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_published ? 'translate-x-5' : ''}`} />
                                    </div>
                                    <span className="text-xs text-slate-300">{form.is_published ? 'Publicado' : 'Oculto'}</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                            >
                                {isPending ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear recurso'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Resources Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                {resources.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-slate-400 text-sm">No hay recursos. Crea el primero.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Recurso</th>
                                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-3 hidden md:table-cell">Categoría</th>
                                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-3 hidden lg:table-cell">Rol</th>
                                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-3">Estado</th>
                                <th className="px-3 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {resources.map(res => (
                                <tr key={res.id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">{typeIcon(res.file_type)}</span>
                                            <div>
                                                <div className="font-medium text-white text-sm">{res.title}</div>
                                                {res.description && (
                                                    <div className="text-xs text-slate-400 truncate max-w-xs">{res.description}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 hidden md:table-cell">
                                        <span className="text-xs text-slate-300 capitalize">{res.category}</span>
                                    </td>
                                    <td className="px-3 py-3 hidden lg:table-cell">
                                        <span className="text-xs text-slate-400">{res.role_restriction}</span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <button
                                            onClick={() => handleTogglePublish(res)}
                                            disabled={isPending}
                                            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                                                res.is_published
                                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                            }`}
                                        >
                                            {res.is_published ? <Eye size={11} /> : <EyeOff size={11} />}
                                            {res.is_published ? 'Publicado' : 'Oculto'}
                                        </button>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => openEdit(res)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            {deletingId === res.id ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => confirmDelete(res.id)}
                                                        disabled={isPending}
                                                        className="p-1.5 text-red-400 hover:text-white hover:bg-red-600 rounded-lg transition-colors"
                                                        title="Confirmar"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingId(null)}
                                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleDelete(res.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
