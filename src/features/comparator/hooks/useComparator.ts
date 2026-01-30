import { useState } from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { crmService } from '@/services/crmService';

export function useComparator() {
    const [step, setStep] = useState(1);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [invoiceData, setInvoiceData] = useState<InvoiceData>({
        period_days: 30,
        power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
        energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
        current_power_price_p1: 0, current_power_price_p2: 0, current_power_price_p3: 0,
        current_power_price_p4: 0, current_power_price_p5: 0, current_power_price_p6: 0,
        current_energy_price_p1: 0, current_energy_price_p2: 0, current_energy_price_p3: 0,
        current_energy_price_p4: 0, current_energy_price_p5: 0, current_energy_price_p6: 0,
    });
    const [clientName, setClientName] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [results, setResults] = useState<SavingsResult[]>([]);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

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

    const processInvoice = async (file: File) => {
        setIsAnalyzing(true);
        setUploadError(null);

        try {
            const data = await crmService.analyzeDocument(file);

            if (!data) {
                throw new Error('No se pudieron extraer datos de la factura');
            }

            setInvoiceData(data);
            setClientName(data.client_name || '');
            console.log('✅ Data extracted, moving to step 2');
            setStep(2);
        } catch (error) {
            console.error('Error processing invoice:', error);
            setUploadError(error instanceof Error ? error.message : 'Error al procesar la factura');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setStep(1);
        setInvoiceData({
            period_days: 30,
            power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
            energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
            current_power_price_p1: 0, current_power_price_p2: 0, current_power_price_p3: 0,
            current_power_price_p4: 0, current_power_price_p5: 0, current_power_price_p6: 0,
            current_energy_price_p1: 0, current_energy_price_p2: 0, current_energy_price_p3: 0,
            current_energy_price_p4: 0, current_energy_price_p5: 0, current_energy_price_p6: 0,
        });
        setClientName('');
        setUploadError(null);
        setResults([]);
        setIsEmailModalOpen(false);
    };

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        const messages = [
            "Analizando patrones de consumo...",
            "Consultando tarifas disponibles...",
            "Comparando con ofertas del mercado...",
            "Generando propuestas..."
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
            const calculatedSavings = await crmService.calculateSavings(invoiceData);
            clearInterval(interval);

            const topResults = calculatedSavings.slice(0, 2);
            setResults(topResults);

            if (topResults.length > 0) {
                localStorage.setItem('antigravity_comparator_result', JSON.stringify(topResults[0]));
                localStorage.setItem('antigravity_comparator_invoice', JSON.stringify(invoiceData));
                sessionStorage.setItem('comparator_result', JSON.stringify(topResults[0]));
                sessionStorage.setItem('comparator_invoice', JSON.stringify(invoiceData));
                console.log('💾 Data saved to localStorage and sessionStorage for ProposalView');

                setStep(4);
            }
        } catch (error) {
            console.error("Analysis failed", error);
            clearInterval(interval);
            setUploadError(error instanceof Error ? error.message : 'Error al realizar la comparación');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const goBackToPhase2 = () => {
        setStep(2);
    };

    const goBackToPhase1 = () => {
        setStep(1);
    };

    return {
        step,
        setStep,
        isAnalyzing,
        invoiceData,
        setInvoiceData,
        clientName,
        setClientName,
        uploadError,
        results,
        loadingMessage,
        isEmailModalOpen,
        setIsEmailModalOpen,
        handleFileUpload,
        handleDrop,
        handleDragOver,
        runAnalysis,
        reset: handleReset,
        goBackToPhase1,
        goBackToPhase2
    };
}
