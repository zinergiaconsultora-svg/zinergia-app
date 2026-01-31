'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { analyzeDocumentWithRetry } from '@/services/simulatorService';

export function QuickUploadZone() {
    const router = useRouter();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        try {
            const result = await analyzeDocumentWithRetry(file);
            // Store result in localStorage for the simulator page to pick up
            localStorage.setItem('pendingInvoiceData', JSON.stringify(result));
            router.push('/dashboard/simulator');
        } catch (error) {
            console.error('Error analyzing document:', error);
            alert('Error al analizar el documento. Por favor, intente de nuevo.');
        } finally {
            setIsAnalyzing(false);
        }
    }, [router]);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        
        const file = e.dataTransfer.files[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Por favor, sube un archivo PDF válido');
            return;
        }

        setIsAnalyzing(true);
        try {
            const result = await analyzeDocumentWithRetry(file);
            localStorage.setItem('pendingInvoiceData', JSON.stringify(result));
            router.push('/dashboard/simulator');
        } catch (error) {
            console.error('Error analyzing document:', error);
            alert('Error al analizar el documento. Por favor, intente de nuevo.');
        } finally {
            setIsAnalyzing(false);
        }
    }, [router]);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    return (
        <div className="w-full lg:w-[450px] shrink-0">
            <label className="block w-full h-full cursor-pointer group/upload">
                <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isAnalyzing}
                />
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`relative glass-premium border-2 border-dashed transition-all rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg ${
                        isDragging 
                            ? 'border-indigo-500 bg-white/60' 
                            : 'border-indigo-200/50 hover:border-indigo-400/50 bg-white/40 hover:bg-white/60'
                    }`}
                >
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4 group-hover/upload:scale-110 transition-transform">
                        {isAnalyzing ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                        ) : (
                            <Upload size={28} />
                        )}
                    </div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                        {isAnalyzing ? 'Analizando...' : 'Cargar Nueva Factura'}
                    </div>
                    <div className="text-xs text-slate-400 font-medium text-center">
                        {isAnalyzing ? 'Procesando documento...' : 'Arrastra aquí o haz clic para subir tu PDF'}
                    </div>
                </div>
            </label>
        </div>
    );
}
