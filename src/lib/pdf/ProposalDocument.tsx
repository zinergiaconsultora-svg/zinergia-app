import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Proposal } from '@/types/crm';

// ─── Brand Tokens ────────────────────────────────────────────────────────────
const BRAND_BLUE   = '#1b2641';
const BRAND_ORANGE = '#ff5722';
const EMERALD      = '#059669';
const SLATE_50     = '#f8fafc';
const SLATE_100    = '#f1f5f9';
const SLATE_200    = '#e2e8f0';
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

    // ── Header strip
    headerStrip: {
        backgroundColor: BRAND_BLUE,
        paddingHorizontal: 40,
        paddingTop: 28,
        paddingBottom: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    logoText: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: WHITE,
        letterSpacing: 1,
    },
    logoSub: {
        fontSize: 8,
        color: BRAND_ORANGE,
        letterSpacing: 2,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    headerMeta: {
        alignItems: 'flex-end',
    },
    headerMetaText: {
        fontSize: 9,
        color: '#94a3b8',
        lineHeight: 1.6,
    },
    headerMetaHighlight: {
        fontSize: 9,
        color: WHITE,
        fontFamily: 'Helvetica-Bold',
    },

    // ── Orange accent bar
    accentBar: {
        height: 3,
        backgroundColor: BRAND_ORANGE,
    },

    // ── Body padding
    body: {
        paddingHorizontal: 40,
        paddingTop: 28,
        paddingBottom: 60,
        flexGrow: 1,
    },

    // ── Hero savings block
    heroBlock: {
        flexDirection: 'row',
        backgroundColor: SLATE_900,
        borderRadius: 12,
        padding: 28,
        marginBottom: 24,
        alignItems: 'center',
    },
    heroLeft: {
        flex: 1,
    },
    heroLabel: {
        fontSize: 8,
        color: '#94a3b8',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    heroAmount: {
        fontSize: 42,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_ORANGE,
        lineHeight: 1,
        marginBottom: 4,
    },
    heroSub: {
        fontSize: 11,
        color: '#34d399',
        fontFamily: 'Helvetica-Bold',
    },
    heroDivider: {
        width: 1,
        backgroundColor: '#334155',
        marginHorizontal: 28,
        alignSelf: 'stretch',
    },
    heroRight: {
        flex: 1,
        alignItems: 'flex-end',
    },
    heroClientLabel: {
        fontSize: 8,
        color: '#94a3b8',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    heroClientName: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        color: WHITE,
        marginBottom: 8,
        textAlign: 'right',
    },
    heroBadge: {
        backgroundColor: '#1e3a5f',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    heroBadgeText: {
        fontSize: 9,
        color: '#7dd3fc',
        fontFamily: 'Helvetica-Bold',
    },

    // ── Section title
    sectionTitle: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 12,
        marginTop: 4,
        letterSpacing: 0.3,
    },

    // ── Intro paragraph
    introText: {
        fontSize: 10.5,
        color: SLATE_700,
        lineHeight: 1.65,
        marginBottom: 20,
    },
    introHighlight: {
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
    },

    // ── Comparison row
    comparisonRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    comparisonCardBefore: {
        flex: 1,
        backgroundColor: SLATE_50,
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: SLATE_200,
    },
    comparisonCardAfter: {
        flex: 1,
        backgroundColor: '#f0fdf4',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    comparisonLabel: {
        fontSize: 8,
        color: SLATE_500,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    comparisonAmount: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
        marginBottom: 3,
    },
    comparisonAmountGreen: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: EMERALD,
        marginBottom: 3,
    },
    comparisonSub: {
        fontSize: 9,
        color: SLATE_500,
    },
    comparisonSubGreen: {
        fontSize: 9,
        color: '#15803d',
        fontFamily: 'Helvetica-Bold',
    },

    // ── Savings arrow badge
    savingsArrow: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    savingsArrowText: {
        fontSize: 18,
        color: BRAND_ORANGE,
    },
    savingsBadge: {
        backgroundColor: BRAND_ORANGE,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginTop: 4,
    },
    savingsBadgeText: {
        fontSize: 9,
        color: WHITE,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
    },

    // ── Offer detail row
    offerBox: {
        backgroundColor: SLATE_50,
        borderRadius: 10,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: SLATE_200,
    },
    offerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
    },
    offerRowLast: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    offerKey: {
        fontSize: 10,
        color: SLATE_500,
    },
    offerVal: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_700,
    },

    // ── Opportunity cards
    oppCard: {
        borderLeftWidth: 3,
        borderLeftColor: BRAND_ORANGE,
        backgroundColor: '#fff7f5',
        borderRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 8,
    },
    oppTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 3,
    },
    oppDesc: {
        fontSize: 9.5,
        color: SLATE_700,
        lineHeight: 1.5,
    },
    oppSavings: {
        fontSize: 9,
        color: BRAND_ORANGE,
        fontFamily: 'Helvetica-Bold',
        marginTop: 4,
    },

    // ── Sales argument quote
    quoteBox: {
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    quoteText: {
        fontSize: 10.5,
        color: '#1e3a5f',
        fontStyle: 'italic',
        lineHeight: 1.65,
    },
    quoteAuthor: {
        fontSize: 8.5,
        color: '#3b82f6',
        fontFamily: 'Helvetica-Bold',
        marginTop: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // ── 5-year projection table
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: BRAND_BLUE,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 2,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 8,
        color: WHITE,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tableRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
    },
    tableRowAlt: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: SLATE_50,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
    },
    tableCell: {
        flex: 1,
        fontSize: 9.5,
        color: SLATE_700,
    },
    tableCellBold: {
        flex: 1,
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        color: EMERALD,
    },

    // ── Trust pillars
    trustRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    trustCard: {
        flex: 1,
        backgroundColor: SLATE_50,
        borderRadius: 8,
        padding: 14,
        borderTopWidth: 2,
        borderTopColor: BRAND_ORANGE,
    },
    trustTitle: {
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 4,
    },
    trustBody: {
        fontSize: 9,
        color: SLATE_500,
        lineHeight: 1.55,
    },

    // ── CTA box
    ctaBox: {
        backgroundColor: BRAND_BLUE,
        borderRadius: 12,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    ctaLeft: {
        flex: 1,
    },
    ctaTitle: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: WHITE,
        marginBottom: 4,
    },
    ctaBody: {
        fontSize: 9.5,
        color: '#94a3b8',
        lineHeight: 1.5,
    },
    ctaBadge: {
        backgroundColor: BRAND_ORANGE,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginLeft: 20,
    },
    ctaBadgeText: {
        fontSize: 10,
        color: WHITE,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
    },

    // ── Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: BRAND_BLUE,
        paddingHorizontal: 40,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerBrand: {
        fontSize: 9,
        color: '#94a3b8',
    },
    footerDisclaimer: {
        fontSize: 8,
        color: '#475569',
        textAlign: 'right',
        maxWidth: 320,
        lineHeight: 1.4,
    },
    pageNumber: {
        fontSize: 8,
        color: '#475569',
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
                        <Text style={s.headerMetaText}>Propuesta de Eficiencia Energética</Text>
                    </View>
                </View>
                <View style={s.accentBar} />

                {/* Body */}
                <View style={s.body}>

                    {/* Hero savings */}
                    <View style={s.heroBlock}>
                        <View style={s.heroLeft}>
                            <Text style={s.heroLabel}>Ahorro Anual Garantizado</Text>
                            <Text style={s.heroAmount}>{euro(savings)}</Text>
                            <Text style={s.heroSub}>↓ {pct(savingsPct)} menos en tu factura</Text>
                        </View>
                        <View style={s.heroDivider} />
                        <View style={s.heroRight}>
                            <Text style={s.heroClientLabel}>Propuesta para</Text>
                            <Text style={s.heroClientName}>{clientName}</Text>
                            <View style={s.heroBadge}>
                                <Text style={s.heroBadgeText}>{marketer} · {tariff}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Intro */}
                    <Text style={s.sectionTitle}>El coste real de no actuar</Text>
                    <Text style={s.introText}>
                        Tras analizar tu factura eléctrica, hemos detectado que{' '}
                        <Text style={s.introHighlight}>
                            estás pagando {euro(currentCost)} al año cuando podrías pagar {euro(newCost)}.
                        </Text>
                        {' '}Eso son {euro(savings)} que se podrían quedar en tu empresa cada año. En cinco años,
                        ese exceso representa más de {euro(savings * 5)} — capital que puedes reinvertir
                        en hacer crecer tu negocio.
                    </Text>

                    {/* Comparison before / after */}
                    <View style={s.comparisonRow}>
                        <View style={s.comparisonCardBefore}>
                            <Text style={s.comparisonLabel}>Situación actual</Text>
                            <Text style={s.comparisonAmount}>{euro(currentCost)}</Text>
                            <Text style={s.comparisonSub}>coste anual estimado</Text>
                            <Text style={{ fontSize: 9, color: '#ef4444', marginTop: 6 }}>
                                ✕ Tarifa sin optimizar
                            </Text>
                        </View>

                        <View style={s.savingsArrow}>
                            <Text style={s.savingsArrowText}>→</Text>
                            <View style={s.savingsBadge}>
                                <Text style={s.savingsBadgeText}>Ahorro{'\n'}{euro(savings)}</Text>
                            </View>
                        </View>

                        <View style={s.comparisonCardAfter}>
                            <Text style={s.comparisonLabel}>Con Zinergia</Text>
                            <Text style={s.comparisonAmountGreen}>{euro(newCost)}</Text>
                            <Text style={s.comparisonSubGreen}>coste anual optimizado</Text>
                            <Text style={{ fontSize: 9, color: EMERALD, marginTop: 6 }}>
                                ✓ {marketer} — {tariff}
                            </Text>
                        </View>
                    </View>

                    {/* Offer detail */}
                    <Text style={s.sectionTitle}>Oferta seleccionada</Text>
                    <View style={s.offerBox}>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Comercializadora</Text>
                            <Text style={s.offerVal}>{marketer}</Text>
                        </View>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Tarifa de acceso</Text>
                            <Text style={s.offerVal}>{tariff}</Text>
                        </View>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Precio energía P1</Text>
                            <Text style={s.offerVal}>{proposal.offer_snapshot.energy_price.p1.toFixed(4)} €/kWh</Text>
                        </View>
                        <View style={s.offerRow}>
                            <Text style={s.offerKey}>Coste anual estimado</Text>
                            <Text style={[s.offerVal, { color: EMERALD }]}>{euro(newCost)}</Text>
                        </View>
                        <View style={s.offerRowLast}>
                            <Text style={s.offerKey}>Ahorro vs. situación actual</Text>
                            <Text style={[s.offerVal, { color: BRAND_ORANGE }]}>{euro(savings)} ({pct(savingsPct)})</Text>
                        </View>
                    </View>

                    {optSavings > 0 && (
                        <>
                            <View style={s.offerBox}>
                                <View style={s.offerRowLast}>
                                    <Text style={s.offerKey}>+ Optimización de potencias contratadas</Text>
                                    <Text style={[s.offerVal, { color: BRAND_ORANGE }]}>+{euro(optSavings)}/año adicionales</Text>
                                </View>
                            </View>
                        </>
                    )}

                </View>

                {/* Footer p1 */}
                <View style={s.footer} fixed>
                    <Text style={s.footerBrand}>ZINERGIA · Consultora Energética Independiente</Text>
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
                        <Text style={s.headerMetaHighlight}>Análisis Detallado · {clientName}</Text>
                        <Text style={s.headerMetaText}>Ref. {refId}</Text>
                    </View>
                </View>
                <View style={s.accentBar} />

                <View style={s.body}>

                    {/* Sales argument */}
                    {salesArg && (
                        <>
                            <Text style={s.sectionTitle}>Diagnóstico energético</Text>
                            <View style={s.quoteBox}>
                                <Text style={s.quoteText}>"{salesArg}"</Text>
                                <Text style={s.quoteAuthor}>— Análisis Aletheia · Motor de IA de Zinergia</Text>
                            </View>
                        </>
                    )}

                    {/* Opportunities */}
                    {opps.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Oportunidades de ahorro detectadas</Text>
                            {opps.map((opp, i) => (
                                <View key={i} style={s.oppCard}>
                                    <Text style={s.oppTitle}>{opp.type}</Text>
                                    <Text style={s.oppDesc}>{opp.description}</Text>
                                    <Text style={s.oppSavings}>Ahorro potencial: +{euro(opp.annual_savings)}/año</Text>
                                </View>
                            ))}
                        </>
                    )}

                    {/* 5-year projection */}
                    <Text style={[s.sectionTitle, { marginTop: opps.length > 0 ? 16 : 0 }]}>
                        Proyección de ahorro a 5 años
                    </Text>
                    <View style={s.tableHeader}>
                        <Text style={s.tableHeaderCell}>Año</Text>
                        <Text style={s.tableHeaderCell}>Coste optimizado</Text>
                        <Text style={s.tableHeaderCell}>Ahorro anual</Text>
                        <Text style={s.tableHeaderCell}>Ahorro acumulado</Text>
                    </View>
                    {projection.map((row, i) => (
                        <View key={row.year} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                            <Text style={s.tableCell}>Año {row.year}</Text>
                            <Text style={s.tableCell}>{euro(newCost)}</Text>
                            <Text style={s.tableCell}>{euro(row.annualSaving)}</Text>
                            <Text style={s.tableCellBold}>{euro(row.accumulated)}</Text>
                        </View>
                    ))}

                    {/* Trust pillars */}
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>Por qué confiar en Zinergia</Text>
                    <View style={s.trustRow}>
                        <View style={s.trustCard}>
                            <Text style={s.trustTitle}>Independencia total</Text>
                            <Text style={s.trustBody}>
                                No somos distribuidores de ninguna comercializadora.
                                Analizamos el mercado completo y seleccionamos la mejor opción real para cada cliente.
                            </Text>
                        </View>
                        <View style={s.trustCard}>
                            <Text style={s.trustTitle}>Metodología Aletheia</Text>
                            <Text style={s.trustBody}>
                                Nuestro motor de IA cruza tu consumo real con más de 200 tarifas activas
                                en el mercado para garantizar el ahorro óptimo.
                            </Text>
                        </View>
                        <View style={s.trustCard}>
                            <Text style={s.trustTitle}>Sin coste para ti</Text>
                            <Text style={s.trustBody}>
                                El servicio de Zinergia es gratuito para el cliente. Nos financiamos
                                a través de las comercializadoras, sin incrementar tu coste final.
                            </Text>
                        </View>
                    </View>

                    {/* CTA */}
                    <View style={s.ctaBox}>
                        <View style={s.ctaLeft}>
                            <Text style={s.ctaTitle}>¿Listo para empezar a ahorrar?</Text>
                            <Text style={s.ctaBody}>
                                Esta propuesta tiene validez de 30 días. El proceso de cambio es
                                completamente gestionado por Zinergia — sin interrupciones en tu suministro.
                            </Text>
                        </View>
                        <View style={s.ctaBadge}>
                            <Text style={s.ctaBadgeText}>Activar{'\n'}propuesta</Text>
                        </View>
                    </View>

                </View>

                {/* Footer p2 */}
                <View style={s.footer} fixed>
                    <Text style={s.footerDisclaimer}>
                        Propuesta basada en análisis de consumo histórico. Los ahorros indicados son estimaciones
                        sujetas a variaciones de mercado. No constituye oferta vinculante.
                    </Text>
                    <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>

            </Page>
        </Document>
    );
};
