import { sendEmailAction } from '@/app/actions/sendEmail';

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
}

export const emailService = new ResendService();
