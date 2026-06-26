'use server';

import { consolidateCupsInvoices, type AnnualConsolidatedProfile } from '@/lib/aletheia/annualConsolidation';
import { auditAnnualProfile, type AnnualAuditResult } from '@/lib/aletheia/annualAudit';

export interface AnnualAuditActionResult {
    profile: AnnualConsolidatedProfile;
    audit: AnnualAuditResult;
}

export async function getAnnualAuditAction(cups: string): Promise<AnnualAuditActionResult | null> {
    const profile = await consolidateCupsInvoices(cups);
    if (!profile) return null;

    const audit = auditAnnualProfile(profile);
    return { profile, audit };
}
