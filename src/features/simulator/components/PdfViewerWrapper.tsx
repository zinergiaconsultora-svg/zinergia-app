'use client';

/**
 * Wrapper de carga diferida para PdfViewer.
 *
 * pdfjs-dist usa DOMMatrix en la evaluación del módulo, lo que rompe SSR en Next.js
 * (Node.js no tiene DOMMatrix). Este wrapper importa PdfViewer solo en el cliente
 * usando useEffect, manteniendo el forwardRef para locate() intacto.
 */

import React, {
    forwardRef,
    useRef,
    useImperativeHandle,
    useState,
    useEffect,
} from 'react';
import type { PdfViewerHandle } from './PdfViewer';

interface PdfViewerWrapperProps {
    url: string;
    className?: string;
}

type PdfViewerComponent = React.ComponentType<{
    url: string;
    className?: string;
    ref?: React.Ref<PdfViewerHandle>;
}>;

export const PdfViewerWrapper = forwardRef<PdfViewerHandle, PdfViewerWrapperProps>(
    ({ url, className }, ref) => {
        const [Viewer, setViewer] = useState<PdfViewerComponent | null>(null);
        const innerRef = useRef<PdfViewerHandle>(null);

        useEffect(() => {
            import('./PdfViewer').then(m => {
                // useState con funciones: envolver en () => para que React no lo invoque como initializer
                setViewer(() => m.PdfViewer as unknown as PdfViewerComponent);
            });
        }, []);

        useImperativeHandle(ref, () => ({
            locate(value: string) {
                innerRef.current?.locate(value);
            },
        }));

        if (!Viewer) {
            return (
                <div
                    className={`bg-slate-900 rounded-2xl border border-slate-700/60 flex items-center justify-center ${className}`}
                >
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
            );
        }

        return <Viewer ref={innerRef} url={url} className={className} />;
    },
);

PdfViewerWrapper.displayName = 'PdfViewerWrapper';
