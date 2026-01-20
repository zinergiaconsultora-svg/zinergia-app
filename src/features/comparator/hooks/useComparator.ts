import { useState, useEffect } from 'react';
import { crmService } from '@/services/crmService';
import { InvoiceData, SavingsResult } from '@/types/crm';

export function useComparator() {
    const [step, setStep] = useState(1);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState<SavingsResult[]>([]);
    const [clientName, setClientName] = useState('');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Iniciando análisis...');

    const [invoiceData, setInvoiceData] = useState<InvoiceData>({
        period_days: 30,
        power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
        energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
    });

    // Load state
    useEffect(() => {
        const saved = localStorage.getItem('antigravity_comparator_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setStep(parsed.step || 1);
                setInvoiceData(parsed.invoiceData);
                setResults(parsed.results || []);
                setClientName(parsed.clientName || '');
            } catch (e) {
                console.error("Failed to restore state", e);
            }
        }
    }, []);

    // Save state
    useEffect(() => {
        localStorage.setItem('antigravity_comparator_state', JSON.stringify({
            step, invoiceData, results, clientName
        }));
    }, [step, invoiceData, results, clientName]);

    // Scroll top
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsAnalyzing(true);
        try {
            const data = await crmService.analyzeDocument(file);
            if (data) {
                setInvoiceData(prev => ({
                    ...prev,
                    power_p1: data.power_p1 ?? prev.power_p1,
                    power_p2: data.power_p2 ?? prev.power_p2,
                    power_p3: data.power_p3 ?? prev.power_p3,
                    power_p4: data.power_p4 ?? prev.power_p4,
                    power_p5: data.power_p5 ?? prev.power_p5,
                    power_p6: data.power_p6 ?? prev.power_p6,
                    energy_p1: data.energy_p1 ?? prev.energy_p1,
                    energy_p2: data.energy_p2 ?? prev.energy_p2,
                    energy_p3: data.energy_p3 ?? prev.energy_p3,
                    energy_p4: data.energy_p4 ?? prev.energy_p4,
                    energy_p5: data.energy_p5 ?? prev.energy_p5,
                    energy_p6: data.energy_p6 ?? prev.energy_p6,
                }));
                if (data.razon_social) setClientName(data.razon_social);
                setStep(2);
            }
        } catch (error) {
            console.error('OCR Upload failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        const messages = [
            "Analizando patrones de consumo...",
            "Consultando mercado mayorista (OMIE)...",
            "Optimizando potencias P1-P6...",
            "Verificando permanencias...",
            "Generando propuesta digital..."
        ];

        let msgIndex = 0;
        setLoadingMessage(messages[0]);

        const interval = setInterval(() => {
            msgIndex++;
            if (msgIndex < messages.length) {
                setLoadingMessage(messages[msgIndex]);
            }
        }, 800);

        try {
            await new Promise(r => setTimeout(r, 4000));
            clearInterval(interval);

            const calculatedSavings = await crmService.calculateSavings(invoiceData);
            setResults(calculatedSavings);
            if (calculatedSavings.length > 0) {
                crmService.logSimulation(invoiceData, calculatedSavings[0], clientName).catch(console.error);
                setStep(4);
            }
        } catch (error) {
            console.error("Analysis failed", error);
            clearInterval(interval);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setStep(1);
        setResults([]);
        setClientName('');
        setInvoiceData({
            period_days: 30,
            power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
            energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
        });
        localStorage.removeItem('antigravity_comparator_state');
    };

    return {
        step,
        setStep,
        isAnalyzing,
        results,
        clientName,
        setClientName,
        isEmailModalOpen,
        setIsEmailModalOpen,
        loadingMessage,
        invoiceData,
        setInvoiceData,
        handleFileUpload,
        runAnalysis,
        handleReset
    };
}
