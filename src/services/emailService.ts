import { sendEmailAction } from '@/app/actions/sendEmail';
import { SavingsResult } from '@/types/crm';
import { OptimizationRecommendation } from '@/lib/aletheia/types';

export class ResendService {

    /**
     * Sends an email via Server Action (securely using Resend).
     * @param to Recipient email
     * @param subject Email subject
     * @param html HTML body content
     */
    async sendEmail(to: string, subject: string, html: string) {
        console.log(`[ResendService] Sending email to ${to}...`);

        try {
            const result = await sendEmailAction({ to, subject, html });

            if (!result.success) {
                // If the error seems to be about restricted 'from' or 'to' in trial mode, log a helpful message.
                if (result.error?.includes('domain')) {
                    console.warn('⚠️ RESEND TRIAL MODE: You can only send to your own email address.');
                }
                throw new Error(result.error || 'Unknown error sending email');
            }

            console.log('[ResendService] Email sent successfully:', result.id);
            return result;

        } catch (error) {
            console.error('[ResendService] Error sending email:', error);
            throw error;
        }
    }

    /**
     * Generates HTML email template for proposal
     */
    generateProposalEmail(
        result: SavingsResult,
        optimizationRecommendations?: OptimizationRecommendation[]
    ): string {
        const currentDate = new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const optimizationsHtml = optimizationRecommendations && optimizationRecommendations.length > 0 ? `
            <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px;">💡 Recomendaciones de Optimización</h3>
                ${optimizationRecommendations.slice(0, 3).map(rec => `
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: 600; color: #78350f; margin-bottom: 5px;">${rec.title}</div>
                        <div style="color: #92400e; font-size: 14px; margin-bottom: 8px;">${rec.description}</div>
                        ${rec.annual_savings > 0 ? `
                            <div style="color: #059669; font-weight: 600; font-size: 14px;">
                                Ahorro potencial: €${rec.annual_savings.toFixed(0)}/año
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : '';

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Propuesta de Ahorro - Zinergia</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Zinergia</h1>
            <p style="margin: 10px 0 0 0; color: #ecfdf5; font-size: 16px;">Propuesta de Ahorro Energético</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
            <!-- Greeting -->
            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hola,
            </p>
            <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Te enviamos nuestra propuesta personalizada para reducir tu factura de luz. Hemos analizado tu consumo y encontrado la mejor opción del mercado para ti.
            </p>

            <!-- Best Offer Card -->
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin-bottom: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; background: #10b981; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 10px;">
                        ⭐ MEJOR OPCIÓN
                    </div>
                    <h2 style="margin: 0 0 10px 0; color: #065f46; font-size: 24px; font-weight: 700;">${result.offer.marketer_name}</h2>
                    <p style="margin: 0; color: #047857; font-size: 14px;">${result.offer.tariff_name}</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div style="text-align: center; padding: 15px; background: #ffffff; border-radius: 8px;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">Costo Anual</div>
                        <div style="font-size: 20px; font-weight: 700; color: #1f2937;">€${result.offer_annual_cost.toFixed(2)}</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #ffffff; border-radius: 8px;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">Ahorro</div>
                        <div style="font-size: 20px; font-weight: 700; color: #059669;">€${result.annual_savings.toFixed(2)}</div>
                    </div>
                </div>

                <div style="text-align: center; padding: 10px; background: #ffffff; border-radius: 8px;">
                    <div style="font-size: 14px; color: #374151;">
                        Ahorro del <strong style="color: #059669;">${result.savings_percent.toFixed(1)}%</strong> sobre tu factura actual
                    </div>
                </div>
            </div>

            ${optimizationsHtml}

            <!-- CTA -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="#" style="display: inline-block; background: #10b981; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Solicitar Cambio de Tarifa
                </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                    Generado el ${currentDate}
                </p>
                <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 11px;">
                    Zinergia - Tu experto en ahorro energético
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Send proposal email
     */
    async sendProposalEmail(
        to: string,
        result: SavingsResult,
        optimizationRecommendations?: OptimizationRecommendation[]
    ) {
        const subject = `Tu propuesta de ahororro de Zinergia - €${result.annual_savings.toFixed(0)}/año`;
        const html = this.generateProposalEmail(result, optimizationRecommendations);

        return this.sendEmail(to, subject, html);
    }
}

export const emailService = new ResendService();
