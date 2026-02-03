'use server';

import { resend } from '@/lib/resend';
import { Proposal } from '@/types/crm';
import { generateProposalPDF } from '@/lib/pdf/generate';

export async function sendProposalEmail(
    email: string,
    clientName: string,
    proposal: Proposal
) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY is not set. Mocking email send.');
            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { success: true, message: 'Email mocked (API Key missing)' };
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
