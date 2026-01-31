'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface DemoModeAlertProps {
    show: boolean;
    onDismiss?: () => void;
}

export const DemoModeAlert: React.FC<DemoModeAlertProps> = ({ show, onDismiss }) => {
    if (!show) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto mb-6"
        >
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-amber-800 mb-1 flex items-center gap-2">
                        Modo Demostración
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-semibold rounded-full">
                            DEV ONLY
                        </span>
                    </h3>
                    <p className="text-sm text-amber-700">
                        Los resultados mostrados son datos de prueba. En producción, se conectarán con los webhooks reales 
                        para obtener comparativas de tarifas actualizadas del mercado.
                    </p>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors p-1"
                        aria-label="Cerrar alerta"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </motion.div>
    );
};
