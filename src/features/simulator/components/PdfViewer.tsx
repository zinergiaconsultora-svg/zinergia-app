'use client';

/**
 * PdfViewer — visor de PDF con zoom, navegación y búsqueda de texto.
 *
 * ARQUITECTURA FULLSCREEN:
 * position:fixed dentro de un motion.div (framer-motion) NO funciona.
 * Framer aplica CSS transforms que crean un nuevo stacking context,
 * haciendo que fixed sea relativo al ancestor transformado en lugar del viewport.
 *
 * Solución: createPortal al document.body para el modo pantalla completa,
 * con z-index 9999. El visor inline permanece montado (invisible) para
 * mantener el estado (página, zoom) y el ResizeObserver activo.
 */

import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Minimize2,
    FileText,
    MapPin,
    Crosshair,
    PanelRightOpen,
    PanelRightClose,
} from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ── Public API ────────────────────────────────────────────────────────────────

export interface PdfViewerHandle {
    locate: (value: string) => void;
}

export interface ConfidenceField {
    label: string;
    value: string;
    score: number; // 0-1
}

interface PdfViewerProps {
    url: string;
    className?: string;
    confidenceFields?: ConfidenceField[];
}

// ── Highlight CSS ─────────────────────────────────────────────────────────────

const HIGHLIGHT_STYLE = `
  .react-pdf__Page__textContent mark.pdf-hl {
    background: rgba(251,191,36,0.55);
    border-radius: 3px;
    padding: 1px 2px;
    color: inherit;
    box-shadow: 0 0 0 2px rgba(251,191,36,0.4);
    animation: pdf-hl-in 0.25s ease-out;
  }
  @keyframes pdf-hl-in {
    from { background: rgba(251,191,36,0.9); box-shadow: 0 0 0 4px rgba(251,191,36,0.6); }
    to   { background: rgba(251,191,36,0.55); box-shadow: 0 0 0 2px rgba(251,191,36,0.4); }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
    ({ url, className, confidenceFields }, ref) => {
        // ── Estado compartido entre inline y fullscreen ───────────────────────
        const [numPages, setNumPages] = useState(0);
        const [pageNumber, setPageNumber] = useState(1);
        const [scale, setScale] = useState(1);
        const [fitWidth, setFitWidth] = useState(true);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
        const [foundOnPage, setFoundOnPage] = useState<boolean | null>(null);
        // Portal solo disponible en cliente — isMounted derived from typeof window
        const [portalMounted] = useState(typeof window !== 'undefined');
        const [showConfPanel, setShowConfPanel] = useState(false);

        // Refs para medición de ancho
        const inlineContainerRef = useRef<HTMLDivElement>(null);
        const fsContainerRef = useRef<HTMLDivElement>(null);
        const inlineScrollRef = useRef<HTMLDivElement>(null);
        const fsScrollRef = useRef<HTMLDivElement>(null);
        const [inlineWidth, setInlineWidth] = useState(0);
        const [fsWidth, setFsWidth] = useState(0);

        const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        // ── Medir ancho inline ────────────────────────────────────────────────
        useEffect(() => {
            const el = inlineContainerRef.current;
            if (!el) return;
            const measure = () => {
                const w = el.clientWidth - 32;
                setInlineWidth(w > 0 ? w : 0);
            };
            measure();
            const ro = new ResizeObserver(measure);
            ro.observe(el);
            return () => ro.disconnect();
        }, []);

        // ── Medir ancho fullscreen ────────────────────────────────────────────
        useEffect(() => {
            if (!isFullscreen) return;
            // Esperar un frame para que el portal se haya pintado
            const frame = requestAnimationFrame(() => {
                const el = fsContainerRef.current;
                if (!el) return;
                const measure = () => {
                    const w = el.clientWidth - 32;
                    setFsWidth(w > 0 ? w : 0);
                };
                measure();
                const ro = new ResizeObserver(measure);
                ro.observe(el);
                // Guardamos el observer para cleanup
                (fsContainerRef as React.MutableRefObject<HTMLDivElement & { _ro?: ResizeObserver }>).current._ro = ro;
            });
            return () => {
                cancelAnimationFrame(frame);
                (fsContainerRef as React.MutableRefObject<(HTMLDivElement & { _ro?: ResizeObserver }) | null>).current?._ro?.disconnect();
            };
        }, [isFullscreen]);

        // ── ESC cierra fullscreen ─────────────────────────────────────────────
        useEffect(() => {
            if (!isFullscreen) return;
            const handler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setIsFullscreen(false);
            };
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }, [isFullscreen]);

        // ── Scroll a la primera marca después del render ──────────────────────
        useEffect(() => {
            if (!highlightQuery) return;
            const scrollRef = isFullscreen ? fsScrollRef : inlineScrollRef;
            const timer = setTimeout(() => {
                const mark = scrollRef.current?.querySelector('mark.pdf-hl');
                if (mark) {
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setFoundOnPage(true);
                } else {
                    setFoundOnPage(false);
                }
            }, 250);
            return () => clearTimeout(timer);
        }, [highlightQuery, pageNumber, isFullscreen]);

        // ── Limpiar highlight tras 3.5 s ──────────────────────────────────────
        useEffect(() => {
            if (!highlightQuery) return;
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => {
                setHighlightQuery(null);
                setFoundOnPage(null);
            }, 3500);
            return () => { if (clearTimerRef.current) clearTimeout(clearTimerRef.current); };
        }, [highlightQuery]);

        // ── Expose locate() ───────────────────────────────────────────────────
        useImperativeHandle(ref, () => ({
            locate(value: string) {
                const clean = value?.toString().trim();
                if (!clean || clean === '0') return;
                setHighlightQuery(clean);
                setFoundOnPage(null);
                setPageNumber(1);
            },
        }));

        // ── Custom renderer con highlight ─────────────────────────────────────
        const customTextRenderer = useCallback(
            ({ str }: { str: string }): string => {
                if (!highlightQuery || !str) return str;
                const escaped = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return str.replace(
                    new RegExp(`(${escaped})`, 'gi'),
                    '<mark class="pdf-hl">$1</mark>',
                );
            },
            [highlightQuery],
        );

        // ── Builders ──────────────────────────────────────────────────────────

        const buildToolbar = (fs: boolean) => (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800 flex-shrink-0 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={13} className="text-slate-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                        Factura original
                    </span>
                </div>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-25 transition-colors"
                        title="Página anterior"
                    >
                        <ChevronLeft size={13} />
                    </button>
                    <span className="text-[11px] text-slate-300 font-mono tabular-nums w-14 text-center select-none">
                        {pageNumber} / {numPages || '—'}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-25 transition-colors"
                        title="Página siguiente"
                    >
                        <ChevronRight size={13} />
                    </button>
                    <div className="w-px h-3.5 bg-slate-700 mx-1" />
                    <button
                        type="button"
                        onClick={() => { setFitWidth(false); setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2))); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Alejar"
                    >
                        <ZoomOut size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setFitWidth(f => !f)}
                        className={cn(
                            'px-2 py-1 rounded-lg text-[10px] font-bold transition-colors min-w-[52px] text-center',
                            fitWidth
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800',
                        )}
                        title={fitWidth ? 'Modo ajustar (activo) — click para zoom libre' : 'Ajustar al ancho'}
                    >
                        {fitWidth ? 'Ajustar' : `${Math.round(scale * 100)}%`}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setFitWidth(false); setScale(s => Math.min(3, +(s + 0.25).toFixed(2))); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Acercar"
                    >
                        <ZoomIn size={13} />
                    </button>
                    <div className="w-px h-3.5 bg-slate-700 mx-1" />
                    {confidenceFields && confidenceFields.length > 0 && (
                        <>
                            <div className="w-px h-3.5 bg-slate-700 mx-1" />
                            <button
                                type="button"
                                onClick={() => setShowConfPanel(v => !v)}
                                className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    showConfPanel
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800',
                                )}
                                title="Panel de confianza OCR"
                            >
                                {showConfPanel ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                            </button>
                        </>
                    )}
                    <div className="w-px h-3.5 bg-slate-700 mx-1" />
                    <button
                        type="button"
                        onClick={() => setIsFullscreen(f => !f)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={fs ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
                    >
                        {fs ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>
        );

        const buildSearchFeedback = () => highlightQuery ? (
            <AnimatePresence>
                <motion.div
                    key="feedback"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={cn(
                        'absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg pointer-events-none',
                        foundOnPage === false ? 'bg-slate-700 text-slate-300' : 'bg-amber-400 text-amber-950',
                    )}
                >
                    <MapPin size={11} />
                    {foundOnPage === false
                        ? 'No encontrado en esta página'
                        : foundOnPage === true
                          ? `"${highlightQuery}" localizado`
                          : `Buscando "${highlightQuery}"…`}
                </motion.div>
            </AnimatePresence>
        ) : null;

        const buildConfidencePanel = () => {
            if (!confidenceFields || confidenceFields.length === 0 || !showConfPanel) return null;
            return (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 200, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 bg-slate-850 border-l border-slate-700 overflow-hidden flex flex-col"
                    style={{ background: 'rgb(15 23 42)' }}
                >
                    <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
                        <Crosshair size={11} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confianza OCR</span>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2">
                        {confidenceFields.map((f) => {
                            const pct = Math.round(f.score * 100);
                            const color = f.score >= 0.9 ? 'bg-emerald-500' : f.score >= 0.7 ? 'bg-amber-400' : 'bg-red-400';
                            const textColor = f.score >= 0.9 ? 'text-emerald-400' : f.score >= 0.7 ? 'text-amber-400' : 'text-red-400';
                            return (
                                <button
                                    key={f.label}
                                    type="button"
                                    onClick={() => {
                                        setHighlightQuery(f.value?.toString().trim() || null);
                                        setFoundOnPage(null);
                                        setPageNumber(1);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 transition-colors group text-left"
                                    title={`Localizar "${f.value}" en la factura`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-slate-500 uppercase tracking-wide leading-none mb-0.5">{f.label}</p>
                                        <p className="text-[10px] text-slate-300 truncate font-mono leading-none">{f.value || '—'}</p>
                                    </div>
                                    <span className={`text-[9px] font-black tabular-nums shrink-0 ${textColor}`}>{pct}%</span>
                                    <MapPin size={9} className="text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            );
        };

        const buildPdfContent = (
            scrollRef: React.RefObject<HTMLDivElement | null>,
            width: number,
        ) => {
            const panelWidth = showConfPanel && confidenceFields && confidenceFields.length > 0 ? 200 : 0;
            const w = fitWidth && width > 0 ? Math.max(width - panelWidth, 200) : undefined;
            const s = fitWidth ? undefined : scale;
            return (
                <div className="absolute inset-0 flex overflow-hidden">
                    <div ref={scrollRef} className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4">
                        <Document
                            file={url}
                            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                            loading={
                                <div className="flex items-center justify-center h-48 w-full">
                                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                </div>
                            }
                            error={
                                <div className="flex flex-col items-center gap-2 text-slate-500 text-sm p-12">
                                    <FileText size={32} className="opacity-40" />
                                    <span>No se pudo cargar el documento</span>
                                </div>
                            }
                        >
                            {(w !== undefined || !fitWidth) && (
                                <Page
                                    pageNumber={pageNumber}
                                    width={w}
                                    scale={s}
                                    renderTextLayer
                                    renderAnnotationLayer={false}
                                    customTextRenderer={customTextRenderer}
                                    className="shadow-2xl shadow-black/60"
                                />
                            )}
                        </Document>
                    </div>
                    <AnimatePresence>
                        {buildConfidencePanel()}
                    </AnimatePresence>
                </div>
            );
        };

        // ── Render ─────────────────────────────────────────────────────────────
        return (
            <>
                <style>{HIGHLIGHT_STYLE}</style>

                {/* ── Inline viewer ─────────────────────────────────────────── */}
                {/* Siempre montado; invisible cuando fullscreen para mantener */}
                {/* el ResizeObserver activo y el estado (página, zoom) intacto. */}
                <div
                    ref={inlineContainerRef}
                    className={cn(
                        'flex flex-col bg-slate-900 rounded-2xl border border-slate-700/60 overflow-hidden',
                        isFullscreen ? 'invisible' : '',
                        className,
                    )}
                >
                    {buildToolbar(false)}
                    <div className="relative flex-1 min-h-0 overflow-hidden">
                        {!isFullscreen && buildSearchFeedback()}
                        {buildPdfContent(inlineScrollRef, inlineWidth)}
                    </div>
                </div>

                {/* ── Fullscreen portal ─────────────────────────────────────── */}
                {/* createPortal escapa el stacking context de framer-motion.   */}
                {/* z-[9999] garantiza que esté por encima de todo.              */}
                {portalMounted && isFullscreen && createPortal(
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[9999] flex flex-col bg-slate-900"
                        ref={fsContainerRef}
                    >
                        {buildToolbar(true)}
                        <div className="relative flex-1 min-h-0 overflow-hidden">
                            {buildSearchFeedback()}
                            {buildPdfContent(fsScrollRef, fsWidth)}
                        </div>
                    </motion.div>,
                    document.body,
                )}
            </>
        );
    },
);

PdfViewer.displayName = 'PdfViewer';
