import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { InvoiceRegistryRow, LeadProposalSummary } from '@/app/actions/invoices';
import { getLeadProposalsAction } from '@/app/actions/invoices';
import { getLeadClientAction } from '@/app/actions/clients';
import {
    addLeadNoteAction,
    getLeadAuditEventsAction,
    type LeadAuditEvent,
} from '@/app/actions/leadAudit';
import type { Client } from '@/types/crm';

export function useLeadDetail() {
    const [selectedLead, setSelectedLead] = useState<InvoiceRegistryRow | null>(null);
    const [auditEvents, setAuditEvents] = useState<LeadAuditEvent[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [leadProposals, setLeadProposals] = useState<LeadProposalSummary[]>([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [leadClient, setLeadClient] = useState<Client | null>(null);
    const [clientLoading, setClientLoading] = useState(false);
    const [editingLeadClient, setEditingLeadClient] = useState<Client | null>(null);
    const [customProposalLead, setCustomProposalLead] = useState<InvoiceRegistryRow | null>(null);
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const auditRequestJobRef = useRef<string | null>(null);
    const leadContextRequestJobRef = useRef<string | null>(null);

    const loadLeadAudit = useCallback(async (jobId: string) => {
        auditRequestJobRef.current = jobId;
        setAuditLoading(true);
        try {
            const events = await getLeadAuditEventsAction(jobId);
            if (auditRequestJobRef.current === jobId) setAuditEvents(events);
        } catch {
            if (auditRequestJobRef.current === jobId) toast.error('No se pudo cargar la auditoría');
        } finally {
            if (auditRequestJobRef.current === jobId) setAuditLoading(false);
        }
    }, []);

    const loadLeadContext = useCallback(async (jobId: string) => {
        leadContextRequestJobRef.current = jobId;
        setProposalsLoading(true);
        setClientLoading(true);
        setLeadProposals([]);
        setLeadClient(null);

        const [proposalsResult, clientResult] = await Promise.allSettled([
            getLeadProposalsAction(jobId),
            getLeadClientAction(jobId),
        ]);

        if (leadContextRequestJobRef.current !== jobId) return;

        if (proposalsResult.status === 'fulfilled') {
            setLeadProposals(proposalsResult.value);
        } else {
            toast.error('No se pudieron cargar las propuestas del lead');
        }

        if (clientResult.status === 'fulfilled') {
            setLeadClient(clientResult.value);
        } else {
            toast.error('No se pudo cargar el cliente vinculado');
        }

        setProposalsLoading(false);
        setClientLoading(false);
    }, []);

    const openLeadDetail = useCallback((lead: InvoiceRegistryRow) => {
        setSelectedLead(lead);
        setNoteText('');
        setAuditEvents([]);
        setLeadProposals([]);
        setLeadClient(null);
        void loadLeadAudit(lead.job_id);
        void loadLeadContext(lead.job_id);
    }, [loadLeadAudit, loadLeadContext]);

    const closeLeadDetail = useCallback(() => {
        auditRequestJobRef.current = null;
        leadContextRequestJobRef.current = null;
        setSelectedLead(null);
        setAuditEvents([]);
        setAuditLoading(false);
        setLeadProposals([]);
        setProposalsLoading(false);
        setLeadClient(null);
        setClientLoading(false);
        setEditingLeadClient(null);
        setCustomProposalLead(null);
        setNoteText('');
    }, []);

    const addNote = useCallback(async () => {
        if (!selectedLead) return;
        const note = noteText.trim();
        if (!note) {
            toast.error('La nota no puede estar vacía');
            return;
        }
        try {
            setNoteSaving(true);
            const result = await addLeadNoteAction(selectedLead.job_id, note);
            if (!result.success) {
                toast.error(result.message ?? 'No se pudo guardar la nota');
                return;
            }
            toast.success('Nota añadida');
            setNoteText('');
            await loadLeadAudit(selectedLead.job_id);
        } catch {
            toast.error('No se pudo guardar la nota');
        } finally {
            setNoteSaving(false);
        }
    }, [selectedLead, noteText, loadLeadAudit]);

    return {
        selectedLead,
        setSelectedLead,
        auditEvents,
        auditLoading,
        leadProposals,
        setLeadProposals,
        proposalsLoading,
        leadClient,
        setLeadClient,
        clientLoading,
        editingLeadClient,
        setEditingLeadClient,
        customProposalLead,
        setCustomProposalLead,
        noteText,
        setNoteText,
        noteSaving,
        openLeadDetail,
        closeLeadDetail,
        addNote,
        loadLeadAudit,
    };
}
