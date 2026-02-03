import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Proposal } from '@/types/crm';

// Register fonts if needed, for now use standard Helvetica
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 40,
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0', // slate-200
        paddingBottom: 20,
    },
    brand: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#059669', // emerald-600
    },
    meta: {
        fontSize: 10,
        color: '#64748b', // slate-500
        textAlign: 'right',
    },
    section: {
        marginBottom: 20,
    },
    card: {
        backgroundColor: '#f8fafc', // slate-50
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
    },
    cardDark: {
        backgroundColor: '#0f172a', // slate-900
        borderRadius: 10,
        padding: 20,
        color: 'white',
        marginBottom: 20,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#334155', // slate-700
    },
    heroSavings: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#34d399', // emerald-400
        marginBottom: 5,
    },
    heroLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        color: '#94a3b8', // slate-400
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    text: {
        fontSize: 11,
        color: '#334155',
        lineHeight: 1.5,
    },
    textLight: {
        fontSize: 11,
        color: '#94a3b8', // slate-400
    },
    opportunity: {
        backgroundColor: '#fffbeb', // amber-50
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b', // amber-500
        padding: 10,
        marginBottom: 10,
    },
    oppTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#92400e', // amber-800
    },
    oppDesc: {
        fontSize: 10,
        color: '#b45309', // amber-700
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        fontSize: 9,
        color: '#cbd5e1',
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    }
});

interface ProposalDocumentProps {
    proposal: Proposal;
}

export const ProposalDocument: React.FC<ProposalDocumentProps> = ({ proposal }) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.brand}>Zinergia</Text>
                        <Text style={{ fontSize: 10, color: '#64748b' }}>Propuesta de Ahorro Energético</Text>
                    </View>
                    <View style={styles.meta}>
                        <Text>Fecha: {new Date().toLocaleDateString('es-ES')}</Text>
                        <Text>Ref: {proposal.id.slice(0, 8)}</Text>
                        <Text>{proposal.clients?.name || 'Cliente'}</Text>
                    </View>
                </View>

                {/* Main Savings Card (Dark Mode in PDF) */}
                <View style={styles.cardDark}>
                    <View style={styles.row}>
                        <View>
                            <Text style={styles.heroLabel}>Ahorro Estimado Anual</Text>
                            <Text style={styles.heroSavings}>{proposal.annual_savings.toFixed(0)}€</Text>
                            <Text style={{ fontSize: 10, color: '#10b981' }}>Reducción del {proposal.savings_percent.toFixed(1)}%</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 10, color: '#94a3b8' }}>Propuesta</Text>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>{proposal.offer_snapshot.marketer_name}</Text>
                            <Text style={{ fontSize: 10, color: '#34d399' }}>Tarifa: {proposal.offer_snapshot.tariff_name}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' }}>
                        <View style={styles.row}>
                            <Text style={styles.textLight}>Coste Actual:</Text>
                            <Text style={{ fontSize: 11, color: '#e2e8f0' }}>{proposal.current_annual_cost.toFixed(0)}€/año</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.textLight}>Nuevo Coste:</Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: 'white' }}>{proposal.offer_annual_cost.toFixed(0)}€/año</Text>
                        </View>
                    </View>
                </View>

                {/* Technical Analysis */}
                <Text style={[styles.title, { marginTop: 20 }]}>Análisis Técnico (Aletheia Engine)</Text>

                {proposal.aletheia_summary?.client_profile?.sales_argument && (
                    <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7', borderWidth: 1 }]}>
                        <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#166534' }}>
                            &quot;{proposal.aletheia_summary.client_profile.sales_argument}&quot;
                        </Text>
                    </View>
                )}

                {proposal.aletheia_summary?.opportunities && proposal.aletheia_summary.opportunities.length > 0 ? (
                    <View>
                        {proposal.aletheia_summary.opportunities.map((opp, i) => (
                            <View key={i} style={styles.opportunity}>
                                <Text style={styles.oppTitle}>Oportunidad: {opp.type}</Text>
                                <Text style={styles.oppDesc}>{opp.description}</Text>
                                <View style={{ flexDirection: 'row', marginTop: 5 }}>
                                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#b45309' }}>Ahorro: +{opp.annual_savings.toFixed(0)}€/año</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                        No se detectaron anomalías críticas en este análisis.
                    </Text>
                )}

                {/* Disclaimer/Footer */}
                <Text style={styles.footer}>
                    Generado por Aletheia Engine para Zinergia Consultora.
                    Este documento es una simulación basada en datos históricos y no constituye una oferta vinculante.
                </Text>

            </Page>
        </Document>
    );
};
