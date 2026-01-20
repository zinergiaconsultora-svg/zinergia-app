'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmailAction({ to, subject, html }: SendEmailParams) {
    if (!process.env.RESEND_API_KEY) {
        console.error('Missing RESEND_API_KEY');
        return { success: false, error: 'Configuration error' };
    }

    try {
        const data = await resend.emails.send({
            from: 'Zinergia <onboarding@resend.dev>', // Usar este remitente para pruebas
            to: [to], // En modo test, solo puedes enviar al email con el que te registraste en Resend
            subject: subject,
            html: html,
        });

        if (data.error) {
            console.error('Resend API Error:', data.error);
            return { success: false, error: data.error.message };
        }

        return { success: true, id: data.data?.id };
    } catch (error) {
        console.error('Server Action Error:', error);
        return { success: false, error: 'Failed to send email' };
    }
}
