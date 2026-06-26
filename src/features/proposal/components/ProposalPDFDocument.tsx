import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';
import { getMarketerLogo } from '@/lib/marketers/logos';
import type { AnnualAuditResult } from '@/lib/aletheia/annualAudit';
import type { AnnualConsolidatedProfile } from '@/lib/aletheia/annualConsolidation';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
    invoiceData: InvoiceData;
    results: SavingsResult[];
    recommendations?: OptimizationRecommendation[];
    opportunities?: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string };
    annualAudit?: { profile: AnnualConsolidatedProfile; audit: AnnualAuditResult } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtEur = (n: number | null | undefined) => {
    if (n == null || isNaN(n)) return '— €';
    return Math.round(n).toLocaleString('es-ES') + ' €';
};

const fmtPct = (n: number | null | undefined) => {
    if (n == null || isNaN(n)) return '—%';
    return n.toFixed(1) + '%';
};

const fmtEur2 = (n: number | null | undefined) => {
    if (n == null || isNaN(n)) return '— €';
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};
const fmtPrice = (n?: number | null) => n && n > 0 ? n.toFixed(4) + ' €/kWh' : '—';
const fmtPowerPrice = (n?: number | null) => n && n > 0 ? n.toFixed(4) + ' €/kW día' : '—';

function resolveLogoUrl(marketerName?: string | null, explicitLogo?: string | null): string | null {
    const logoUrl = explicitLogo || getMarketerLogo(marketerName);
    if (!logoUrl) return null;
    if (!logoUrl.startsWith('/')) return logoUrl;
    if (typeof window === 'undefined') return logoUrl;
    return `${window.location.origin}${logoUrl}`;
}

const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
});
const validUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const C = {
    indigo: '#4f46e5',
    emerald: '#059669',
    slate900: '#0f172a',
    slate700: '#334155',
    slate500: '#64748b',
    slate200: '#e2e8f0',
    slate100: '#f1f5f9',
    white: '#ffffff',
    amber: '#d97706',
    rose: '#e11d48',
};

