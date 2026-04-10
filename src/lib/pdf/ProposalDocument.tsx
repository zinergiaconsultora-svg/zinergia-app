import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Proposal } from '@/types/crm';

// ─── Minimalist Brand Tokens ────────────────────────────────────────────────
const BRAND_BLUE   = '#1b2641';
const BRAND_ORANGE = '#ff5722';
const EMERALD      = '#059669';
const SLATE_50     = '#f8fafc';
const SLATE_100    = '#f1f5f9';
const SLATE_200    = '#e2e8f0';
const SLATE_400    = '#94a3b8';
const SLATE_500    = '#64748b';
const SLATE_700    = '#334155';
const SLATE_900    = '#0f172a';
const WHITE        = '#ffffff';

const s = StyleSheet.create({
    // ── Page
    page: {
        flexDirection: 'column',
        backgroundColor: WHITE,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: SLATE_700,
    },

    // ── Header minimalist
    headerStrip: {
        paddingHorizontal: 40,
        paddingTop: 40,
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 1,
        borderBottomColor: SLATE_200,
    },
    logoText: {
        fontSize: 24,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        letterSpacing: 2,
    },
    logoSub: {
        fontSize: 8,
        color: BRAND_ORANGE,
        letterSpacing: 3,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    headerMeta: {
        alignItems: 'flex-end',
    },
    headerMetaText: {
        fontSize: 9,
        color: SLATE_500,
        lineHeight: 1.6,
    },
    headerMetaHighlight: {
        fontSize: 9,
        color: BRAND_BLUE,
        fontFamily: 'Helvetica-Bold',
    },

    // ── Body padding
    body: {
        paddingHorizontal: 40,
        paddingTop: 40,
        paddingBottom: 60,
        flexGrow: 1,
    },

    // ── Hero minimalist block
    heroBlock: {
        marginBottom: 40,
        alignItems: 'flex-start',
    },
    heroLabel: {
        fontSize: 10,
        color: SLATE_500,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    heroAmount: {
        fontSize: 56,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_ORANGE,
        lineHeight: 1,
        marginBottom: 8,
    },
    heroSub: {
        fontSize: 14,
        color: SLATE_400,
        fontFamily: 'Helvetica',
    },
    
    // ── Section title
    sectionTitle: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 16,
        marginTop: 10,
        letterSpacing: 0.5,
    },

    // ── Intro paragraph
    introText: {
        fontSize: 11,
        color: SLATE_700,
        lineHeight: 1.8,
        marginBottom: 30,
    },
    introHighlight: {
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
    },

    // ── Comparison row (Side by Side minimalist)
    comparisonRow: {
        flexDirection: 'row',
        gap: 30,
        marginBottom: 40,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: SLATE_200,
        paddingVertical: 20,
    },
    comparisonCard: {
        flex: 1,
    },
    comparisonLabel: {
        fontSize: 9,
        color: SLATE_500,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    comparisonAmount: {
        fontSize: 28,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
        marginBottom: 4,
    },
    comparisonAmountGreen: {
        fontSize: 28,
        fontFamily: 'Helvetica-Bold',
        color: EMERALD,
        marginBottom: 4,
    },
    comparisonSub: {
        fontSize: 10,
        color: SLATE_500,
    },

    // ── Offer detail layout (No boxes, just lines)
    offerTable: {
        marginBottom: 40,
        borderTopWidth: 1,
        borderColor: SLATE_900,
    },
    offerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_200,
    },
    offerKey: {
        fontSize: 11,
        color: SLATE_500,
    },
    offerVal: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
    },
    offerValGreen: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: EMERALD,
    },
    offerValOrange: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_ORANGE,
    },

    // ── Opportunity cards (Minimalist)
    oppCard: {
        borderLeftWidth: 2,
        borderLeftColor: BRAND_ORANGE,
        paddingLeft: 16,
        paddingVertical: 4,
        marginBottom: 16,
    },
    oppTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 4,
    },
    oppDesc: {
        fontSize: 10,
        color: SLATE_500,
        lineHeight: 1.6,
    },
    oppSavings: {
        fontSize: 10,
        color: BRAND_ORANGE,
        fontFamily: 'Helvetica-Bold',
        marginTop: 6,
    },

    // ── Sales argument quote (Minimalist Blockquote)
    quoteBox: {
        borderLeftWidth: 2,
        borderLeftColor: BRAND_BLUE,
        paddingLeft: 20,
        marginBottom: 30,
        marginTop: 10,
    },
    quoteText: {
        fontSize: 12,
        color: SLATE_700,
        fontStyle: 'italic',
        lineHeight: 1.8,
    },
    quoteAuthor: {
        fontSize: 9,
        color: SLATE_400,
        fontFamily: 'Helvetica-Bold',
        marginTop: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },

    // ── 5-year projection table (Clean grid)
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: BRAND_BLUE,
        paddingVertical: 10,
        marginBottom: 4,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 9,
        color: BRAND_BLUE,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
    },
    tableCell: {
        flex: 1,
        fontSize: 10,
        color: SLATE_700,
    },
    tableCellBold: {
        flex: 1,
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: EMERALD,
    },

    // ── Trust pillars (Minimalist lists)
    trustRow: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 10,
        marginBottom: 30,
    },
    trustCard: {
        flex: 1,
    },
    trustTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    trustBody: {
        fontSize: 9.5,
        color: SLATE_500,
        lineHeight: 1.6,
    },

    // ── CTA minimalist signature line
    ctaBox: {
        marginTop: 20,
        paddingTop: 30,
        borderTopWidth: 1,
        borderColor: SLATE_200,
    },
    ctaTitle: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 8,
    },
    ctaBody: {
        fontSize: 10,
        color: SLATE_500,
        lineHeight: 1.6,
        maxWidth: 400,
    },

    // ── Footer
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        borderTopWidth: 1,
        borderTopColor: SLATE_200,
        paddingTop: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    footerBrand: {
        fontSize: 8,
        color: SLATE_400,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    footerDisclaimer: {
        fontSize: 8,
        color: SLATE_400,
        maxWidth: 300,
        lineHeight: 1.4,
    },
    pageNumber: {
        fontSize: 8,
        color: SLATE_400,
        fontFamily: 'Helvetica-Bold',
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euro(val: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

function pct(val: number): string {
    return `${val.toFixed(1)}%`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props { proposal: Proposal; }

export const ProposalDocument: React.FC<Props> = ({ proposal }) => {
    const clientName  = proposal.clients?.name ?? 'Cliente';
    const currentCost = proposal.current_annual_cost;
    const newCost     = proposal.offer_annual_cost;
    const savings     = proposal.annual_savings;
    const savingsPct  = proposal.savings_percent;
    const marketer    = proposal.offer_snapshot.marketer_name;
    const tariff      = proposal.offer_snapshot.tariff_name;
    const dateStr     = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const refId       = proposal.id.slice(0, 8).toUpperCase();
    const opps        = proposal.aletheia_summary?.opportunities ?? [];
    const salesArg    = proposal.aletheia_summary?.client_profile?.sales_argument;
    const optSavings  = proposal.optimization_result?.annual_optimization_savings ?? 0;
    const totalSavings = savings + optSavings;

    // 5-year projection
    const projection = [1, 2, 3, 4, 5].map(yr => ({
        year: yr,
        annualSaving: totalSavings,
        accumulated: totalSavings * yr,
    }));

    return (
        <Document title={`Propuesta Zinergia — ${clientName}`} author="Zinergia Consultora">

            {/* ═══════════════════════════════════════════════
                PÁGINA 1 — Portada y resumen ejecutivo
            ═══════════════════════════════════════════════ */}
            <Page size="A4" style={s.page}>

                {/* Header strip */}
                <View style={s.headerStrip}>
                    <View>
                        <Text style={s.logoText}>ZINERGIA</Text>
                        <Text style={s.logoSub}>Consultora Energética</Text>
                    </View>
                    <View style={s.headerMeta}>
                        <Text style={s.headerMetaHighlight}>{clientName}</Text>
                        <Text style={s.headerMetaText}>{dateStr}</Text>
                        <Text style={s.headerMetaText}>Ref. {refId}</Text>
                    </View>
                </View>

                {/* Body */}
                <View style={s.body}>

                    {/* Hero savings (Minimalist) */}
                    <View style={s.heroBlock}>
                        <Text style={s.heroLabel}>Ahorro Potencial Estimado</Text>
                        <Text style={s.heroAmount}>{euro(savings)}</Text>
                        <Text style={s.heroSub}>Lo que equivale a un {pct(savingsPct)} menos en tu factura anual actual.</Text>
                    </View>

                    {/* Intro */}
                    <Text style={s.introText}>
                        Tras analizar minuciosamente tus hábitos de consumo y la estructura de tu tarifa actual,{' '}
                        hemos detectado que <Text style={s.introHighlight}>estás pagando {euro(currentCost)} al año cuando podrías pagar {euro(newCost)}.</Text>
                        {' '}Esa diferencia representa capital inmovilizado que tu empresa podría reasignar a áreas estratégicas.
                    </Text>

                    {/* Comparison before / after */}
                    <View style={s.comparisonRow}>
                        <View style={s.comparisonCard}>
                            <Text style={s.comparisonLabel}>Situación actual (Anual)</Text>
                            <Text style={s.comparisonAmount}>{euro(currentCost)}</Text>
                            <Text style={s.comparisonSub}>Coste proyectado sin optimizar</Text>
                        </View>

                        <View style={s.comparisonCard}>
                            <Text style={s.comparisonLabel}>Con Zinergia (Anual)</Text>
                            <Text style={s.comparisonAmountGreen}>{euro(newCost)}</Text>
                            <Text style={s.comparisonSub}>Coste proyectado optimizado</Text>
                        </View>
                    </View>

                    {/* Offer detail */}
                    <Text style={s.sectionTitle}>Desglose de la Solución</Text>
                    <View style={s.offerTable}>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Tarifa Propuesta</Text>
                            <Text style={s.offerVal}>{marketer} — {tariff}</Text>
                        </View>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Precio Referencia (Energía P1)</Text>
                            <Text style={s.offerVal}>{proposal.offer_snapshot.energy_price?.p1?.toFixed(4) || 'N/A'} €/kWh</Text>
                        </View>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Coste Anual Estimado</Text>
                            <Text style={s.offerValGreen}>{euro(newCost)}</Text>
                        </View>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Ahorro Económico Directo</Text>
                            <Text style={s.offerValOrange}>{euro(savings)} ({pct(savingsPct)})</Text>
                        </View>
                        {optSavings > 0 && (
                            <View style={s.offerRow}>
                                <Text style={s.offerKey}>Ahorro por Ajuste de Potencias</Text>
                                <Text style={s.offerValOrange}>+{euro(optSavings)} / año</Text>
                            </View>
                        )}
                    </View>

                </View>

                {/* Footer p1 */}
                <View style={s.footer} fixed>
                    <Text style={s.footerBrand}>ZINERGIA · Documento Analítico Confidencial</Text>
                    <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>

            </Page>

            {/* ═══════════════════════════════════════════════
                PÁGINA 2 — Análisis, proyección y cierre
            ═══════════════════════════════════════════════ */}
            <Page size="A4" style={s.page}>

                <View style={s.headerStrip}>
                    <View>
                        <Text style={s.logoText}>ZINERGIA</Text>
                        <Text style={s.logoSub}>Consultora Energética</Text>
                    </View>
                    <View style={s.headerMeta}>
                        <Text style={s.headerMetaHighlight}>Proyección Estratégica</Text>
                        <Text style={s.headerMetaText}>Ref. {refId}</Text>
                    </View>
                </View>

                <View style={s.body}>

                    {/* Sales argument */}
                    {salesArg && (
                        <>
                            <View style={s.quoteBox}>
                                <Text style={s.quoteText}>&quot;{salesArg}&quot;</Text>
                                <Text style={s.quoteAuthor}>Auditoría Inteligente Aletheia</Text>
                            </View>
                        </>
                    )}

                    {/* Opportunities */}
                    {opps.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Anomalías y Oportunidades Técnicas</Text>
                            {opps.map((opp, i) => (
                                <View key={i} style={s.oppCard}>
                                    <Text style={s.oppTitle}>{opp.type}</Text>
                                    <Text style={s.oppDesc}>{opp.description}</Text>
                                    <Text style={s.oppSavings}>Impacto a favor: +{euro(opp.annual_savings)} anuales</Text>
                                </View>
                            ))}
                            <View style={{ marginBottom: 30 }} />
                        </>
                    )}

                    {/* 5-year projection */}
                    <Text style={s.sectionTitle}>Horizonte Financiero a 5 Años</Text>
                    <View style={s.tableHeader}>
                        <Text style={s.tableHeaderCell}>Línea de Tiempo</Text>
                        <Text style={s.tableHeaderCell}>Coste Optimizado</Text>
                        <Text style={s.tableHeaderCell}>Retorno Anual</Text>
                        <Text style={s.tableHeaderCell}>Retorno Acumulado</Text>
                    </View>
                    {projection.map((row) => (
                        <View key={row.year} style={s.tableRow}>
                            <Text style={s.tableCell}>Año {row.year}</Text>
                            <Text style={s.tableCell}>{euro(newCost)}</Text>
                            <Text style={s.tableCell}>{euro(row.annualSaving)}</Text>
                            <Text style={s.tableCellBold}>{euro(row.accumulated)}</Text>
                        </View>
                    ))}

                    {/* Trust pillars */}
                    <View style={{ marginTop: 40 }}>
                        <Text style={s.sectionTitle}>Nuestra Propuesta de Valor</Text>
                        <View style={s.trustRow}>
                            <View style={s.trustCard}>
                                <Text style={s.trustTitle}>Independencia</Text>
                                <Text style={s.trustBody}>Sin afiliaciones exclusivas. El mercado dicta la mejor opción objetiva para tu negocio.</Text>
                            </View>
                            <View style={s.trustCard}>
                                <Text style={s.trustTitle}>Auditoría Continua</Text>
                                <Text style={s.trustBody}>Nuestro algoritmo monitoriza constantemente el mercado frente a tu perfil de consumo.</Text>
                            </View>
                            <View style={s.trustCard}>
                                <Text style={s.trustTitle}>Costo Cero</Text>
                                <Text style={s.trustBody}>Nos financiamos íntegramente a través de la red de comercializadoras mayoristas.</Text>
                            </View>
                        </View>
                    </View>

                    {/* CTA */}
                    <View style={s.ctaBox}>
                        <Text style={s.ctaTitle}>Siguiente Paso</Text>
                        <Text style={s.ctaBody}>
                            Esta propuesta es vinculante con el mercado por 30 días. Tu agente asignado iniciará el cambio de contrato en 24 horas tras la firma digital, sin originar interrupciones en el suministro ni costes ocultos.
                        </Text>
                    </View>

                </View>

                {/* Footer p2 */}
                <View style={s.footer} fixed>
                    <Text style={s.footerDisclaimer}>
                        Estimación fundamentada en métricas de consumo histórico provistas. Sujeto a variaciones técnicas regulatorias o de tarifa indexada según perfil horario de la CUR.
                    </Text>
                    <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>

            </Page>
        </Document>
    );
};
