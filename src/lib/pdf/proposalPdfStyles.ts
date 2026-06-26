import { StyleSheet } from '@react-pdf/renderer';

// ─── Minimalist Brand Tokens ────────────────────────────────────────────────
export const BRAND_BLUE   = '#1b2641';
export const BRAND_ORANGE = '#ff5722';
export const EMERALD      = '#059669';
export const EMERALD_TINT = '#ecfdf5';
export const SLATE_100    = '#f1f5f9';
export const SLATE_200    = '#e2e8f0';
export const SLATE_400    = '#94a3b8';
export const SLATE_500    = '#64748b';
export const SLATE_700    = '#334155';
export const SLATE_900    = '#0f172a';
export const WHITE        = '#ffffff';

export const s = StyleSheet.create({
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
    introTextCompact: {
        fontSize: 10,
        color: SLATE_700,
        lineHeight: 1.6,
        marginTop: 4,
    },
    priceRowCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
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
    marketerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    marketerLogo: {
        width: 82,
        height: 34,
        objectFit: 'contain',
    },
    simulationBox: {
        borderWidth: 1,
        borderColor: SLATE_200,
        borderRadius: 8,
        padding: 14,
        marginBottom: 30,
    },
    simulationCards: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    simulationCard: {
        flex: 1,
        backgroundColor: SLATE_100,
        borderRadius: 6,
        padding: 10,
    },
    simulationLabel: {
        fontSize: 7,
        color: SLATE_500,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    simulationValue: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
    },
    simulationValueGreen: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: EMERALD,
    },
    priceGrid: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 8,
    },
    priceCol: {
        flex: 1,
    },
    priceTitle: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: BRAND_BLUE,
        marginBottom: 6,
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

    // ── Ahorro en 3 horizontes
    horizonRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
    horizonCard: { flex: 1, borderWidth: 1, borderColor: SLATE_200, borderRadius: 8, padding: 12, alignItems: 'center' },
    horizonCardHighlight: { flex: 1, backgroundColor: EMERALD_TINT, borderWidth: 1, borderColor: EMERALD, borderRadius: 8, padding: 12, alignItems: 'center' },
    horizonLabel: { fontSize: 8, color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, textAlign: 'center' },
    horizonValue: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    horizonValueGreen: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: EMERALD },

    // ── Balanza antes / después
    balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: SLATE_200, borderRadius: 10, paddingVertical: 18, paddingHorizontal: 16, marginBottom: 10 },
    balanceSide: { flex: 1, alignItems: 'center' },
    balanceLabel: { fontSize: 8, color: SLATE_500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    balanceLogo: { width: 70, height: 24, objectFit: 'contain', marginBottom: 8 },
    balanceMarketer: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: SLATE_700, marginBottom: 8, textAlign: 'center' },
    balanceAmount: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    balanceAmountGreen: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: EMERALD },
    balanceCenter: { width: 40, alignItems: 'center' },
    balanceArrow: { fontSize: 18, color: BRAND_ORANGE, fontFamily: 'Helvetica-Bold' },
    balanceSavingsBar: { backgroundColor: EMERALD, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', marginBottom: 30 },
    balanceSavingsText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },

    // ── Datos de suministro
    supplyBox: { backgroundColor: SLATE_100, borderRadius: 8, padding: 14, marginBottom: 30 },
    supplyTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND_BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    supplyGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    supplyItem: { width: '50%', marginBottom: 10, paddingRight: 8 },
    supplyKey: { fontSize: 7.5, color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    supplyVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: SLATE_900 },

    // ── Comparación enfrentada (dos columnas)
    compareWrap: { flexDirection: 'row', gap: 14, marginBottom: 16 },
    compareCol: { flex: 1, borderWidth: 1, borderColor: SLATE_200, borderRadius: 8 },
    compareColHead: { backgroundColor: SLATE_100, paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    compareColHeadGreen: { backgroundColor: EMERALD_TINT, paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    compareColTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND_BLUE },
    compareColSub: { fontSize: 7.5, color: SLATE_500, marginTop: 2 },
    compareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: SLATE_100 },
    compareKey: { fontSize: 8.5, color: SLATE_500, flex: 1 },
    compareVal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: SLATE_700 },
    compareTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: SLATE_100, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    compareTotalGreen: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: EMERALD_TINT, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    compareTotalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: SLATE_700 },
    compareTotalVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    compareTotalValGreen: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: EMERALD },

    // ── Explicación de la tarifa
    tariffHowText: { fontSize: 10, color: SLATE_500, lineHeight: 1.7, marginBottom: 14 },
    advantageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    advantageBullet: { fontSize: 10, color: EMERALD, fontFamily: 'Helvetica-Bold', marginRight: 8 },
    advantageText: { fontSize: 10, color: SLATE_700, flex: 1, lineHeight: 1.5 },
});
