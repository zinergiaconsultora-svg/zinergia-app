'use server';

import { resend } from '@/lib/resend';
import { Proposal } from '@/types/crm';
import { generateProposalPDF } from '@/lib/pdf/generate';

const FROM = 'Zinergia <onboarding@resend.dev>';

/** Email al cliente confirmando que su firma fue registrada */
export async function sendClientAcceptanceEmail(
    clientEmail: string,
    clientName: string,
    proposal: { annual_savings: number; savings_percent: number; offer_snapshot: { marketer_name: string; tariff_name: string }; offer_annual_cost: number },
    signedName?: string,
) {
    if (!process.env.RESEND_API_KEY) return { success: false, error: 'No API key' };
    const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
  <h2 style="color:#10b981;margin-bottom:4px;">¡Firma registrada con éxito!</h2>
  <p style="color:#64748b;margin-bottom:24px;font-size:14px;">Fecha: ${date}</p>
  <p>Hola <strong>${signedName || clientName}</strong>,</p>
  <p>Tu propuesta de ahorro energético ha quedado firmada electrónicamente. Aquí tienes el resumen:</p>
  <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:20px 0;">
    <p style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#0f172a;">${Math.round(proposal.annual_savings)}€ / año</p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ahorro estimado · ${proposal.savings_percent.toFixed(1)}% de reducción</p>
  </div>
  <table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr><td style="color:#64748b;padding:6px 0;">Comercializadora</td><td style="font-weight:600;">${proposal.offer_snapshot.marketer_name}</td></tr>
    <tr><td style="color:#64748b;padding:6px 0;">Tarifa</td><td style="font-weight:600;">${proposal.offer_snapshot.tariff_name}</td></tr>
    <tr><td style="color:#64748b;padding:6px 0;">Nuevo coste anual</td><td style="font-weight:600;">${Math.round(proposal.offer_annual_cost)}€</td></tr>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Tu asesor de Zinergia se pondrá en contacto contigo para coordinar el cambio de tarifa.</p>
</div>`;

    const { error } = await resend.emails.send({
        from: FROM,
        to: [clientEmail],
        subject: `Firma confirmada — ahorro de ${Math.round(proposal.annual_savings)}€/año`,
        html,
    });
    return error ? { success: false, error: error.message } : { success: true };
}

/** Email al agente notificando que el cliente ha firmado */
export async function sendAgentAcceptanceEmail(
    agentEmail: string,
    clientName: string,
    proposal: { annual_savings: number; offer_snapshot: { marketer_name: string }; id: string },
) {
    if (!process.env.RESEND_API_KEY) return { success: false, error: 'No API key' };
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zinergia.vercel.app';
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
  <h2 style="color:#6366f1;">Propuesta aceptada</h2>
  <p><strong>${clientName}</strong> ha firmado la propuesta de <strong>${Math.round(proposal.annual_savings)}€/año</strong> con ${proposal.offer_snapshot.marketer_name}.</p>
  <a href="${baseUrl}/dashboard/proposals/${proposal.id}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ver propuesta</a>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Zinergia CRM · notificación automática</p>
</div>`;

    const { error } = await resend.emails.send({
        from: FROM,
        to: [agentEmail],
        subject: `${clientName} firmó — ${Math.round(proposal.annual_savings)}€/año asegurados`,
        html,
    });
    return error ? { success: false, error: error.message } : { success: true };
}

export async function sendProposalEmail(
    email: string,
    clientName: string,
    proposal: Proposal
) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY is not set. Email delivery disabled.');
            return { success: false, error: 'El envío de email no está configurado. Contacta con soporte.' };
        }

        // Generate PDF Buffer
        const pdfBuffer = await generateProposalPDF(proposal);
        const pdfBase64 = pdfBuffer.toString('base64');

        const subject = `Propuesta de Ahorro Energético Zinergia - ${clientName}`;

        // Simple HTML Template
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h1 style="color: #10b981; margin-bottom: 24px;">Tu Propuesta de Ahorro</h1>
                <p>Hola <strong>${clientName}</strong>,</p>
                <p>Adjuntamos el resumen de tu auditoría energética realizada por Zinergia.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0;">
                    <h2 style="margin-top: 0; color: #1e293b;">Ahorro Estimado: ${proposal.annual_savings.toFixed(0)}€ / año</h2>
                    <p style="margin-bottom: 0; color: #64748b;">Eficiencia mejorada en un ${proposal.savings_percent.toFixed(1)}%</p>
                </div>

                <h3>Detalles de la Oferta Recomendada</h3>
                <ul>
                    <li><strong>Comercializadora:</strong> ${proposal.offer_snapshot.marketer_name}</li>
                    <li><strong>Tarifa:</strong> ${proposal.offer_snapshot.tariff_name}</li>
                    <li><strong>Nuevo Coste Anual:</strong> ${proposal.offer_annual_cost.toFixed(0)}€</li>
                </ul>

                <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
                    Esta es una simulación basada en los datos proporcionados. 
                    Para contratar esta oferta, contacta con tu asesor de Zinergia.
                </p>
            </div>
        `;

        const data = await resend.emails.send({
            from: 'Zinergia <onboarding@resend.dev>', // Update this with verified domain later
            to: [email],
            subject: subject,
            html: html,
            attachments: [
                {
                    filename: `propuesta_${clientName.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBase64
                }
            ]
        });

        if (data.error) {
            console.error('Resend error:', data.error);
            return { success: false, error: data.error.message };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Server action error:', error);
        return { success: false, error: 'Failed to send email' };
    }
}
