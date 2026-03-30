import { useEffect, useReducer, useCallback, useRef } from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { analyzeDocumentWithRetry as analyzeDocument, validateFile } from '@/services/simulatorService';
import { crmService } from '@/services/crmService';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';
import { createClient } from '@/lib/supabase/client';
import { markOcrJobFailed, getOcrJobStatus } from '@/app/actions/ocr-jobs';

type Step = 1 | 2 | 3;

// Tipo para los rows de ocr_jobs recibidos via Realtime
// IMPORTANTE: el campo en DB es `extracted_data`, no `invoice_data`
interface OcrJobRow {
    id: string;
    status: 'processing' | 'completed' | 'failed';
    extracted_data: Record<string, unknown> | null;
    error_message: string | null;
}

// Extrae InvoiceData de extracted_data eliminando el campo interno _confidence
function extractInvoiceData(raw: Record<string, unknown> | null): InvoiceData | null {
    if (!raw) return null;
    const { _confidence: _c, ...rest } = raw;
    void _c;
    return rest as unknown as InvoiceData;
}

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
    savedProposalId: string | null;
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
    | { type: 'SET_SAVED_PROPOSAL_ID'; payload: string }
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
    savedProposalId: null,
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
        case 'SET_SAVED_PROPOSAL_ID':
            return { ...state, savedProposalId: action.payload };
        case 'RESET':
            // Clean up PDF URL if it exists? We can't do side effects here easily.
            return { ...initialState };
        case 'GO_BACK_TO_STEP1':
            return { ...state, step: 1, uploadError: null, isMockMode: false };
        default:
            return state;
    }
}

const OCR_REALTIME_TIMEOUT_MS = 90_000;

