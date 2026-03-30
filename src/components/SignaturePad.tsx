'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
    onSignature: (dataUrl: string | null) => void;
    label?: string;
}

export function SignaturePad({ onSignature, label = 'Firma aquí' }: SignaturePadProps) {
    const sigRef = useRef<SignatureCanvas>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [containerWidth, setContainerWidth] = useState(400);
    const containerRef = useRef<HTMLDivElement>(null);

    // Adaptar ancho del canvas al contenedor responsive
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };
        updateWidth();
        const ro = new ResizeObserver(updateWidth);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const handleEnd = useCallback(() => {
        if (!sigRef.current) return;
        const empty = sigRef.current.isEmpty();
        setIsEmpty(empty);
        onSignature(empty ? null : sigRef.current.toDataURL('image/png'));
    }, [onSignature]);

    const handleClear = useCallback(() => {
        sigRef.current?.clear();
        setIsEmpty(true);
        onSignature(null);
    }, [onSignature]);

    return (
        <div className="w-full space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{label}</span>
                {!isEmpty && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <RotateCcw size={11} />
                        Borrar
                    </button>
                )}
            </div>

            <div
                ref={containerRef}
                className={`relative w-full rounded-2xl border-2 transition-colors overflow-hidden ${
                    isEmpty
                        ? 'border-dashed border-slate-200 bg-slate-50'
                        : 'border-indigo-200 bg-white'
                }`}
            >
                <SignatureCanvas
                    ref={sigRef}
                    onEnd={handleEnd}
                    canvasProps={{
                        width: containerWidth,
                        height: 144,
                        className: 'w-full touch-none',
                    }}
                    backgroundColor="transparent"
                    penColor="#1e293b"
                    dotSize={2}
                    minWidth={1.5}
                    maxWidth={3}
                    velocityFilterWeight={0.7}
                />

                {/* Placeholder line */}
                {isEmpty && (
                    <div className="absolute bottom-7 left-8 right-8 pointer-events-none">
                        <div className="border-b border-slate-200" />
                        <p className="text-center text-[10px] text-slate-300 mt-1.5">Traza tu firma con el dedo o ratón</p>
                    </div>
                )}
            </div>

            {!isEmpty && (
                <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Firma registrada
                </p>
            )}
        </div>
    );
}
