import { useState } from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { analyzeDocument, calculateSavings, validateFile } from '@/services/webhookService';

type Step = 1 | 2 | 3;

export function useSimulator() {
    const [step, setStep] = useState<Step>(1);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMockMode, setIsMockMode] = useState(false);
    const [invoiceData, setInvoiceData] = useState<InvoiceData>({
        period_days: 30,
        power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
        energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
    });
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [results, setResults] = useState<SavingsResult[]>([]);
    const [loadingMessage, setLoadingMessage] = useState('');

    const processInvoice = async (file: File) => {
        setIsAnalyzing(true);
        setUploadError(null);
        setIsMockMode(false);

        try {
            // Validate file first
            const validation = validateFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const data = await analyzeDocument(file);

            if (!data) {
                throw new Error('No se pudieron extraer datos de la factura');
            }

            setInvoiceData(data);
            setStep(2);

        } catch (error) {
            console.error('Error processing invoice:', error);
            setUploadError(error instanceof Error ? error.message : 'Error al procesar la factura');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processInvoice(file);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            await processInvoice(file);
        } else {
            setUploadError('Por favor, sube solo archivos PDF');
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleReset = () => {
        setStep(1);
        setInvoiceData({
            period_days: 30,
            power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
            energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
        });
        setUploadError(null);
        setResults([]);
        setIsMockMode(false);
    };

    const runComparison = async () => {
        setIsAnalyzing(true);
        setIsMockMode(false);
        const messages = [
            'Analizando patrones de consumo...',
            'Consultando las 3 mejores tarifas disponibles...',
            'Comparando con ofertas del mercado...',
            'Generando propuestas...'
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
            const calculatedSavings = await calculateSavings(invoiceData);
            clearInterval(interval);

            // Check if we're in mock mode
            if (process.env.NODE_ENV === 'development' && calculatedSavings.length > 0) {
                const firstOffer = calculatedSavings[0];
                if (firstOffer.offer.id.startsWith('mock-')) {
                    setIsMockMode(true);
                }
            }

            const topResults = calculatedSavings.slice(0, 3);
            setResults(topResults);

            if (topResults.length > 0) {
                localStorage.setItem('antigravity_simulator_result', JSON.stringify(topResults[0]));
                localStorage.setItem('antigravity_simulator_invoice', JSON.stringify(invoiceData));
                sessionStorage.setItem('simulator_result', JSON.stringify(topResults[0]));
                sessionStorage.setItem('simulator_invoice', JSON.stringify(invoiceData));

                setStep(3);
            }
        } catch (error) {
            console.error('Comparison failed', error);
            clearInterval(interval);
            setUploadError(error instanceof Error ? error.message : 'Error al realizar la comparación');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const goBackToStep1 = () => {
        setStep(1);
        setUploadError(null);
        setIsMockMode(false);
    };

    return {
        step,
        setStep,
        isAnalyzing,
        isMockMode,
        invoiceData,
        setInvoiceData,
        uploadError,
        results,
        loadingMessage,
        handleFileUpload,
        handleDrop,
        handleDragOver,
        runComparison,
        reset: handleReset,
        goBackToStep1,
    };
}
