import { useState, useEffect } from 'react';
import { crmService } from '@/services/crmService';
import { Client, ClientType } from '@/types/crm';

interface UseClientFormProps {
    clientToEdit?: Client | null;
    onSuccess: () => void;
    onClose: () => void;
}

export function useClientForm({ clientToEdit, onSuccess, onClose }: UseClientFormProps) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        type: 'particular' as ClientType,
        cups: '',
        current_supplier: '',
        tariff_type: '2.0TD'
    });

    useEffect(() => {
        if (clientToEdit) {
            setFormData({
                name: clientToEdit.name || '',
                email: clientToEdit.email || '',
                phone: clientToEdit.phone || '',
                address: clientToEdit.address || '',
                type: clientToEdit.type || 'particular',
                cups: clientToEdit.cups || '',
                current_supplier: clientToEdit.current_supplier || '',
                tariff_type: clientToEdit.tariff_type || '2.0TD'
            });
        } else {
            setFormData({
                name: '',
                email: '',
                phone: '',
                address: '',
                type: 'particular' as ClientType,
                cups: '',
                current_supplier: '',
                tariff_type: '2.0TD'
            });
        }
        setStep(1);
        setError(null);
    }, [clientToEdit]);

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (clientToEdit) {
                await crmService.updateClient(clientToEdit.id, formData);
            } else {
                await crmService.createClient({
                    ...formData,
                    status: 'new'
                });
            }
            onSuccess();
            onClose();
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Error al guardar cliente');
        } finally {
            setLoading(false);
        }
    };

    return {
        formData,
        step,
        setStep,
        loading,
        error,
        handleChange,
        handleSubmit
    };
}
