import { Resend } from 'resend';

// Initialize Resend with API Key from environment variables
// Make sure RESEND_API_KEY is set in .env.local
export const resend = new Resend(process.env.RESEND_API_KEY);
