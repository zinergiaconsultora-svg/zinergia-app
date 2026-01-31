import { useReducer, useEffect, useCallback } from 'react';
import { crmService } from '@/services/crmService';
import { Client, ClientType } from '@/types/crm';

interface UseClientFormProps {
    clientToEdit?: Client | null;
    onSuccess: () => void;
    onClose: () => void;
}

interface FormState {
    loading: boolean;
    step: number;
    error: string | null;
    formData: {
        name: string;
        email: string;
        phone: string;
        address: string;
        type: ClientType;
        cups: string;
        current_supplier: string;
        tariff_type: string;
    };
}

type FormAction =
    | { type: 'SET_FIELD'; field: keyof FormState['formData']; value: string }
    | { type: 'SET_STEP'; step: number }
    | { type: 'SET_ERROR'; error: string | null }
    | { type: 'START_SUBMIT' }
    | { type: 'SUBMIT_SUCCESS' }
    | { type: 'SUBMIT_ERROR'; error: string }
    | { type: 'RESET_FORM'; clientToEdit?: Client | null };

const defaultFormData = {
    name: '',
    email: '',
    phone: '',
    address: '',
    type: 'particular' as ClientType,
    cups: '',
    current_supplier: '',
    tariff_type: '2.0TD'
};

const initialState: FormState = {
    loading: false,
    step: 1,
    error: null,
    formData: defaultFormData
};

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case 'SET_FIELD':
            return {
                ...state,
                formData: { ...state.formData, [action.field]: action.value }
            };
        case 'SET_STEP':
            return { ...state, step: action.step };
        case 'SET_ERROR':
            return { ...state, error: action.error };
        case 'START_SUBMIT':
            return { ...state, loading: true, error: null };
        case 'SUBMIT_SUCCESS':
            return { ...state, loading: false };
        case 'SUBMIT_ERROR':
            return { ...state, loading: false, error: action.error };
        case 'RESET_FORM':
            if (action.clientToEdit) {
                return {
                    ...initialState,
                    formData: {
                        name: action.clientToEdit.name || '',
                        email: action.clientToEdit.email || '',
                        phone: action.clientToEdit.phone || '',
                        address: action.clientToEdit.address || '',
                        type: action.clientToEdit.type || 'particular',
                        cups: action.clientToEdit.cups || '',
                        current_supplier: action.clientToEdit.current_supplier || '',
                        tariff_type: action.clientToEdit.tariff_type || '2.0TD'
                    }
                };
            }
            return initialState;
        default:
            return state;
    }
}

export function useClientForm({ clientToEdit, onSuccess, onClose }: UseClientFormProps) {
    const [state, dispatch] = useReducer(formReducer, initialState);

    useEffect(() => {
        dispatch({ type: 'RESET_FORM', clientToEdit });
    }, [clientToEdit]);

    const handleChange = useCallback((field: keyof FormState['formData'], value: string) => {
        dispatch({ type: 'SET_FIELD', field, value });
    }, []);

    const setStep = useCallback((step: number) => {
        dispatch({ type: 'SET_STEP', step });
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        dispatch({ type: 'START_SUBMIT' });

        try {
            if (clientToEdit) {
                await crmService.updateClient(clientToEdit.id, state.formData);
            } else {
                await crmService.createClient({
                    ...state.formData,
                    status: 'new'
                });
            }
            dispatch({ type: 'SUBMIT_SUCCESS' });
            onSuccess();
            onClose();
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Error al guardar cliente';
            dispatch({ type: 'SUBMIT_ERROR', error: errorMessage });
        }
    }, [clientToEdit, state.formData, onSuccess, onClose]);

    return {
        formData: state.formData,
        step: state.step,
        setStep,
        loading: state.loading,
        error: state.error,
        handleChange,
        handleSubmit
    };
}