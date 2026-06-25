'use server';

import { logger } from '@/lib/utils/logger';

import { Resend } from 'resend';
import { z } from 'zod';
import { requireServerRole } from '@/lib/auth/permissions';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmailSchema = z.object({
    to: z.string().trim().email().max(200),
    subject: z.string().trim().min(1).max(180),
    html: z.string().min(1).max(100_000),
});

type SendEmailParams = z.infer<typeof sendEmailSchema>;

export async function sendEmailAction({ to, subject, html }: SendEmailParams) {
    await requireServerRole(['admin']);

    const parsed = sendEmailSchema.safeParse({ to, subject, html });
    if (!parsed.success) {
        return { success: false, error: 'Invalid email payload' };
    }

    if (!process.env.RESEND_API_KEY) {
        logger.error('Missing RESEND_API_KEY');
        return { success: false, error: 'Configuration error' };
    }

    try {
        const data = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? 'Zinergia <onboarding@resend.dev>',
            to: [parsed.data.to], // En modo test, solo puedes enviar al email con el que te registraste en Resend
            subject: parsed.data.subject,
            html: parsed.data.html,
        });

        if (data.error) {
            logger.error('Resend API Error', data.error);
            return { success: false, error: data.error.message };
        }

        return { success: true, id: data.data?.id };
    } catch (error) {
        logger.error('Server Action Error', error);
        return { success: false, error: 'Failed to send email' };
    }
}
