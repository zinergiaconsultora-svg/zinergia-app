/**
 * Anomaly Detection and Alerts
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingDown, Zap, Info } from 'lucide-react';
import { InvoiceData } from '@/types/crm';

interface AnomalyAlertProps {
    invoiceData: InvoiceData;
    onDismiss?: () => void;
}

interface Anomaly {
    id: string;
    type: 'warning' | 'error' | 'info';
    icon: React.ReactNode;
    title: string;
    message: string;
}

export const AnomalyDetection: React.FC<AnomalyAlertProps> = ({ invoiceData, onDismiss }) => {
    const anomalies: Anomaly[] = React.useMemo(() => {
        const alerts: Anomaly[] = [];

        // Check for unusually high consumption
        const totalEnergy = 
            (invoiceData.energy_p1 || 0) +
            (invoiceData.energy_p2 || 0) +
            (invoiceData.energy_p3 || 0) +
            (invoiceData.energy_p4 || 0) +
            (invoiceData.energy_p5 || 0) +
            (invoiceData.energy_p6 || 0);

        const avgDailyEnergy = totalEnergy / (invoiceData.period_days || 30);

        // Very high consumption alert
        if (avgDailyEnergy > 100) {
            alerts.push({
                id: 'high-consumption',
                type: 'warning',
                icon: <Zap className="w-5 h-5" />,
                title: 'Consumo Elevado',
                message: `Tu consumo diario promedio es de ${avgDailyEnergy.toFixed(1)} kWh, lo cual es superior al promedio español. Considera optimizar tus hábitos de consumo.`,
            });
        }

        // Check for very low consumption (possible meter issue)
        if (avgDailyEnergy < 5 && totalEnergy > 0) {
            alerts.push({
                id: 'low-consumption',
                type: 'error',
                icon: <TrendingDown className="w-5 h-5" />,
                title: 'Consumo Anormalmente Bajo',
                message: 'El consumo registrado parece inusualmente bajo. Podría haber un problema con el contador o en la lectura. Verifica los datos.',
            });
        }

        // Check for expensive power
        const totalPowerCost = 
            (invoiceData.power_p1 || 0) * 30 +
            (invoiceData.power_p2 || 0) * 30;

        if (totalPowerCost > 50) {
            alerts.push({
                id: 'expensive-power',
                type: 'warning',
                icon: <AlertTriangle className="w-5 h-5" />,
                title: 'Potencia Cara',
                message: `El costo anual de potencia es alto (€${totalPowerCost.toFixed(2)}/mes). Considera optimizar tus potencias contratadas.`,
            });
        }

        // Check tariff type
        const tariffName = invoiceData.tariff_name?.toLowerCase() || '';
        
        if (tariffName.includes('3.1') || tariffName.includes('discriminación')) {
            alerts.push({
                id: 'tariff-info',
                type: 'info',
                icon: <Info className="w-5 h-5" />,
                title: 'Tarifa con Discriminación Horaria',
                message: 'Tu tarifa tiene diferentes precios según el periodo. Intenta consumir energía en las horas más económicas para maximizar el ahorro.',
            });
        }

        // Check for reactive energy if data available
        if (invoiceData.forensic_details?.energy_reactive && invoiceData.forensic_details.energy_reactive > 0) {
            alerts.push({
                id: 'reactive-energy',
                type: 'warning',
                icon: <Zap className="w-5 h-5" />,
                title: 'Energía Reactiva Detectada',
                message: 'Tener energía reactiva puede indicar un factor de potencia bajo o equipos ineficientes. Esto puede estar aumentando tu factura innecesariamente.',
            });
        }

        return alerts;
    }, [invoiceData]);

    if (anomalies.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <AnimatePresence mode="wait">
                {anomalies.map((anomaly) => (
                    <motion.div
                        key={anomaly.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`relative p-4 rounded-xl border-2 ${
                            anomaly.type === 'error' 
                                ? 'bg-red-50 border-red-200' 
                                : anomaly.type === 'warning'
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-blue-50 border-blue-200'
                        }`}
                    >
                        <button
                            onClick={onDismiss}
                            className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded-lg transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                                anomaly.type === 'error'
                                    ? 'bg-red-100'
                                    : anomaly.type === 'warning'
                                    ? 'bg-amber-100'
                                    : 'bg-blue-100'
                            }`}>
                                {anomaly.icon}
                            </div>
                            
                            <div className="flex-1">
                                <h4 className={`font-semibold text-sm mb-1 ${
                                    anomaly.type === 'error'
                                        ? 'text-red-800'
                                        : anomaly.type === 'warning'
                                        ? 'text-amber-800'
                                        : 'text-blue-800'
                                }`}>
                                    {anomaly.title}
                                </h4>
                                <p className={`text-xs ${
                                    anomaly.type === 'error'
                                        ? 'text-red-700'
                                        : anomaly.type === 'warning'
                                        ? 'text-amber-700'
                                        : 'text-blue-700'
                                }`}>
                                    {anomaly.message}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