export function useSimulator() {
    const [state, dispatch] = useReducer(simulatorReducer, initialState);
    const activeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
    const activeSupabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

    // Cleanup Realtime channel if component unmounts while OCR is in flight
    useEffect(() => {
        return () => {
            if (activeChannelRef.current && activeSupabaseRef.current) {
                activeSupabaseRef.current.removeChannel(activeChannelRef.current);
                activeChannelRef.current = null;
                activeSupabaseRef.current = null;
            }
        };
    }, []);

    // Revoke blob URL when PDF changes or component unmounts to prevent memory leaks
    useEffect(() => {
        const url = state.pdfUrl;
        if (!url) return;
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [state.pdfUrl]);

    // Pick up pre-analyzed invoice from QuickUploadZone (dashboard shortcut)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // 1. Mock Data handling
        const raw = sessionStorage.getItem('pendingInvoiceData');
        if (raw) {
            sessionStorage.removeItem('pendingInvoiceData');
            try {
                const { data, isMock } = JSON.parse(raw) as { data: InvoiceData; isMock: boolean };
                dispatch({ type: 'SET_MOCK_MODE', payload: isMock });
                dispatch({ type: 'SET_INVOICE_DATA', payload: data });
            } catch {
                // Malformed entry — ignore
            }
            return;
        }

        // 2. Async Job Handling (Realtime)
        const jobId = sessionStorage.getItem('pendingOcrJobId');
        if (jobId) {
            sessionStorage.removeItem('pendingOcrJobId');
            dispatch({ type: 'START_ANALYSIS' });
            dispatch({ type: 'SET_LOADING_MESSAGE', payload: 'Procesando documento con IA...' });
            
            const supabase = createClient();
            const channel = supabase.channel(`ocr_job_${jobId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'ocr_jobs', filter: `id=eq.${jobId}` },
                    (payload: { new: OcrJobRow }) => {
                        const updatedJob = payload.new;
                        clearTimeout(timeoutId);
                        if (updatedJob.status === 'completed') {
                            dispatch({ type: 'SET_INVOICE_DATA', payload: extractInvoiceData(updatedJob.extracted_data) as InvoiceData });
                            supabase.removeChannel(channel);
                        } else if (updatedJob.status === 'failed') {
                            dispatch({ type: 'SET_ERROR', payload: updatedJob.error_message || 'Error en procesamiento OCR' });
                            supabase.removeChannel(channel);
                        }
                    }
                )
                .subscribe();

            // Safety net: si N8N no responde en 90s, marcar como fallido en DB y abortar
            const timeoutId = setTimeout(() => {
                dispatch({ type: 'SET_ERROR', payload: 'El servidor tardó demasiado en procesar el documento. Inténtalo de nuevo.' });
                supabase.removeChannel(channel);
                markOcrJobFailed(jobId, 'Timeout: N8N no respondió en 90 segundos').catch(() => {});
            }, OCR_REALTIME_TIMEOUT_MS);

            return () => {
                clearTimeout(timeoutId);
                supabase.removeChannel(channel);
            };
        }
    }, []);

    const processInvoice = useCallback(async (file: File) => {
        dispatch({ type: 'START_ANALYSIS' });
        dispatch({ type: 'SET_LOADING_MESSAGE', payload: 'Enviando documento de forma segura...' });

        // Create PDF Preview URL
        if (typeof window !== 'undefined') {
            const url = URL.createObjectURL(file);
            dispatch({ type: 'SET_PDF_URL', payload: url });
        }

        try {
            // Validate file first
            const validation = validateFile(file);
            if (!validation.valid) {
                throw new Error(validation.error!);
            }

            const result = await analyzeDocument(file);

            if (result.data) {
                dispatch({ type: 'SET_MOCK_MODE', payload: !!result.isMock });
                dispatch({ type: 'SET_INVOICE_DATA', payload: result.data });
                return;
            }

            if (!result.jobId) {
                throw new Error('No se pudo iniciar el procesamiento en segundo plano');
            }

            dispatch({ type: 'SET_LOADING_MESSAGE', payload: 'Procesando documento con IA...' });
            
            const supabase = createClient();
            const channel = supabase.channel(`local_job_${result.jobId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'ocr_jobs', filter: `id=eq.${result.jobId}` },
                    (payload: { new: OcrJobRow }) => {
                        const updatedJob = payload.new;
                        clearTimeout(timeoutId);
                        if (updatedJob.status === 'completed') {
                            dispatch({ type: 'SET_INVOICE_DATA', payload: extractInvoiceData(updatedJob.extracted_data) as InvoiceData });
                            supabase.removeChannel(channel);
                            activeChannelRef.current = null;
                            activeSupabaseRef.current = null;
                        } else if (updatedJob.status === 'failed') {
                            dispatch({ type: 'SET_ERROR', payload: updatedJob.error_message || 'Error en análisis OCR' });
                            supabase.removeChannel(channel);
                            activeChannelRef.current = null;
                            activeSupabaseRef.current = null;
                        }
                    }
                )
                .subscribe();

            // Guardar referencias para cleanup al desmontar
            activeChannelRef.current = channel;
            activeSupabaseRef.current = supabase;

            // Polling fallback: server action (bypasses RLS issues with browser client)
            let resolved = false;
            const pollInterval = setInterval(async () => {
                if (resolved) return;
                try {
                    const job = await getOcrJobStatus(result.jobId!);
                    if (!job || resolved) return;
                    if (job.status === 'completed') {
                        resolved = true;
                        clearInterval(pollInterval);
                        clearTimeout(timeoutId);
                        dispatch({ type: 'SET_INVOICE_DATA', payload: extractInvoiceData(job.extracted_data as Record<string, unknown>) as InvoiceData });
                        supabase.removeChannel(channel);
                        activeChannelRef.current = null;
                        activeSupabaseRef.current = null;
                    } else if (job.status === 'failed') {
                        resolved = true;
                        clearInterval(pollInterval);
                        clearTimeout(timeoutId);
                        dispatch({ type: 'SET_ERROR', payload: job.error_message || 'Error en análisis OCR' });
                        supabase.removeChannel(channel);
                        activeChannelRef.current = null;
                        activeSupabaseRef.current = null;
                    }
                } catch { /* polling es best-effort */ }
            }, 3000);

            // Safety net: si N8N no responde en 90s, marcar como fallido en DB y abortar
            const timeoutId = setTimeout(() => {
                resolved = true;
                clearInterval(pollInterval);
                dispatch({ type: 'SET_ERROR', payload: 'El servidor tardó demasiado en procesar el documento. Inténtalo de nuevo.' });
                supabase.removeChannel(channel);
                activeChannelRef.current = null;
                activeSupabaseRef.current = null;
                markOcrJobFailed(result.jobId!, 'Timeout: N8N no respondió en 90 segundos').catch(() => {});
            }, OCR_REALTIME_TIMEOUT_MS);

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
        dispatch({ type: 'SET_LOADING_MESSAGE', payload: 'Calculando las mejores ofertas...' });

        try {
            const { calculateAletheiaSavings } = await import('@/app/actions/simulator');
            const result = await calculateAletheiaSavings(state.invoiceData);

            if (!result.success) {
                throw new Error(result.error);
            }

            const aletheiaResult = result.data;

            // Map Aletheia Result to legacy SavingsResult for UI compatibility
            const mappedResults: SavingsResult[] = aletheiaResult.top_proposals.map(p => {
                // Reconstruct Offer object from Candidate
                const offer: SavingsResult['offer'] = {
                    id: p.candidate.id,
                    marketer_name: p.candidate.company,
                    tariff_name: p.candidate.name,
                    logo_color: p.candidate.logo_color || 'bg-blue-600',
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

            // Dispatch optimization recommendations
            dispatch({ type: 'SET_OPTIMIZATION_RECOMMENDATIONS', payload: aletheiaResult.optimization_recommendations || [] });
            dispatch({ type: 'SET_OPPORTUNITIES', payload: aletheiaResult.opportunities || [] });
            if (aletheiaResult.client_profile) {
                dispatch({ type: 'SET_CLIENT_PROFILE', payload: aletheiaResult.client_profile });
            }

            dispatch({ type: 'SET_RESULTS', payload: mappedResults });

            if (mappedResults.length > 0) {
                // Only persist real data — never save mock OCR results to DB
                if (!state.isMockMode) {
                    dispatch({ type: 'SET_LOADING_MESSAGE', payload: 'Guardando propuestas...' });
                    try {
                        // 1. Log the best result (creates client + 1st proposal)
                        const bestResult = mappedResults[0];
                        const savedProposal = await crmService.logSimulation(state.invoiceData, bestResult, state.invoiceData.client_name);
                        dispatch({ type: 'SET_SAVED_PROPOSAL_ID', payload: savedProposal.id });

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
                    } catch (persistError) {
                        console.error('[Simulator] Failed to persist proposals:', persistError);
                    }
                }

            }
        } catch (error) {
            console.error('Comparison failed', error);
            dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Error al realizar la comparación' });
        }
    }, [state.invoiceData, state.isMockMode]);

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