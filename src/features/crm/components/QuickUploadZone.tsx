'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { useSimulatorContext } from '@/features/simulator/contexts/SimulatorContext';

export function QuickUploadZone() {
    const router = useRouter();
    const {
        handleFileUpload,
        handleDrop,
        handleDragOver,
        isAnalyzing
    } = useSimulatorContext();

    return (
        <div className="w-full lg:w-[450px] shrink-0">
            <label className="block w-full h-full cursor-pointer group/upload">
                <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                        handleFileUpload(e);
                        router.push('/dashboard/simulator');
                    }}
                    disabled={isAnalyzing}
                />
                <div
                    onDrop={(e) => {
                        handleDrop(e);
                        router.push('/dashboard/simulator');
                    }}
                    onDragOver={handleDragOver}
                    className="relative glass-premium border-2 border-dashed border-indigo-200/50 hover:border-indigo-400/50 transition-all rounded-3xl p-8 flex flex-col items-center justify-center bg-white/40 hover:bg-white/60 shadow-lg"
                >
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4 group-hover/upload:scale-110 transition-transform">
                        <Upload size={28} />
                    </div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white mb-1">Cargar Nueva Factura</div>
                    <div className="text-xs text-slate-400 font-medium text-center">Arrastra aquí o haz clic para subir tu PDF</div>
                </div>
            </label>
        </div>
    );
}