const s = StyleSheet.create({
    page: {
        backgroundColor: C.white,
        paddingTop: 32,
        paddingBottom: 32,
        paddingHorizontal: 36,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: C.slate900,
    },

    // ── Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 2,
        borderBottomColor: C.indigo,
        paddingBottom: 12,
        marginBottom: 20,
    },
    brandBlock: { flexDirection: 'column', gap: 2 },
    brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.indigo },
    brandSub: { fontSize: 8, color: C.slate500, letterSpacing: 1.5 },
    dateBlock: { alignItems: 'flex-end' },
    dateLabel: { fontSize: 7, color: C.slate500, textTransform: 'uppercase', letterSpacing: 0.8 },
    dateValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.slate700 },

    // ── Section title
    sectionTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: C.slate900,
        marginBottom: 8,
        marginTop: 18,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: C.slate200,
    },

    // ── Client block
    clientBox: {
        backgroundColor: C.slate100,
        borderRadius: 6,
        padding: 14,
        marginBottom: 18,
    },
    clientName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.slate900, marginBottom: 4 },
    clientMeta: { fontSize: 8, color: C.slate500 },
    proposalMeta: {
        flexDirection: 'row',
        gap: 8,
        marginTop: -8,
        marginBottom: 16,
    },
    proposalMetaItem: {
        flex: 1,
        borderWidth: 1,
        borderColor: C.slate200,
        borderRadius: 6,
        padding: 8,
    },
    proposalMetaLabel: { fontSize: 6.5, color: C.slate500, textTransform: 'uppercase', letterSpacing: 0.8 },
    proposalMetaValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.slate900, marginTop: 2 },

    // ── Savings hero
    savingsHero: {
        backgroundColor: C.slate900,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
    heroValue: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.emerald },
    heroPct: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.emerald, marginTop: 2 },
    heroCostLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
    heroCostValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white },
    heroCostCrossed: { fontSize: 13, color: '#64748b', textDecorationLine: 'line-through' },
    heroSep: { width: 1, backgroundColor: '#334155', height: 60, alignSelf: 'center' },

    // ── Offer table
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: C.slate100,
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 4,
        marginBottom: 2,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.slate100,
    },
    tableRowBest: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#ecfdf5',
        borderRadius: 4,
        marginBottom: 2,
    },
    colMarketer: { flex: 2.5, fontSize: 8 },
    colTariff: { flex: 2, fontSize: 8 },
    colCost: { flex: 1.5, fontSize: 8, textAlign: 'right' },
    colSavings: { flex: 1.5, fontSize: 8, textAlign: 'right' },
    colPct: { flex: 1, fontSize: 8, textAlign: 'right' },
    thText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.slate500, textTransform: 'uppercase', letterSpacing: 0.5 },
    bestBadge: {
        backgroundColor: C.emerald,
        color: C.white,
        fontSize: 6,
        fontFamily: 'Helvetica-Bold',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        marginLeft: 4,
        textTransform: 'uppercase',
    },

    // ── Recommendation card
    recCard: {
        flexDirection: 'row',
        borderLeftWidth: 3,
        paddingLeft: 8,
        paddingVertical: 6,
        marginBottom: 6,
        backgroundColor: C.slate100,
        borderRadius: 4,
    },
    recHigh: { borderLeftColor: C.rose },
    recMedium: { borderLeftColor: C.amber },
    recLow: { borderLeftColor: C.indigo },
    recTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.slate900 },
    recDesc: { fontSize: 7, color: C.slate500, marginTop: 2 },
    recSaving: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.emerald, marginLeft: 'auto' },

    // ── Invoice details
    detailsGrid: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    detailCol: { flex: 1 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.slate200 },
    detailLabel: { fontSize: 7, color: C.slate500 },
    detailValue: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.slate700 },

    // ── Optimized invoice simulation
    optimizedBox: {
        borderWidth: 1,
        borderColor: C.slate200,
        borderRadius: 8,
        padding: 10,
        marginTop: 6,
        marginBottom: 12,
    },
    optimizedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    marketerLogo: { width: 70, height: 30, objectFit: 'contain' },
    miniCards: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    miniCard: { flex: 1, borderRadius: 6, padding: 8, backgroundColor: C.slate100 },
    miniLabel: { fontSize: 6.5, color: C.slate500, textTransform: 'uppercase', letterSpacing: 0.5 },
    miniValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.slate900, marginTop: 2 },
    miniValueGood: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.emerald, marginTop: 2 },
    priceGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
    priceCol: { flex: 1 },
    priceTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.slate700, marginBottom: 3 },

    // ── Opportunities
    oppCard: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 4,
        padding: 8,
        marginBottom: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    oppType: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.amber, textTransform: 'uppercase', marginBottom: 2 },
    oppMsg: { fontSize: 7, color: '#78350f' },
    oppRoi: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.amber, textAlign: 'right' },

    // ── Commercial close
    closeStrip: {
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    closeTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.emerald, marginBottom: 4 },
    closeText: { fontSize: 7.5, color: '#065f46', lineHeight: 1.5 },

    // ── Footer
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 36,
        right: 36,
        borderTopWidth: 1,
        borderTopColor: C.slate200,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: { fontSize: 6.5, color: C.slate500 },
});

// ─── Component ───────────────────────────────────────────────────────────────

