'use client';

import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

// ── Public API ────────────────────────────────────────────────────────────────

export interface PdfViewerHandle {
    /**
     * Busca `value` en la capa de texto del PDF actual.
     * Hace scroll hasta la primera coincidencia y la resalta durante 3 s.
     * Si no hay capa de texto (PDF escaneado) no hace nada.
     */
    locate: (value: string) => void;
}

interface PdfViewerProps {
    url: string;
    className?: string;
}

// ── Highlight styles (inyectadas una vez en el DOM) ───────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
    ({ url, className }, ref) => {
        const [numPages, setNumPages] = useState(0);
        const [pageNumber, setPageNumber] = useState(1);
        const [scale, setScale] = useState(1);
        const [fitWidth, setFitWidth] = useState(true);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
        const [foundOnPage, setFoundOnPage] = useState<boolean | null>(null);
        const [containerWidth, setContainerWidth] = useState(0);

        const containerRef = useRef<HTMLDivElement>(null);
        const scrollAreaRef = useRef<HTMLDivElement>(null);
        const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        // ── Medir ancho del contenedor para fit-width ─────────────────────────
        useEffect(() => {
            const el = scrollAreaRef.current;
            if (!el) return;
            const ro = new ResizeObserver(([entry]) => {
                setContainerWidth((entry.contentRect.width - 32) || 0);
            });
            ro.observe(el);
            return () => ro.disconnect();
        }, [isFullscreen]); // re-observe cuando cambia fullscreen

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
            const timer = setTimeout(() => {
                const mark = scrollAreaRef.current?.querySelector('mark.pdf-hl');
                if (mark) {
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setFoundOnPage(true);
                } else {
                    setFoundOnPage(false);
                }
            }, 200);
            return () => clearTimeout(timer);
        }, [highlightQuery, pageNumber]);

        // ── Borrar highlight tras 3 s ─────────────────────────────────────────
        useEffect(() => {
            if (!highlightQuery) return;
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => {
                setHighlightQuery(null);
                setFoundOnPage(null);
            }, 3500);
            return () => {
                if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            };
        }, [highlightQuery]);

        // ── Expose locate() ───────────────────────────────────────────────────
        useImperativeHandle(ref, () => ({
            locate(value: string) {
                const clean = value?.toString().trim();
                if (!clean || clean === '0') return;
                setHighlightQuery(clean);
                setFoundOnPage(null);
                // Empezar búsqueda desde página 1 para no perderse nada
                setPageNumber(1);
            },
        }));

        // ── Custom text renderer con highlight ───────────────────────────────
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

        const pageWidthProp = fitWidth && containerWidth > 0 ? containerWidth : undefined;
        const scaleProp = fitWidth ? undefined : scale;

        // ── Toolbar ───────────────────────────────────────────────────────────
        const toolbar = (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800 flex-shrink-0 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={13} className="text-slate-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                        Factura original
                    </span>
                </div>

                <div className="flex items-center gap-0.5">
                    {/* Navegación de páginas */}
                    <button
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-25 transition-colors"
                        title="Página anterior"
                    >
                        <ChevronLeft size={13} />
                    </button>
                    <span className="text-[11px] text-slate-300 font-mono tabular-nums w-16 text-center select-none">
                        {pageNumber} / {numPages || '—'}
                    </span>
                    <button
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-25 transition-colors"
                        title="Página siguiente"
                    >
                        <ChevronRight size={13} />
                    </button>

                    <div className="w-px h-3.5 bg-slate-700 mx-1" />

                    {/* Zoom */}
                    <button
                        onClick={() => { setFitWidth(false); setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2))); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Alejar"
                    >
                        <ZoomOut size={13} />
                    </button>
                    <button
                        onClick={() => setFitWidth(f => !f)}
                        className={cn(
                            'px-2 py-1 rounded-lg text-[10px] font-bold transition-colors min-w-[52px] text-center',
                            fitWidth
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800',
                        )}
                        title={fitWidth ? 'Modo ajustar al ancho (activo)' : 'Ajustar al ancho'}
                    >
                        {fitWidth ? 'Ajustar' : `${Math.round(scale * 100)}%`}
                    </button>
                    <button
                        onClick={() => { setFitWidth(false); setScale(s => Math.min(3, +(s + 0.25).toFixed(2))); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Acercar"
                    >
                        <ZoomIn size={13} />
                    </button>

                    <div className="w-px h-3.5 bg-slate-700 mx-1" />

                    {/* Fullscreen */}
                    <button
                        onClick={() => setIsFullscreen(f => !f)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
                    >
                        {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>
        );

        // ── Feedback de búsqueda ──────────────────────────────────────────────
        const searchFeedback = highlightQuery && (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={cn(
                        'absolute top-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg',
                        foundOnPage === false
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-amber-400 text-amber-950',
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
        );

        // ── PDF content ───────────────────────────────────────────────────────
        const pdfContent = (
            <div ref={scrollAreaRef} className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4">
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
                    <Page
                        pageNumber={pageNumber}
                        width={pageWidthProp}
                        scale={scaleProp}
                        renderTextLayer
                        renderAnnotationLayer={false}
                        customTextRenderer={customTextRenderer}
                        className="shadow-2xl shadow-black/60"
                        loading={
                            <div className="bg-slate-800 animate-pulse rounded" style={{ width: pageWidthProp || 600, height: 848 }} />
                        }
                    />
                </Document>
            </div>
        );

        // ── Shell ─────────────────────────────────────────────────────────────
        return (
            <>
                <style>{HIGHLIGHT_STYLE}</style>

                <div
                    ref={containerRef}
                    className={cn(
                        'flex flex-col bg-slate-900 overflow-hidden transition-all duration-300',
                        isFullscreen
                            ? 'fixed inset-0 z-50 rounded-none'
                            : cn('rounded-2xl border border-slate-700/60', className),
                    )}
                >
                    {toolbar}
                    <div className="relative flex-1 min-h-0">
                        {searchFeedback}
                        {pdfContent}
                    </div>
                </div>
            </>
        );
    },
);

PdfViewer.displayName = 'PdfViewer';
