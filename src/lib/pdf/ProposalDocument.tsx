import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Proposal } from '@/types/crm';
import type { InvoiceSimulationResult } from '@/lib/comparison/invoice-simulator';
import { s, SLATE_500 } from './proposalPdfStyles';
import { euro, euro2, pct, price, getPdfLogoSource, generateVerificationHash } from './proposalPdfHelpers';

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
    const periodDays = Math.max(1, proposal.calculation_data?.period_days || 30);
    const calculationAudit = (proposal.calculation_data as Proposal['calculation_data'] & {
        calculation_audit?: InvoiceSimulationResult;
    })?.calculation_audit;
    const currentInvoiceEstimate = calculationAudit?.currentInvoiceTotal ?? (currentCost / 365) * periodDays;
    const optimizedInvoiceEstimate = calculationAudit?.simulatedInvoiceTotal ?? (newCost / 365) * periodDays;
    const invoiceSavings = calculationAudit?.periodSavings ?? (currentInvoiceEstimate - optimizedInvoiceEstimate);
    const logoSource = getPdfLogoSource(marketer, proposal.offer_snapshot.logo_url);
    const pricePeriods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
    const verificationHash = generateVerificationHash(proposal.id, savings, currentCost);

    // 5-year projection
    const projection = [1, 2, 3, 4, 5].map(yr => ({
        year: yr,
        annualSaving: totalSavings,
        accumulated: totalSavings * yr,
    }));

    return (
        <Document
            title={`Propuesta Zinergia — ${clientName}`}
            author="Zinergia Consultora"
            subject={`Ahorro estimado: ${euro(savings)}/año — ${marketer} ${tariff}`}
            keywords={`zinergia, propuesta, ${clientName}, ${marketer}, ahorro energético`}
            creator="Zinergia CRM"
            producer="Zinergia CRM v2"
        >

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

                    {/* Supervised invoice simulation */}
                    <Text style={s.sectionTitle}>Simulación de Factura Optimizada</Text>
                    <View style={s.simulationBox}>
                        <View style={s.marketerHeader}>
                            <View>
                                <Text style={s.offerVal}>{marketer} — {tariff}</Text>
                                <Text style={{ fontSize: 8, color: SLATE_500, marginTop: 4 }}>Período simulado: {periodDays} días</Text>
                            </View>
                            {logoSource && (
                                // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image no expone prop alt.
                                <Image src={logoSource} style={s.marketerLogo} />
                            )}
                        </View>

                        <View style={s.simulationCards}>
                            <View style={s.simulationCard}>
                                <Text style={s.simulationLabel}>Factura actual</Text>
                                <Text style={s.simulationValue}>{euro2(currentInvoiceEstimate)}</Text>
                            </View>
                            <View style={s.simulationCard}>
                                <Text style={s.simulationLabel}>Factura optimizada</Text>
                                <Text style={s.simulationValue}>{euro2(optimizedInvoiceEstimate)}</Text>
                            </View>
                            <View style={s.simulationCard}>
                                <Text style={s.simulationLabel}>Ahorro factura</Text>
                                <Text style={s.simulationValueGreen}>{euro2(invoiceSavings)} · {pct(savingsPct)}</Text>
                            </View>
                            <View style={s.simulationCard}>
                                <Text style={s.simulationLabel}>Ahorro anual</Text>
                                <Text style={s.simulationValueGreen}>{euro2(savings)}</Text>
                            </View>
                        </View>

                        {calculationAudit && (
                            <View style={{ marginBottom: 10 }}>
                                {calculationAudit.lines.filter(line => Math.abs(line.amount) > 0.005).map(line => (
                                    <View key={line.label} style={s.offerRow}>
                                        <Text style={s.offerKey}>{line.label}</Text>
                                        <Text style={s.offerVal}>{euro2(line.amount)}</Text>
                                    </View>
                                ))}
                                <View style={s.offerRow}>
                                    <Text style={s.offerKey}>Subtotal antes de impuesto eléctrico</Text>
                                    <Text style={s.offerVal}>{euro2(calculationAudit.subtotalBeforeTax)}</Text>
                                </View>
                                <View style={s.offerRow}>
                                    <Text style={s.offerKey}>Impuesto eléctrico</Text>
                                    <Text style={s.offerVal}>{euro2(calculationAudit.electricityTax)}</Text>
                                </View>
                                <View style={s.offerRow}>
                                    <Text style={s.offerKey}>IVA</Text>
                                    <Text style={s.offerVal}>{euro2(calculationAudit.vat)}</Text>
                                </View>
                            </View>
                        )}

                        <View style={s.priceGrid}>
                            <View style={s.priceCol}>
                                <Text style={s.priceTitle}>Precios nuevos energía</Text>
                                {pricePeriods.map(period => (
                                    <View key={`energy-${period}`} style={s.offerRow}>
                                        <Text style={s.offerKey}>{period.toUpperCase()}</Text>
                                        <Text style={s.offerVal}>{price(proposal.offer_snapshot.energy_price?.[period])}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={s.priceCol}>
                                <Text style={s.priceTitle}>Precios nuevos potencia</Text>
                                {pricePeriods.map(period => (
                                    <View key={`power-${period}`} style={s.offerRow}>
                                        <Text style={s.offerKey}>{period.toUpperCase()}</Text>
                                        <Text style={s.offerVal}>{price(proposal.offer_snapshot.power_price?.[period], '€/kW día')}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>

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
                        {'\n'}Verificación: {verificationHash}
                    </Text>
                    <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>

            </Page>
        </Document>
    );
};
