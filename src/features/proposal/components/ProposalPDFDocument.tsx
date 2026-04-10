import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
    invoiceData: InvoiceData;
    results: SavingsResult[];
    recommendations?: OptimizationRecommendation[];
    opportunities?: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtEur = (n: number) =>
    n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

const fmtPct = (n: number) => n.toFixed(1) + '%';

const today = new Date().toLocaleDateString('es-ES', {
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
}: Props) {
    const best = results[0];
    if (!best) return null;

    const cups = invoiceData.cups ?? '—';
    const clientName = invoiceData.client_name ?? 'Cliente';

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
                        {[
                            ['Energía P1 (kWh)', String(invoiceData.energy_p1 || 0)],
                            ['Energía P2 (kWh)', String(invoiceData.energy_p2 || 0)],
                            ['Energía P3 (kWh)', String(invoiceData.energy_p3 || 0)],
                            ['Potencia P1 (kW)', String(invoiceData.power_p1 || 0)],
                        ].map(([label, value]) => (
                            <View key={label} style={s.detailRow}>
                                <Text style={s.detailLabel}>{label}</Text>
                                <Text style={s.detailValue}>{value}</Text>
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
                        Simulación basada en datos históricos. Los ahorros reales pueden variar.
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
                        <Text style={s.footerText}>Simulación basada en datos históricos. Los ahorros reales pueden variar.</Text>
                        <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
                            `${pageNumber} / ${totalPages}`
                        } />
                    </View>
                </Page>
            )}
        </Document>
    );
}
