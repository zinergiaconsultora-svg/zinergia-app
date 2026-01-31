import { useEffect, useReducer, useCallback } from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { analyzeDocument, calculateSavings, validateFile } from '@/services/webhookService';
import { crmService } from '@/services/crmService';

type Step = 1 | 2 | 3;

interface SimulatorState {
    step: Step;
    isAnalyzing: boolean;
    isMockMode: boolean;
    invoiceData: InvoiceData;
    uploadError: string | null;
    results: SavingsResult[];
    loadingMessage: string;
}

type SimulatorAction =
    | { type: 'START_ANALYSIS' }
    | { type: 'SET_INVOICE_DATA'; payload: InvoiceData }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_RESULTS'; payload: SavingsResult[] }
    | { type: 'SET_LOADING_MESSAGE'; payload: string }
    | { type: 'SET_MOCK_MODE'; payload: boolean }
    | { type: 'SET_STEP'; payload: Step }
    | { type: 'RESET' }
    | { type: 'GO_BACK_TO_STEP1' };

const defaultInvoiceData: InvoiceData = {
    period_days: 30,
    power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
    energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
};

const initialState: SimulatorState = {
    step: 1,
    isAnalyzing: false,
    isMockMode: false,
    invoiceData: defaultInvoiceData,
    uploadError: null,
    results: [],
    loadingMessage: '',
};

function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
    switch (action.type) {
        case 'START_ANALYSIS':
            return { ...state, isAnalyzing: true, uploadError: null, isMockMode: false };
        case 'SET_INVOICE_DATA':
            return { ...state, invoiceData: action.payload, step: 2, isAnalyzing: false };
        case 'SET_ERROR':
            return { ...state, uploadError: action.payload, isAnalyzing: false };
        case 'SET_RESULTS':
            return { ...state, results: action.payload, step: 3, isAnalyzing: false };
        case 'SET_LOADING_MESSAGE':
            return { ...state, loadingMessage: action.payload };
        case 'SET_MOCK_MODE':
            return { ...state, isMockMode: action.payload };
        case 'SET_STEP':
            return { ...state, step: action.payload };
        case 'RESET':
            return initialState;
        case 'GO_BACK_TO_STEP1':
            return { ...state, step: 1, uploadError: null, isMockMode: false };
        default:
            return state;
    }
}

export function useSimulator() {
    const [state, dispatch] = useReducer(simulatorReducer, initialState);

    // Check for pending invoice data from QuickUploadZone
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const pendingData = localStorage.getItem('pendingInvoiceData');
            if (pendingData) {
                try {
                    const parsedData = JSON.parse(pendingData);
                    dispatch({ type: 'SET_INVOICE_DATA', payload: parsedData });
                    localStorage.removeItem('pendingInvoiceData');
                } catch (e) {
                    console.error('Error parsing pending invoice data:', e);
                }
            }
        }
    }, []);

    const processInvoice = useCallback(async (file: File) => {
        dispatch({ type: 'START_ANALYSIS' });

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

            dispatch({ type: 'SET_INVOICE_DATA', payload: data });
        } catch (error) {
            console.error('Error processing invoice:', error);
            dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Error al procesar la factura' });
        }
    }, []);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processInvoice(file);
    }, [processInvoice]);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            await processInvoice(file);
        } else {
            dispatch({ type: 'SET_ERROR', payload: 'Por favor, sube solo archivos PDF' });
        }
    }, [processInvoice]);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    }, []);

    const handleReset = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    const runComparison = useCallback(async () => {
        dispatch({ type: 'START_ANALYSIS' });
        const messages = [
            'Analizando patrones de consumo...',
            'Consultando las 3 mejores tarifas disponibles...',
            'Comparando con ofertas del mercado...',
            'Generando propuestas...'
        ];

        let msgIndex = 0;
        dispatch({ type: 'SET_LOADING_MESSAGE', payload: messages[0] });

        const interval = setInterval(() => {
            msgIndex++;
            if (msgIndex < messages.length) {
                dispatch({ type: 'SET_LOADING_MESSAGE', payload: messages[msgIndex] });
            }
        }, 800);

        try {
            const calculatedSavings = await calculateSavings(state.invoiceData);
            clearInterval(interval);

            // Check if we're in mock mode
            if (process.env.NODE_ENV === 'development' && calculatedSavings.length > 0) {
                const firstOffer = calculatedSavings[0];
                if (firstOffer.offer.id.startsWith('mock-')) {
                    dispatch({ type: 'SET_MOCK_MODE', payload: true });
                }
            }

            const topResults = calculatedSavings.slice(0, 3);
            dispatch({ type: 'SET_RESULTS', payload: topResults });

            if (topResults.length > 0) {
                // Persistent: Save the top 3 results as draft proposals
                try {
                    console.log('[Simulator] Persisting 3 top proposals...');

                    // 1. Log the best result (creates client + 1st proposal)
                    const bestResult = topResults[0];
                    const savedProposal = await crmService.logSimulation(state.invoiceData, bestResult, state.invoiceData.client_name);

                    // 2. Log the next two if they exist, linked to the SAME client
                    if (topResults.length > 1) {
                        for (let i = 1; i < topResults.length; i++) {
                            const result = topResults[i];
                            await crmService.saveProposal({
                                client_id: savedProposal.client_id,
                                status: 'draft',
                                offer_snapshot: result.offer,
                                calculation_data: state.invoiceData,
                                annual_savings: result.annual_savings,
                                current_annual_cost: result.current_annual_cost,
                                offer_annual_cost: result.offer_annual_cost,
                                savings_percent: result.savings_percent,
                                optimization_result: result.optimization_result
                            });
                        }
                    }
                    console.log('[Simulator] 3 Proposals persisted successfully');
                } catch (persistError) {
                    console.error('[Simulator] Failed to persist proposals:', persistError);
                }

                localStorage.setItem('antigravity_simulator_result', JSON.stringify(topResults[0]));
                localStorage.setItem('antigravity_simulator_invoice', JSON.stringify(state.invoiceData));
                sessionStorage.setItem('simulator_result', JSON.stringify(topResults[0]));
                sessionStorage.setItem('simulator_invoice', JSON.stringify(state.invoiceData));
            }
        } catch (error) {
            console.error('Comparison failed', error);
            clearInterval(interval);
            dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Error al realizar la comparación' });
        }
    }, [state.invoiceData]);

    const goBackToStep1 = useCallback(() => {
        dispatch({ type: 'GO_BACK_TO_STEP1' });
    }, []);

    const setInvoiceData = useCallback((data: InvoiceData) => {
        dispatch({ type: 'SET_INVOICE_DATA', payload: data });
    }, []);

    const setStep = useCallback((step: Step) => {
        dispatch({ type: 'SET_STEP', payload: step });
    }, []);

    return {
        ...state,
        setStep,
        setInvoiceData,
        handleFileUpload,
        handleDrop,
        handleDragOver,
        runComparison,
        reset: handleReset,
        goBackToStep1,
    };
}