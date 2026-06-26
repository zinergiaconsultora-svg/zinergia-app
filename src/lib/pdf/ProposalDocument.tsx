import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Proposal } from '@/types/crm';
import type { InvoiceSimulationResult } from '@/lib/comparison/invoice-simulator';
import { s, SLATE_500, SLATE_700 } from './proposalPdfStyles';
import { euro, euro2, pct, price, getPdfLogoSource, generateVerificationHash, offerValidityUntil, kw, kwh } from './proposalPdfHelpers';
import { analyzeConsumption } from '@/lib/aletheia/consumptionProfile';
import { crmToAletheiaInvoice } from '@/lib/aletheia/adapter';

const PROFILE_CLASS_LABEL: Record<string, string> = {
    flat: 'Perfil plano',
    moderate: 'Perfil mixto',
    peaky: 'Perfil picudo',
};

// Ventajas mostradas en la explicación de la tarifa, según su tipo.
const TARIFF_ADVANTAGES: Record<'fixed' | 'indexed', { how: string; bullets: string[] }> = {
    fixed: {
        how: 'Pagas un precio cerrado por tu energía durante toda la vigencia del contrato. Sepas o no lo que hará el mercado, tu tarifa no cambia: máxima previsibilidad para tu negocio.',
        bullets: [
            'Precio de la energía fijo — sin sorpresas en los meses de mercado tensionado.',
            'Factura predecible: facilita la previsión de tesorería.',
            'Sin servicios ni mantenimientos ocultos en la factura.',
        ],
    },
    indexed: {
        how: 'Tu energía se paga según el precio real del mercado mayorista (OMIE) hora a hora. En un perfil de consumo adecuado, aprovecha las horas más baratas y reduce el coste medio del kWh.',
        bullets: [
            'Coste medio del kWh más bajo aprovechando las horas valle.',
            'Transparencia total: pagas el precio real del mercado más un margen fijo.',
            'Ideal para consumos con flexibilidad horaria.',
        ],
    },
};

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

    // Perfil de consumo (factor de carga) y estrategia de contratación recomendada.
    // Se calcula desde calculation_data ya persistido; no requiere datos extra.
    const consumption = (() => {
        const cd = proposal.calculation_data;
        if (!cd) return null;
        const aletheiaInvoice = crmToAletheiaInvoice(cd);
        const totalEnergy = Object.values(aletheiaInvoice.energy_consumption).reduce((a, b) => a + (b || 0), 0);
        if (totalEnergy <= 0) return null;
        return analyzeConsumption(aletheiaInvoice);
    })();

    // ── Datos del suministro (desde la factura analizada) ─────────────────────
    const cd = proposal.calculation_data;
    const cups = cd?.cups?.trim();
    const supplyAddress = cd?.supply_address?.trim();
    const currentTariffAccess = cd?.detected_tariff_type || cd?.forensic_details?.tariff_access || tariff;
    const currentMarketer = cd?.company_name?.trim();
    const currentLogo = currentMarketer ? getPdfLogoSource(currentMarketer) : null;
    const powerVals = cd ? [cd.power_p1, cd.power_p2, cd.power_p3, cd.power_p4, cd.power_p5, cd.power_p6] : [];
    const energyVals = cd ? [cd.energy_p1, cd.energy_p2, cd.energy_p3, cd.energy_p4, cd.energy_p5, cd.energy_p6] : [];
    const activePeriods = powerVals.filter(v => (v || 0) > 0).length || 3;

    // ── Ahorro en 3 horizontes ────────────────────────────────────────────────
    const sixMonthSavings = savings / 2;

    // ── Tipo de oferta y ventajas ─────────────────────────────────────────────
    const offerType: 'fixed' | 'indexed' = proposal.offer_snapshot.type === 'indexed' ? 'indexed' : 'fixed';
    const advantages = TARIFF_ADVANTAGES[offerType];
    const contractDuration = proposal.offer_snapshot.contract_duration;

    // ── Validez de la oferta ──────────────────────────────────────────────────
    const validityUntil = offerValidityUntil(proposal.created_at, 15);

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

                    {/* Ahorro en 3 horizontes */}
                    <View style={s.horizonRow}>
                        <View style={s.horizonCard}>
                            <Text style={s.horizonLabel}>En esta factura</Text>
                            <Text style={s.horizonValue}>{euro2(invoiceSavings)}</Text>
                        </View>
                        <View style={s.horizonCard}>
                            <Text style={s.horizonLabel}>A los 6 meses</Text>
                            <Text style={s.horizonValue}>{euro(sixMonthSavings)}</Text>
                        </View>
                        <View style={s.horizonCardHighlight}>
                            <Text style={s.horizonLabel}>En un año</Text>
                            <Text style={s.horizonValueGreen}>{euro(savings)}</Text>
                        </View>
                    </View>

                    {/* Balanza: antes vs después */}
                    <View style={s.balanceRow}>
                        <View style={s.balanceSide}>
                            <Text style={s.balanceLabel}>Ahora pagas (anual)</Text>
                            {currentLogo ? (
                                // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image no expone prop alt.
                                <Image src={currentLogo} style={s.balanceLogo} />
                            ) : (
                                <Text style={s.balanceMarketer}>{currentMarketer || 'Tu comercializadora'}</Text>
                            )}
                            <Text style={s.balanceAmount}>{euro(currentCost)}</Text>
                        </View>
                        <View style={s.balanceCenter}>
                            <Text style={s.balanceArrow}>›</Text>
                        </View>
                        <View style={s.balanceSide}>
                            <Text style={s.balanceLabel}>Con Zinergia (anual)</Text>
                            {logoSource ? (
                                // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image no expone prop alt.
                                <Image src={logoSource} style={s.balanceLogo} />
                            ) : (
                                <Text style={s.balanceMarketer}>{marketer}</Text>
                            )}
                            <Text style={s.balanceAmountGreen}>{euro(newCost)}</Text>
                        </View>
                    </View>
                    <View style={s.balanceSavingsBar}>
                        <Text style={s.balanceSavingsText}>
                            Ahorras {euro(savings)} al año · {pct(savingsPct)} menos
                        </Text>
                    </View>

                    {/* Datos del suministro analizado */}
                    {(cups || supplyAddress) && (
                        <View style={s.supplyBox}>
                            <Text style={s.supplyTitle}>Datos del suministro analizado</Text>
                            <View style={s.supplyGrid}>
                                {cups && (
                                    <View style={s.supplyItem}>
                                        <Text style={s.supplyKey}>CUPS</Text>
                                        <Text style={s.supplyVal}>{cups}</Text>
                                    </View>
                                )}
                                {supplyAddress && (
                                    <View style={s.supplyItem}>
                                        <Text style={s.supplyKey}>Dirección de suministro</Text>
                                        <Text style={s.supplyVal}>{supplyAddress}</Text>
                                    </View>
                                )}
                                <View style={s.supplyItem}>
                                    <Text style={s.supplyKey}>Tarifa de acceso</Text>
                                    <Text style={s.supplyVal}>{currentTariffAccess}</Text>
                                </View>
                                {currentMarketer && (
                                    <View style={s.supplyItem}>
                                        <Text style={s.supplyKey}>Comercializadora actual</Text>
                                        <Text style={s.supplyVal}>{currentMarketer}</Text>
                                    </View>
                                )}
                                <View style={s.supplyItem}>
                                    <Text style={s.supplyKey}>Periodo facturado</Text>
                                    <Text style={s.supplyVal}>{periodDays} días</Text>
                                </View>
                                {powerVals.some(v => (v || 0) > 0) && (
                                    <View style={s.supplyItem}>
                                        <Text style={s.supplyKey}>Potencia contratada</Text>
                                        <Text style={s.supplyVal}>
                                            {powerVals.slice(0, activePeriods).map(v => kw(v)).join(' / ')} kW
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Intro compacto */}
                    <Text style={s.introTextCompact}>
                        Tras analizar tu consumo y la estructura de tu tarifa actual, hemos detectado que{' '}
                        <Text style={s.introHighlight}>estás pagando {euro(currentCost)} al año cuando podrías pagar {euro(newCost)}.</Text>
                    </Text>

                </View>

                {/* Footer p1 */}
                <View style={s.footer} fixed>
                    <Text style={s.footerBrand}>ZINERGIA · Documento Analítico Confidencial</Text>
                    <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>

            </Page>

            {/* ═══════════════════════════════════════════════
                PÁGINA 2 — Comparativa detallada
            ═══════════════════════════════════════════════ */}
            <Page size="A4" style={s.page}>

                <View style={s.headerStrip}>
                    <View>
                        <Text style={s.logoText}>ZINERGIA</Text>
                        <Text style={s.logoSub}>Consultora Energética</Text>
                    </View>
                    <View style={s.headerMeta}>
                        <Text style={s.headerMetaHighlight}>Comparativa Detallada</Text>
                        <Text style={s.headerMetaText}>Ref. {refId}</Text>
                    </View>
                </View>

                <View style={s.body}>

                    <Text style={s.sectionTitle}>Tu factura actual vs. con Zinergia</Text>

                    {/* Comparación enfrentada */}
                    <View style={s.compareWrap}>
                        {/* Columna izquierda: factura actual */}
                        <View style={s.compareCol}>
                            <View style={s.compareColHead}>
                                <Text style={s.compareColTitle}>Tu factura actual</Text>
                                <Text style={s.compareColSub}>{currentMarketer || 'Comercializadora actual'} · {currentTariffAccess}</Text>
                            </View>
                            <View style={s.compareRow}>
                                <Text style={s.compareKey}>Periodo facturado</Text>
                                <Text style={s.compareVal}>{periodDays} días</Text>
                            </View>
                            {powerVals.slice(0, activePeriods).map((v, i) => (
                                <View key={`cp-pow-${i}`} style={s.compareRow}>
                                    <Text style={s.compareKey}>Potencia P{i + 1}</Text>
                                    <Text style={s.compareVal}>{kw(v)} kW</Text>
                                </View>
                            ))}
                            {energyVals.slice(0, activePeriods).map((v, i) => (
                                <View key={`cp-en-${i}`} style={s.compareRow}>
                                    <Text style={s.compareKey}>Energía P{i + 1}</Text>
                                    <Text style={s.compareVal}>{kwh(v)}</Text>
                                </View>
                            ))}
                            <View style={s.compareTotal}>
                                <Text style={s.compareTotalLabel}>Total factura actual</Text>
                                <Text style={s.compareTotalVal}>{euro2(currentInvoiceEstimate)}</Text>
                            </View>
                        </View>

                        {/* Columna derecha: con Zinergia */}
                        <View style={s.compareCol}>
                            <View style={s.compareColHeadGreen}>
                                <Text style={s.compareColTitle}>Con Zinergia</Text>
                                <Text style={s.compareColSub}>{marketer} · {tariff}</Text>
                            </View>
                            {calculationAudit ? (
                                <>
                                    {calculationAudit.lines.filter(line => Math.abs(line.amount) > 0.005).map(line => (
                                        <View key={line.label} style={s.compareRow}>
                                            <Text style={s.compareKey}>{line.label}</Text>
                                            <Text style={s.compareVal}>{euro2(line.amount)}</Text>
                                        </View>
                                    ))}
                                    <View style={s.compareRow}>
                                        <Text style={s.compareKey}>Impuesto eléctrico</Text>
                                        <Text style={s.compareVal}>{euro2(calculationAudit.electricityTax)}</Text>
                                    </View>
                                    <View style={s.compareRow}>
                                        <Text style={s.compareKey}>IVA</Text>
                                        <Text style={s.compareVal}>{euro2(calculationAudit.vat)}</Text>
                                    </View>
                                </>
                            ) : (
                                <View style={s.compareRow}>
                                    <Text style={s.compareKey}>Coste optimizado del periodo</Text>
                                    <Text style={s.compareVal}>{euro2(optimizedInvoiceEstimate)}</Text>
                                </View>
                            )}
                            <View style={s.compareTotalGreen}>
                                <Text style={s.compareTotalLabel}>Total con Zinergia</Text>
                                <Text style={s.compareTotalValGreen}>{euro2(optimizedInvoiceEstimate)}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={{ fontSize: 8, color: SLATE_500, marginBottom: 28 }}>
                        Comparativa sobre el periodo facturado de {periodDays} días, a partir de los datos de tu factura. Estimación sin validez contractual.
                    </Text>

                    {/* Precios de la tarifa propuesta (solo periodos activos) */}
                    <Text style={s.sectionTitle}>Precios de la tarifa propuesta</Text>
                    <View style={[s.priceGrid, { marginBottom: 30 }]}>
                        <View style={s.priceCol}>
                            <Text style={s.priceTitle}>Energía (€/kWh)</Text>
                            {pricePeriods.slice(0, activePeriods).map(period => (
                                <View key={`energy-${period}`} style={s.priceRowCompact}>
                                    <Text style={s.offerKey}>{period.toUpperCase()}</Text>
                                    <Text style={s.offerVal}>{price(proposal.offer_snapshot.energy_price?.[period])}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={s.priceCol}>
                            <Text style={s.priceTitle}>Potencia (€/kW día)</Text>
                            {pricePeriods.slice(0, activePeriods).map(period => (
                                <View key={`power-${period}`} style={s.priceRowCompact}>
                                    <Text style={s.offerKey}>{period.toUpperCase()}</Text>
                                    <Text style={s.offerVal}>{price(proposal.offer_snapshot.power_price?.[period], '€/kW día')}</Text>
                                </View>
                            ))}
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
                PÁGINA 3 — Análisis, tarifa, proyección y cierre
            ═══════════════════════════════════════════════ */}
            <Page size="A4" style={s.page}>

                <View style={s.headerStrip}>
                    <View>
                        <Text style={s.logoText}>ZINERGIA</Text>
                        <Text style={s.logoSub}>Consultora Energética</Text>
                    </View>
                    <View style={s.headerMeta}>
                        <Text style={s.headerMetaHighlight}>Análisis y Proyección</Text>
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

                    {/* Perfil de consumo y estrategia de contratación */}
                    {consumption && (
                        <>
                            <Text style={s.sectionTitle}>Perfil de Consumo y Estrategia de Contratación</Text>
                            <View style={s.offerTable}>
                                <View style={s.offerRow}>
                                    <Text style={s.offerKey}>Factor de carga</Text>
                                    <Text style={s.offerVal}>
                                        {consumption.profile.loadFactorPct}% · {PROFILE_CLASS_LABEL[consumption.profile.classification]}
                                    </Text>
                                </View>
                                <View style={s.offerRow}>
                                    <Text style={s.offerKey}>Demanda pico / media</Text>
                                    <Text style={s.offerVal}>
                                        {consumption.profile.peakKw.toFixed(1)} kW / {consumption.profile.avgKw.toFixed(1)} kW
                                    </Text>
                                </View>
                                <View style={s.offerRow}>
                                    <Text style={s.offerKey}>Estrategia recomendada</Text>
                                    <Text style={s.offerValGreen}>{consumption.strategy.label}</Text>
                                </View>
                            </View>
                            <View style={{ marginTop: 8, marginBottom: 24 }}>
                                {consumption.strategy.rationale.map((reason, i) => (
                                    <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 9, color: SLATE_500, marginRight: 5 }}>•</Text>
                                        <Text style={{ fontSize: 9, color: SLATE_700, flex: 1, lineHeight: 1.4 }}>{reason}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* Explicación de la tarifa propuesta */}
                    <Text style={s.sectionTitle}>Tu nueva tarifa: {tariff}</Text>
                    <Text style={s.tariffHowText}>
                        {advantages.how}
                        {contractDuration ? ` Duración del contrato: ${contractDuration}.` : ''}
                    </Text>
                    <View style={{ marginBottom: 28 }}>
                        {advantages.bullets.map((bullet, i) => (
                            <View key={`adv-${i}`} style={s.advantageRow}>
                                <Text style={s.advantageBullet}>✓</Text>
                                <Text style={s.advantageText}>{bullet}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Opportunities */}
                    {opps.length > 0 && (
                        <>
                            <Text style={s.sectionTitle} break>Anomalías y Oportunidades Técnicas</Text>
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
                    <Text style={s.sectionTitle} break={opps.length === 0}>Horizonte Financiero a 5 Años</Text>
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
                            Oferta válida hasta el {validityUntil}. Tu agente asignado iniciará el cambio de contrato en 24 horas tras la firma digital, sin interrupciones en el suministro ni costes ocultos.
                        </Text>
                    </View>

                </View>

                {/* Footer p3 */}
                <View style={s.footer} fixed>
                    <Text style={s.footerDisclaimer}>
                        Estudio comparativo a partir de los datos de la factura aportada. Estimación sin validez contractual; sujeta a variaciones regulatorias o de tarifa indexada según perfil horario.
                        {'\n'}Oferta válida hasta el {validityUntil} · Verificación: {verificationHash}
                    </Text>
                    <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>

            </Page>
        </Document>
    );
};
