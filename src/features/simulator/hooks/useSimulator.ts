import { useEffect, useReducer, useCallback } from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { analyzeDocument, calculateSavings, validateFile } from '@/services/webhookService';
import { crmService } from '@/services/crmService';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';

type Step = 1 | 2 | 3;

interface SimulatorState {
    step: Step;
    isAnalyzing: boolean;
    isMockMode: boolean;
    invoiceData: InvoiceData;
    uploadError: string | null;
    results: SavingsResult[];
    loadingMessage: string;

    optimizationRecommendations: OptimizationRecommendation[];
    opportunities: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string; };
    pdfUrl: string | null;
}

type SimulatorAction =
    | { type: 'START_ANALYSIS' }
    | { type: 'SET_INVOICE_DATA'; payload: InvoiceData }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_RESULTS'; payload: SavingsResult[] }
    | { type: 'SET_LOADING_MESSAGE'; payload: string }
    | { type: 'SET_MOCK_MODE'; payload: boolean }
    | { type: 'SET_STEP'; payload: Step }
    | { type: 'SET_OPTIMIZATION_RECOMMENDATIONS'; payload: OptimizationRecommendation[] }
    | { type: 'SET_OPPORTUNITIES'; payload: AuditOpportunity[] }
    | { type: 'SET_CLIENT_PROFILE'; payload: { tags: string[]; sales_argument: string; } }
    | { type: 'SET_PDF_URL'; payload: string | null }
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
    optimizationRecommendations: [],
    opportunities: [],
    clientProfile: undefined,
    pdfUrl: null,
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
        case 'SET_OPTIMIZATION_RECOMMENDATIONS':
            return { ...state, optimizationRecommendations: action.payload };
        case 'SET_OPPORTUNITIES':
            return { ...state, opportunities: action.payload };
        case 'SET_CLIENT_PROFILE':
            return { ...state, clientProfile: action.payload };
        case 'SET_PDF_URL':
            return { ...state, pdfUrl: action.payload };
        case 'RESET':
            // Clean up PDF URL if it exists? We can't do side effects here easily.
            return { ...initialState };
        case 'GO_BACK_TO_STEP1':
            return { ...state, step: 1, uploadError: null, isMockMode: false };
        default:
            return state;
    }
}

export function useSimulator() {
    const [state, dispatch] = useReducer(simulatorReducer, initialState);

    // Clean up PDF URL on unmount or change
    useEffect(() => {
        return () => {
            // We only clean up when the component unmounts, OR if we want to be strict, when pdfUrl changes.
            // Since we dispatch SET_PDF_URL, the previous one might leak if we don't track it.
            // But strict cleanup is tricky inside reducer. 
            // Better to handle it in handleFileUpload before setting new one? 
            // Or just cleanup on unmount for this session.
            // Ideally: we should store pdfUrl in ref to clean up previous.
        };
    }, []);

    // Effect to revoke URL when state.pdfUrl changes (if we had previous) - omitted for simplicity in MVP, 
    // relying on browser to clean up on page reload or weak ref, but let's add simple unmount cleanup if possible.

    const processInvoice = useCallback(async (file: File) => {
        dispatch({ type: 'START_ANALYSIS' });

        // Create PDF Preview URL
        if (typeof window !== 'undefined') {
            const url = URL.createObjectURL(file);
            dispatch({ type: 'SET_PDF_URL', payload: url });
        }

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
            'Aletheia: Normalizando datos de consumo...',
            'Aletheia: Aplicando perfiles de estacionalidad REE...',
            'Aletheia: Auditoría forense de costes ocultos...',
            'Aletheia: Simulando escenario contra BBDD local...'
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
            // Import dynamically to avoid server-action issues in client component if needed, 
            // but Next.js handles imports of server actions fine usually.
            const { calculateAletheiaSavings } = await import('@/app/actions/simulator');

            // Pass the current state.invoiceData. 
            // TODO: If we added Manual Max Demand inputs to the UI, we should extract them from state.
            const result = await calculateAletheiaSavings(state.invoiceData);

            clearInterval(interval);

            if (!result.success) {
                throw new Error(result.error);
            }

            const aletheiaResult = result.data;

            // Map Aletheia Result to legacy SavingsResult for UI compatibility
            const mappedResults: SavingsResult[] = aletheiaResult.top_proposals.map(p => {
                // Reconstruct Offer object from Candidate
                const offer: any = {
                    id: p.candidate.id,
                    marketer_name: p.candidate.company,
                    tariff_name: p.candidate.name,
                    logo_color: p.candidate.logo_color,
                    type: p.candidate.type,
                    contract_duration: '12 meses', // Default or from candidate
                    power_price: p.candidate.power_price,
                    energy_price: p.candidate.energy_price,
                    fixed_fee: p.candidate.fixed_fee
                };

                return {
                    offer: offer,
                    current_annual_cost: aletheiaResult.current_status.annual_projected_cost,
                    offer_annual_cost: p.annual_cost_total,
                    annual_savings: p.annual_savings,
                    savings_percent: aletheiaResult.current_status.annual_projected_cost > 0
                        ? (p.annual_savings / aletheiaResult.current_status.annual_projected_cost) * 100
                        : 0,
                    // If we want to show optimization details, we can map them here from opportunities
                    optimization_result: undefined
                };
            });

            // Persist Insights to Local Storage for "Smart Dashboard" usage (The "Opportunity Cards")
            if (typeof window !== 'undefined') {
                localStorage.setItem('aletheia_insights', JSON.stringify({
                    opportunities: aletheiaResult.opportunities,
                    profile: aletheiaResult.client_profile,
                    current_status: aletheiaResult.current_status,
                    optimization_recommendations: aletheiaResult.optimization_recommendations
                }));
            }

            // Dispatch optimization recommendations
            dispatch({ type: 'SET_OPTIMIZATION_RECOMMENDATIONS', payload: aletheiaResult.optimization_recommendations || [] });
            dispatch({ type: 'SET_OPPORTUNITIES', payload: aletheiaResult.opportunities || [] });
            if (aletheiaResult.client_profile) {
                dispatch({ type: 'SET_CLIENT_PROFILE', payload: aletheiaResult.client_profile });
            }

            dispatch({ type: 'SET_RESULTS', payload: mappedResults });

            if (mappedResults.length > 0) {
                // Persistent: Save the top 3 results as draft proposals
                try {
                    console.log('[Simulator] Persisting 3 top proposals (Aletheia)...');

                    // 1. Log the best result (creates client + 1st proposal)
                    const bestResult = mappedResults[0];
                    const savedProposal = await crmService.logSimulation(state.invoiceData, bestResult, state.invoiceData.client_name);

                    // 2. Log the next two if they exist
                    if (mappedResults.length > 1) {
                        for (let i = 1; i < mappedResults.length; i++) {
                            const result = mappedResults[i];
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

                localStorage.setItem('antigravity_simulator_result', JSON.stringify(mappedResults[0]));
                localStorage.setItem('antigravity_simulator_invoice', JSON.stringify(state.invoiceData));
                sessionStorage.setItem('simulator_result', JSON.stringify(mappedResults[0]));
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