export function ProposalPDFDocument({
    invoiceData,
    results,
    recommendations = [],
    opportunities = [],
    clientProfile,
    annualAudit,
}: Props) {
    const best = results[0];
    if (!best) return null;

    const cups = invoiceData.cups ?? '—';
    const clientName = invoiceData.client_name ?? 'Cliente';
    const audit = best.calculation_audit;
    const periodSavings = audit?.periodSavings ?? (best.annual_savings / 365) * (invoiceData.period_days || 30);
    const currentInvoice = audit?.currentInvoiceTotal ?? (best.current_annual_cost / 365) * (invoiceData.period_days || 30);
    const optimizedInvoice = audit?.simulatedInvoiceTotal ?? (best.offer_annual_cost / 365) * (invoiceData.period_days || 30);
    const pricePeriods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
    const energyPrices = best.offer.energy_price ?? {};
    const powerPrices = best.offer.power_price ?? {};
    const logoSource = resolveLogoUrl(best.offer.marketer_name, best.offer.logo_url);
    const invoicePeriods = [1, 2, 3, 4, 5, 6].map(period => {
        const energy = Number(invoiceData[`energy_p${period}` as keyof InvoiceData] || 0);
        const power = Number(invoiceData[`power_p${period}` as keyof InvoiceData] || 0);
        return { period, energy, power };
    });

    return (
        <Document>
            {/* ── Page 1: Resumen ejecutivo ── */}
            <Page size="A4" style={s.page}>
                {/* Header */}
                <View style={s.header}>
                    <View style={s.brandBlock}>
                        <Text style={s.brandName}>Zinergia</Text>
                        <Text style={s.brandSub}>CONSULTORÍA ENERGÉTICA</Text>
                    </View>
                    <View style={s.dateBlock}>
                        <Text style={s.dateLabel}>Fecha del informe</Text>
                        <Text style={s.dateValue}>{today}</Text>
                    </View>
                </View>

                {/* Client */}
                <View style={s.clientBox}>
                    <Text style={s.clientName}>{clientName}</Text>
                    <Text style={s.clientMeta}>
                        {cups !== '—' ? `CUPS: ${cups}` : ''}
                        {invoiceData.company_name ? `  ·  Actual: ${invoiceData.company_name}` : ''}
                        {invoiceData.tariff_name ? ` (${invoiceData.tariff_name})` : ''}
                    </Text>
                </View>

                <View style={s.proposalMeta}>
                    <View style={s.proposalMetaItem}>
                        <Text style={s.proposalMetaLabel}>Tipo de documento</Text>
                        <Text style={s.proposalMetaValue}>Propuesta comercial</Text>
                    </View>
                    <View style={s.proposalMetaItem}>
                        <Text style={s.proposalMetaLabel}>Validez estimada</Text>
                        <Text style={s.proposalMetaValue}>Hasta {validUntil}</Text>
                    </View>
                    <View style={s.proposalMetaItem}>
                        <Text style={s.proposalMetaLabel}>Base del estudio</Text>
                        <Text style={s.proposalMetaValue}>Factura original + tarifas activas</Text>
                    </View>
                </View>

                {/* Savings hero */}
                <Text style={s.sectionTitle}>Resumen de Ahorro</Text>
                <View style={s.savingsHero}>
                    <View>
                        <Text style={s.heroLabel}>Ahorro anual estimado</Text>
                        <Text style={s.heroValue}>{fmtEur(best.annual_savings)}</Text>
                        <Text style={s.heroPct}>−{fmtPct(best.savings_percent)}</Text>
                    </View>
                    <View style={s.heroSep} />
                    <View>
                        <Text style={s.heroCostLabel}>Coste actual / año</Text>
                        <Text style={s.heroCostCrossed}>{fmtEur(best.current_annual_cost)}</Text>
                        <Text style={{ ...s.heroCostLabel, marginTop: 6 }}>Nuevo coste / año</Text>
                        <Text style={s.heroCostValue}>{fmtEur(best.offer_annual_cost)}</Text>
                    </View>
                    <View>
                        <Text style={s.heroCostLabel}>Comercializadora</Text>
                        <Text style={{ ...s.heroCostValue, fontSize: 12 }}>{best.offer.marketer_name}</Text>
                        <Text style={{ ...s.heroCostLabel, marginTop: 4 }}>Tarifa</Text>
                        <Text style={{ ...s.heroCostValue, fontSize: 10 }}>{best.offer.tariff_name}</Text>
                    </View>
                </View>

                {clientProfile?.sales_argument && (
                    <View style={{ backgroundColor: '#eef2ff', borderRadius: 6, padding: 10, marginBottom: 16 }}>
                        <Text style={{ fontSize: 7, color: C.indigo, fontFamily: 'Helvetica-BoldOblique' }}>
                            &quot;{clientProfile.sales_argument}&quot;
                        </Text>
                    </View>
                )}

                {/* Optimized invoice simulation */}
                <Text style={s.sectionTitle}>Simulación de Factura Optimizada</Text>
                <View style={s.optimizedBox}>
                    <View style={s.optimizedHeader}>
                        <View>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.slate900 }}>
                                {best.offer.marketer_name} · {best.offer.tariff_name}
                            </Text>
                            <Text style={{ fontSize: 7, color: C.slate500, marginTop: 2 }}>
                                Período simulado: {invoiceData.period_days || 30} días
                            </Text>
                        </View>
                        {logoSource && (
                            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image no expone prop alt.
                            <Image src={logoSource} style={s.marketerLogo} />
                        )}
                    </View>

                    <View style={s.miniCards}>
                        <View style={s.miniCard}>
                            <Text style={s.miniLabel}>Factura actual comparable</Text>
                            <Text style={s.miniValue}>{fmtEur2(currentInvoice)}</Text>
                        </View>
                        <View style={s.miniCard}>
                            <Text style={s.miniLabel}>Factura optimizada</Text>
                            <Text style={s.miniValue}>{fmtEur2(optimizedInvoice)}</Text>
                        </View>
                        <View style={s.miniCard}>
                            <Text style={s.miniLabel}>Ahorro factura</Text>
                            <Text style={s.miniValueGood}>{fmtEur2(periodSavings)} · {fmtPct(best.savings_percent)}</Text>
                        </View>
                        <View style={s.miniCard}>
                            <Text style={s.miniLabel}>Ahorro anual</Text>
                            <Text style={s.miniValueGood}>{fmtEur2(best.annual_savings)}</Text>
                        </View>
                    </View>

                    {audit && audit.lines && (
                        <>
                            {audit.lines.filter(line => line && Math.abs(line.amount ?? 0) > 0.005).map(line => (
                                <View key={line.label} style={s.detailRow}>
                                    <Text style={s.detailLabel}>{line.label}</Text>
                                    <Text style={s.detailValue}>{fmtEur2(line.amount)}</Text>
                                </View>
                            ))}
                            <View style={s.detailRow}>
                                <Text style={s.detailLabel}>Subtotal antes de impuesto eléctrico</Text>
                                <Text style={s.detailValue}>{fmtEur2(audit.subtotalBeforeTax)}</Text>
                            </View>
                            <View style={s.detailRow}>
                                <Text style={s.detailLabel}>Impuesto eléctrico</Text>
                                <Text style={s.detailValue}>{fmtEur2(audit.electricityTax)}</Text>
                            </View>
                            <View style={s.detailRow}>
                                <Text style={s.detailLabel}>IVA</Text>
                                <Text style={s.detailValue}>{fmtEur2(audit.vat)}</Text>
                            </View>
                        </>
                    )}

                    <View style={s.priceGrid}>
                        <View style={s.priceCol}>
                            <Text style={s.priceTitle}>Precios nuevos de energía</Text>
                            {pricePeriods.map(period => (
                                <View key={`e-${period}`} style={s.detailRow}>
                                    <Text style={s.detailLabel}>{period.toUpperCase()}</Text>
                                    <Text style={s.detailValue}>{fmtPrice(energyPrices[period])}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={s.priceCol}>
                            <Text style={s.priceTitle}>Precios nuevos de potencia</Text>
                            {pricePeriods.map(period => (
                                <View key={`p-${period}`} style={s.detailRow}>
                                    <Text style={s.detailLabel}>{period.toUpperCase()}</Text>
                                    <Text style={s.detailValue}>{fmtPowerPrice(powerPrices[period])}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Comparison table */}
                <Text style={s.sectionTitle}>Comparativa de Ofertas</Text>

                {/* Table header */}
                <View style={s.tableHeader}>
                    <Text style={[s.colMarketer, s.thText]}>Comercializadora</Text>
                    <Text style={[s.colTariff, s.thText]}>Tarifa</Text>
                    <Text style={[s.colCost, s.thText]}>Coste/año</Text>
                    <Text style={[s.colSavings, s.thText]}>Ahorro</Text>
                    <Text style={[s.colPct, s.thText]}>%</Text>
                </View>

                {/* Current row */}
                <View style={s.tableRow}>
                    <Text style={[s.colMarketer, { color: C.slate500 }]}>{invoiceData.company_name ?? 'Actual'}</Text>
                    <Text style={[s.colTariff, { color: C.slate500 }]}>{invoiceData.tariff_name ?? '—'}</Text>
                    <Text style={[s.colCost, { color: C.slate700, fontFamily: 'Helvetica-Bold' }]}>
                        {fmtEur(best.current_annual_cost)}
                    </Text>
                    <Text style={[s.colSavings, { color: C.slate500 }]}>—</Text>
                    <Text style={[s.colPct, { color: C.slate500 }]}>—</Text>
                </View>

                {/* Offer rows */}
                {results.slice(0, 5).map((r, i) => (
                    <View key={r.offer.id ?? i} style={i === 0 ? s.tableRowBest : s.tableRow}>
                        <View style={[s.colMarketer, { flexDirection: 'row', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 8, fontFamily: i === 0 ? 'Helvetica-Bold' : 'Helvetica', color: C.slate900 }}>
                                {r.offer.marketer_name}
                            </Text>
                            {i === 0 && <Text style={s.bestBadge}>Mejor</Text>}
                        </View>
                        <Text style={[s.colTariff, { color: C.slate700 }]}>{r.offer.tariff_name}</Text>
                        <Text style={[s.colCost, { fontFamily: 'Helvetica-Bold', color: C.slate900 }]}>
                            {fmtEur(r.offer_annual_cost)}
                        </Text>
                        <Text style={[s.colSavings, { fontFamily: 'Helvetica-Bold', color: C.emerald }]}>
                            {fmtEur(r.annual_savings)}
                        </Text>
                        <Text style={[s.colPct, { fontFamily: 'Helvetica-Bold', color: C.emerald }]}>
                            {fmtPct(r.savings_percent)}
                        </Text>
                    </View>
                ))}

                <View style={s.closeStrip}>
                    <Text style={s.closeTitle}>Siguiente paso recomendado</Text>
                    <Text style={s.closeText}>
                        Confirmar con el cliente que los datos de suministro son correctos, validar condiciones de permanencia
                        y preparar la documentación de contratación de la oferta seleccionada.
                    </Text>
                </View>

                {/* Invoice details */}
                <Text style={s.sectionTitle}>Datos de la Factura</Text>
                <View style={s.detailsGrid}>
                    <View style={s.detailCol}>
                        {[
                            ['CUPS', cups],
                            ['Período (días)', String(invoiceData.period_days)],
                            ['Fecha', invoiceData.invoice_date ?? '—'],
                            ['Nº Factura', invoiceData.invoice_number ?? '—'],
                        ].map(([label, value]) => (
                            <View key={label} style={s.detailRow}>
                                <Text style={s.detailLabel}>{label}</Text>
                                <Text style={s.detailValue}>{value}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={s.detailCol}>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Periodo</Text>
                            <Text style={s.detailValue}>Energía · Potencia</Text>
                        </View>
                        {invoicePeriods.map(({ period, energy, power }) => (
                            <View key={period} style={s.detailRow}>
                                <Text style={s.detailLabel}>P{period}</Text>
                                <Text style={s.detailValue}>
                                    {energy.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kWh · {power.toLocaleString('es-ES', { maximumFractionDigits: 3 })} kW
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Footer */}
                <View style={s.footer} fixed>
                    <Text style={s.footerText}>
                        Zinergia Consultoría Energética · {today}
                    </Text>
                    <Text style={s.footerText}>
                        Documento comercial confidencial. Simulación basada en datos históricos; los ahorros reales pueden variar.
                    </Text>
                    <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
                        `${pageNumber} / ${totalPages}`
                    } />
                </View>
            </Page>

            {/* ── Page 2: Análisis técnico (only if there's content) ── */}
            {(opportunities.length > 0 || recommendations.length > 0) && (
                <Page size="A4" style={s.page}>
                    {/* Header repeated */}
                    <View style={s.header}>
                        <View style={s.brandBlock}>
                            <Text style={s.brandName}>Zinergia</Text>
                            <Text style={s.brandSub}>ANÁLISIS TÉCNICO</Text>
                        </View>
                        <View style={s.dateBlock}>
                            <Text style={s.dateLabel}>{clientName}</Text>
                            <Text style={s.dateValue}>{today}</Text>
                        </View>
                    </View>

                    {/* Opportunities */}
                    {opportunities.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Anomalías Detectadas</Text>
                            {opportunities.map((opp, i) => (
                                <View key={i} style={s.oppCard}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.oppType}>{opp.type}</Text>
                                        <Text style={s.oppMsg}>{opp.message}</Text>
                                    </View>
                                    {opp.roi_months && (
                                        <View style={{ alignItems: 'flex-end', paddingLeft: 8 }}>
                                            <Text style={{ fontSize: 6, color: C.amber, textTransform: 'uppercase' }}>ROI</Text>
                                            <Text style={s.oppRoi}>{opp.roi_months} meses</Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </>
                    )}

                    {/* Recommendations */}
                    {recommendations.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Recomendaciones de Optimización</Text>
                            {recommendations.map((rec, i) => (
                                <View key={i} style={[
                                    s.recCard,
                                    rec.priority === 'HIGH' ? s.recHigh : rec.priority === 'MEDIUM' ? s.recMedium : s.recLow,
                                ]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.recTitle}>{rec.title}</Text>
                                        <Text style={s.recDesc}>{rec.description}</Text>
                                    </View>
                                    {rec.annual_savings > 0 && (
                                        <Text style={s.recSaving}>+{fmtEur(rec.annual_savings)}/año</Text>
                                    )}
                                </View>
                            ))}
                        </>
                    )}

                    <View style={s.footer} fixed>
                        <Text style={s.footerText}>Zinergia Consultoría Energética · {today}</Text>
                        <Text style={s.footerText}>Documento comercial confidencial. Los ahorros reales pueden variar.</Text>
                        <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
                            `${pageNumber} / ${totalPages}`
                        } />
                    </View>
                </Page>
            )}

            {/* ── Page 3: Auditoría Anual (solo si hay datos de ≥2 facturas) ── */}
            {annualAudit && annualAudit.profile.monthsCovered >= 2 && (
                <Page size="A4" style={s.page}>
                    <View style={s.header}>
                        <View style={s.brandBlock}>
                            <Text style={s.brandName}>Zinergia</Text>
                            <Text style={s.brandSub}>AUDITORÍA ANUAL · {annualAudit.profile.monthsCovered} FACTURAS</Text>
                        </View>
                        <View style={s.dateBlock}>
                            <Text style={s.dateLabel}>{clientName}</Text>
                            <Text style={s.dateValue}>{today}</Text>
                        </View>
                    </View>

                    {/* Nivel de confianza + métricas anuales */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <View style={{
                            flex: 1, backgroundColor: C.slate100, borderRadius: 6, padding: 8,
                        }}>
                            <Text style={{ fontSize: 6, color: C.slate500, textTransform: 'uppercase', marginBottom: 4 }}>
                                Nivel de análisis
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.indigo }}>
                                {annualAudit.profile.confidenceLevel === 'certificado' ? 'Certificado'
                                    : annualAudit.profile.confidenceLevel === 'fiable' ? 'Fiable'
                                    : 'Estimación'}
                            </Text>
                            <Text style={{ fontSize: 7, color: C.slate700 }}>
                                {annualAudit.profile.monthsCovered} meses · {annualAudit.profile.confidenceScore}% cobertura
                            </Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: C.slate100, borderRadius: 6, padding: 8 }}>
                            <Text style={{ fontSize: 6, color: C.slate500, textTransform: 'uppercase', marginBottom: 4 }}>
                                Consumo anual real
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.slate900 }}>
                                {Math.round(annualAudit.profile.totalEnergyKwh).toLocaleString('es-ES')} kWh
                            </Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: C.slate100, borderRadius: 6, padding: 8 }}>
                            <Text style={{ fontSize: 6, color: C.slate500, textTransform: 'uppercase', marginBottom: 4 }}>
                                Gasto anual real
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.slate900 }}>
                                {fmtEur(annualAudit.profile.annualTotalAmount)}
                            </Text>
                        </View>
                        {annualAudit.audit.totalQuantifiedSavings > 0 && (
                            <View style={{ flex: 1, backgroundColor: '#ecfdf5', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#6ee7b7' }}>
                                <Text style={{ fontSize: 6, color: C.emerald, textTransform: 'uppercase', marginBottom: 4 }}>
                                    Ahorro total identificado
                                </Text>
                                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.emerald }}>
                                    {fmtEur(annualAudit.audit.totalQuantifiedSavings)}/año
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Hallazgos */}
                    {annualAudit.audit.findings.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Hallazgos de Optimización</Text>
                            {annualAudit.audit.findings.map((finding, i) => {
                                const sevColor = finding.severity === 'critical' ? '#dc2626'
                                    : finding.severity === 'high' ? '#ea580c'
                                    : finding.severity === 'medium' ? '#d97706'
                                    : C.indigo;
                                const sevBg = finding.severity === 'critical' ? '#fef2f2'
                                    : finding.severity === 'high' ? '#fff7ed'
                                    : finding.severity === 'medium' ? '#fffbeb'
                                    : '#eef2ff';
                                return (
                                    <View key={i} style={{
                                        backgroundColor: sevBg,
                                        borderLeftWidth: 3, borderLeftColor: sevColor,
                                        borderRadius: 4, padding: 8, marginBottom: 6,
                                        flexDirection: 'row', gap: 8,
                                    }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: sevColor, marginBottom: 2 }}>
                                                {finding.title}
                                            </Text>
                                            <Text style={{ fontSize: 7, color: C.slate700, marginBottom: 3 }}>
                                                {finding.description}
                                            </Text>
                                            <Text style={{ fontSize: 6, color: C.slate500, fontFamily: 'Helvetica-Oblique' }}>
                                                Acción: {finding.actionLabel}
                                            </Text>
                                        </View>
                                        {finding.annualSavingsEur > 0 && (
                                            <View style={{ alignItems: 'flex-end', justifyContent: 'center', minWidth: 64 }}>
                                                <Text style={{ fontSize: 6, color: C.emerald, textTransform: 'uppercase' }}>ahorro</Text>
                                                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.emerald }}>
                                                    {fmtEur(finding.annualSavingsEur)}
                                                </Text>
                                                <Text style={{ fontSize: 6, color: C.emerald }}>/año</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </>
                    )}

                    {/* Tabla de optimización de potencia */}
                    {annualAudit.audit.powerOptimizationByPeriod && annualAudit.audit.powerOptimizationByPeriod.length > 0 && (
                        <>
                            <Text style={[s.sectionTitle, { marginTop: 8 }]}>Optimización de Potencia por Periodo</Text>
                            <View style={{ borderWidth: 1, borderColor: C.slate200, borderRadius: 4, overflow: 'hidden' }}>
                                <View style={{ flexDirection: 'row', backgroundColor: C.slate100, padding: 5 }}>
                                    {['Periodo', 'Contratada (kW)', 'Pico real (kW)', 'Óptima (kW)', 'Ahorro/año'].map(h => (
                                        <Text key={h} style={{ flex: 1, fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.slate500, textTransform: 'uppercase' }}>
                                            {h}
                                        </Text>
                                    ))}
                                </View>
                                {annualAudit.audit.powerOptimizationByPeriod.map((p, i) => (
                                    <View key={i} style={{
                                        flexDirection: 'row', padding: 5,
                                        backgroundColor: i % 2 === 0 ? C.white : C.slate100,
                                    }}>
                                        <Text style={{ flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold' }}>{p.period}</Text>
                                        <Text style={{ flex: 1, fontSize: 7 }}>{p.contracted.toFixed(1)}</Text>
                                        <Text style={{ flex: 1, fontSize: 7 }}>{p.realPeak.toFixed(1)}{p.isFromMaximeter ? ' ↑' : ''}</Text>
                                        <Text style={{ flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.emerald }}>{p.optimal}</Text>
                                        <Text style={{ flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.emerald }}>
                                            {p.savingsEur > 0 ? fmtEur(p.savingsEur) : '—'}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    <View style={s.footer} fixed>
                        <Text style={s.footerText}>Zinergia Consultoría Energética · {today}</Text>
                        <Text style={s.footerText}>Auditoría basada en {annualAudit.profile.monthsCovered} facturas reales del suministro.</Text>
                        <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
                            `${pageNumber} / ${totalPages}`
                        } />
                    </View>
                </Page>
            )}
        </Document>
    );
}
