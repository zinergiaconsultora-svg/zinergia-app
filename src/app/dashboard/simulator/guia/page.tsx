'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Upload, Brain, CheckCircle2, Zap, FileText,
    BarChart2, AlertTriangle, Share2, Download, Layers,
    ChevronDown, ChevronRight, Eye, Shield, ScanSearch,
    TrendingDown, Lightbulb, Target, Clock, Star,
    MessageCircle, Building2, PenLine, BookOpen, HelpCircle,
    Sparkles, Timer, ArrowRight, Trophy,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionStep {
    icon: React.ElementType;
    title: string;
    desc: string;
}

interface Section {
    id: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    accent: string;
    ring: string;
    title: string;
    badge?: string;
    tldr: string;
    intro: string;
    steps?: SectionStep[];
    tips?: string[];
    note?: string;
}

interface FaqItem {
    q: string;
    a: string;
}

// ── Section data ──────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
    {
        id: 'subida',
        icon: Upload,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        accent: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        title: 'Cómo subir una factura',
        badge: 'Paso 1',
        tldr: 'Arrastra un PDF nativo y espera entre 10 y 60 s al OCR.',
        intro: 'El punto de partida del simulador es la carga de la factura eléctrica en formato PDF. Puedes hacerlo de dos maneras: arrastrando el archivo directamente sobre la zona marcada, o haciendo clic en ella para abrir el explorador. Solo se aceptan PDFs — no imágenes escaneadas sin capa de texto, ya que el motor OCR necesita texto extraíble.',
        steps: [
            { icon: Upload, title: 'Arrastra o selecciona', desc: 'Suelta el PDF directamente en la zona de carga o haz clic para buscarlo en tu dispositivo.' },
            { icon: Brain, title: 'Procesamiento IA', desc: 'El motor OCR analiza el documento automáticamente. Puede tardar entre 10 y 60 segundos según la complejidad de la factura.' },
            { icon: CheckCircle2, title: 'Revisión de datos', desc: 'En cuanto el proceso termina, aparece el formulario de revisión con todos los campos extraídos pre-rellenados.' },
        ],
        tips: [
            'Los PDFs nativos (generados digitalmente, no escaneados) ofrecen los mejores resultados.',
            'Si la factura contiene varias páginas, el motor analiza todas automáticamente.',
            'Si el servicio tarda más de un minuto, aparece una advertencia. Espera hasta 5 minutos antes de reintentar.',
        ],
        note: 'Si recibes un error de timeout, generalmente basta con esperar 30 segundos y volver a intentarlo — el servicio OCR puede estar arrancando en frío.',
    },
    {
        id: 'lote',
        icon: Layers,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50 border-indigo-200',
        accent: 'bg-indigo-500',
        ring: 'ring-indigo-500/30',
        title: 'Modo lote: varias a la vez',
        badge: 'Productividad',
        tldr: 'Procesa hasta 20 facturas en paralelo con 2 workers simultáneos.',
        intro: 'Si necesitas procesar facturas de múltiples clientes de forma eficiente, el modo lote te permite subir hasta 20 PDFs simultáneamente. El sistema los procesa en paralelo (máximo 2 a la vez) y muestra el estado de cada uno en tiempo real. Cuando una factura termina, aparece el botón "Simular" para lanzar directamente la comparativa.',
        steps: [
            { icon: Layers, title: 'Activar modo lote', desc: 'Haz clic en "Procesar varias facturas a la vez" encima del área de carga individual.' },
            { icon: Upload, title: 'Seleccionar múltiples PDFs', desc: 'Arrastra varios archivos de golpe o usa el selector con selección múltiple (Ctrl+clic o Cmd+clic).' },
            { icon: Zap, title: 'Simular al finalizar', desc: 'Cuando una factura esté lista, pulsa "Simular" en su fila para pasar directamente al análisis de tarifas.' },
        ],
        tips: [
            'Máximo 20 facturas por lote. Si necesitas más, crea varios lotes consecutivos.',
            'Las facturas con error pueden reintentarse eliminándolas de la cola y volviéndolas a añadir.',
            'Puedes limpiar las filas completadas o fallidas con "Limpiar finalizados" para mantener la vista ordenada.',
        ],
    },
    {
        id: 'revision',
        icon: ScanSearch,
        color: 'text-blue-600',
        bg: 'bg-blue-50 border-blue-200',
        accent: 'bg-blue-500',
        ring: 'ring-blue-500/30',
        title: 'Revisión y verificación OCR',
        badge: 'Paso 2',
        tldr: 'Verifica los campos con puntos amarillos o rojos antes de comparar.',
        intro: 'Tras la extracción, el simulador presenta un formulario completo con todos los datos obtenidos. Cada campo tiene un indicador de confianza que refleja la certeza del motor sobre ese dato. Los campos con baja confianza aparecen marcados en ámbar — es importante revisarlos antes de continuar. Puedes editar cualquier valor directamente.',
        steps: [
            { icon: Eye, title: 'Indicadores de confianza', desc: 'Los puntos de color junto a cada campo indican el nivel de certeza: verde (alta), ámbar (media), rojo (baja). Los campos en rojo o ámbar deben verificarse.' },
            { icon: FileText, title: 'Visor PDF integrado', desc: 'Si has subido el PDF, el visor aparece junto al formulario. Haz clic en el icono de lupa de cada campo para resaltarlo directamente en el documento.' },
            { icon: PenLine, title: 'Corrección manual', desc: 'Edita cualquier campo directamente. Las correcciones que realices mejoran el modelo OCR para futuras facturas de la misma comercializadora.' },
        ],
        tips: [
            'El panel de confianza dentro del visor PDF muestra todos los campos ordenados por certeza.',
            'Los campos con badge ámbar de "historial" indican que ese campo ha sido corregido antes en facturas similares.',
            'La etiqueta "IA" en la tarjeta de tarifa indica detección automática. Puedes cambiarla con el botón "Cambiar".',
        ],
        note: 'Si el visor PDF no carga correctamente, usa el icono de ojo para ocultarlo y trabajar solo con el formulario.',
    },
    {
        id: 'confirmacion',
        icon: Shield,
        color: 'text-violet-600',
        bg: 'bg-violet-50 border-violet-200',
        accent: 'bg-violet-500',
        ring: 'ring-violet-500/30',
        title: 'Confirmación de datos OCR',
        badge: 'Mejora continua',
        tldr: 'Confirma para entrenar el modelo y mejorar extracciones futuras.',
        intro: 'El botón "Confirmar datos OCR" es una herramienta clave para mejorar progresivamente la precisión del sistema. Cuando confirmas, el sistema registra los datos actuales (incluyendo correcciones) como un ejemplo de entrenamiento validado. Esto permite que las siguientes facturas de la misma comercializadora se extraigan con mayor precisión.',
        steps: [
            { icon: CheckCircle2, title: 'Revisar campos corregidos', desc: 'Antes de confirmar, asegúrate de haber verificado todos los campos con baja confianza y corregido los incorrectos.' },
            { icon: Shield, title: 'Pulsar Confirmar', desc: 'El sistema detecta automáticamente qué campos has cambiado respecto al original OCR y guarda únicamente las diferencias como correcciones.' },
            { icon: Brain, title: 'Aprendizaje automático', desc: 'El número de campos corregidos se muestra tras confirmar. Con el tiempo, el sistema aprende los patrones de cada comercializadora.' },
        ],
        tips: [
            'Si no has cambiado nada, confirmar igualmente es útil — marca la extracción como "validada por un humano".',
            'El sistema recuerda correcciones pasadas y puede sugerirte aplicarlas automáticamente en futuras facturas.',
        ],
    },
    {
        id: 'comparativa',
        icon: BarChart2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        accent: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        title: 'Comparativa de tarifas',
        badge: 'Análisis',
        tldr: 'Lanza el análisis contra todas las ofertas del mercado en 3-10 s.',
        intro: 'El núcleo del simulador: con todos los datos verificados, "Comparar tarifas" lanza un análisis exhaustivo contra todas las ofertas disponibles del mercado. El sistema calcula el coste anual proyectado con cada tarifa, identifica la opción más rentable y genera recomendaciones personalizadas basadas en el perfil de consumo.',
        steps: [
            { icon: Zap, title: 'Lanzar la comparativa', desc: 'Pulsa el botón verde "Comparar tarifas" al final del formulario. El análisis tarda entre 3 y 10 segundos.' },
            { icon: BarChart2, title: 'Revisar los resultados', desc: 'Los resultados se ordenan de mayor a menor ahorro potencial. La primera oferta siempre es la más ventajosa.' },
            { icon: TrendingDown, title: 'Ahorro proyectado', desc: 'Cada oferta muestra el ahorro anual estimado en euros y porcentaje, extrapolando el consumo del período a 12 meses.' },
        ],
        tips: [
            'El tipo de tarifa (2.0TD, 3.0TD, 3.1TD) se detecta automáticamente, pero puedes cambiarlo manualmente.',
            'El botón de comparación está desactivado si faltan datos críticos como el CUPS o los valores de consumo.',
            'Los resultados solo incluyen tarifas eléctricas del tipo correcto — no se mezclan tensiones diferentes.',
        ],
        note: 'Si el período facturado es inusualmente corto o largo, el sistema te avisa. En ese caso, los ahorros proyectados pueden no ser representativos.',
    },
    {
        id: 'anomalias',
        icon: AlertTriangle,
        color: 'text-amber-600',
        bg: 'bg-amber-50 border-amber-200',
        accent: 'bg-amber-500',
        ring: 'ring-amber-500/30',
        title: 'Detección de anomalías',
        badge: 'Auditoría',
        tldr: 'Tres niveles de alerta: crítica, advertencia e informativa.',
        intro: 'Antes de mostrar los resultados, el simulador analiza la factura en busca de irregularidades que podrían estar influyendo negativamente en el coste. Las anomalías se clasifican en tres niveles: crítico (acción inmediata), atención (conviene revisar) e informativo (dato relevante a tener en cuenta).',
        steps: [
            { icon: AlertTriangle, title: 'Anomalías críticas', desc: 'Penalizaciones por energía reactiva o precios muy por encima del mercado. Representan oportunidades de ahorro inmediato más allá del cambio de tarifa.' },
            { icon: Clock, title: 'Advertencias', desc: 'Potencia sobredimensionada, períodos anómalos o costes elevados por kW. Situaciones que merece la pena investigar con el cliente.' },
            { icon: BarChart2, title: 'Contexto histórico', desc: 'Si hay facturas previas del mismo CUPS, las anomalías incluyen comparativas: "2.3× por encima de tu media histórica".' },
        ],
        tips: [
            'Las anomalías críticas son el argumento de venta más potente — pueden suponer ahorros de 300–800€/año extra.',
            'La energía reactiva requiere instalación de batería de condensadores. Es una oportunidad de negocio adicional.',
            'Si el cliente tiene una tarifa indexada (PVPC), es normal ver precios altos en ciertas facturas.',
        ],
    },
    {
        id: 'resultados',
        icon: Star,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        accent: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        title: 'Cómo leer los resultados',
        badge: 'Paso 3',
        tldr: 'Ranking, recomendaciones Aletheia y score de oportunidad 0-100.',
        intro: 'La pantalla de resultados es el informe completo del análisis. Presenta las mejores tarifas ordenadas por ahorro, las recomendaciones de optimización del sistema Aletheia, las oportunidades detectadas en el perfil del cliente, y las anomalías de la factura. Todo junto forma una propuesta comercial completa.',
        steps: [
            { icon: TrendingDown, title: 'Ranking de tarifas', desc: 'Cada tarjeta muestra la comercializadora, el coste anual proyectado, el ahorro en euros y porcentaje. La primera es siempre la más rentable.' },
            { icon: Lightbulb, title: 'Recomendaciones Aletheia', desc: 'El sistema de IA analiza el perfil de consumo y genera recomendaciones específicas: cambiar de tarifa horaria, reducir potencia, instalar autoconsumo.' },
            { icon: Target, title: 'Perfil de oportunidad', desc: 'Una puntuación de 0 a 100 que evalúa el potencial de ahorro del cliente. Cuanto más alta, más urgente la conversación comercial.' },
        ],
        tips: [
            'El ahorro mostrado es una estimación basada en UN período. Para clientes estacionales, puede variar.',
            'Los resultados incluyen solo las mejores ofertas. El CSV exportado contiene el listado completo.',
            'Si el cliente tiene contrato con penalización por salida anticipada, inclúyelo en la conversación.',
        ],
    },
    {
        id: 'exportar',
        icon: Download,
        color: 'text-slate-600',
        bg: 'bg-slate-50 border-slate-200',
        accent: 'bg-slate-500',
        ring: 'ring-slate-500/30',
        title: 'Exportar e informes',
        badge: 'Documentación',
        tldr: 'PDF para el cliente, CSV para análisis y auditoría interna.',
        intro: 'Una vez tienes los resultados, el simulador ofrece dos formatos de exportación para documentar y presentar el análisis. La propuesta PDF es el documento listo para enviar al cliente. El CSV contiene todos los datos del análisis en formato tabular, ideal para incluir en sistemas de gestión o análisis adicional.',
        steps: [
            { icon: FileText, title: 'Propuesta PDF', desc: 'Genera automáticamente un documento profesional con el resumen, las mejores ofertas y el ahorro proyectado. Listo para enviar por correo.' },
            { icon: Download, title: 'CSV completo', desc: 'Exporta los datos de la factura, el consumo por períodos, la potencia contratada y la comparativa completa. Incluye BOM UTF-8 para Excel.' },
        ],
        tips: [
            'El PDF se genera capturando el informe en pantalla — asegúrate de que todos los datos estén correctos antes.',
            'El CSV incluye todos los datos aunque no se muestren en pantalla, útil para auditorías o reportes internos.',
        ],
    },
    {
        id: 'compartir',
        icon: Share2,
        color: 'text-violet-600',
        bg: 'bg-violet-50 border-violet-200',
        accent: 'bg-violet-500',
        ring: 'ring-violet-500/30',
        title: 'Compartir la propuesta',
        badge: 'Colaboración',
        tldr: 'Enlace público temporal enviado por WhatsApp, email o copiado.',
        intro: 'Si la propuesta se ha guardado en el CRM, puedes generar un enlace público temporal para que el cliente pueda verla directamente desde su navegador sin necesidad de cuenta. El enlace tiene caducidad y puede compartirse por WhatsApp, email o copiarse para incluirlo en cualquier mensaje.',
        steps: [
            { icon: Building2, title: 'Guardar primero en CRM', desc: 'Pulsa "Guardar en CRM" para que la propuesta quede registrada. Solo las propuestas guardadas pueden compartirse.' },
            { icon: Share2, title: 'Abrir menú de compartir', desc: 'Aparece el botón violeta "Compartir" junto a los controles de exportación. Haz clic para ver las opciones.' },
            { icon: MessageCircle, title: 'Elegir canal', desc: 'WhatsApp abre la app con el mensaje pre-redactado. Email abre tu cliente de correo. "Copiar enlace" guarda la URL.' },
        ],
        tips: [
            'El enlace se genera una sola vez y se reutiliza si vuelves a compartir en la misma sesión.',
            'Los enlaces públicos caducan automáticamente — consulta con tu administrador el período configurado.',
            'El mensaje de WhatsApp incluye el nombre del cliente y el ahorro máximo detectado, personalizado.',
        ],
    },
    {
        id: 'crm',
        icon: Building2,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50 border-indigo-200',
        accent: 'bg-indigo-500',
        ring: 'ring-indigo-500/30',
        title: 'Integración con el CRM',
        badge: 'Gestión',
        tldr: 'Vinculación automática por CUPS e historial de simulaciones.',
        intro: 'El simulador está conectado con el módulo CRM de Zinergia. Cuando el CUPS de una factura coincide con un cliente registrado, aparece un banner de vinculación. Guardando la propuesta, se registra una simulación en el historial del cliente, lo que permite hacer seguimiento de las comparativas y propuestas enviadas.',
        steps: [
            { icon: CheckCircle2, title: 'Vinculación por CUPS', desc: 'Si el CUPS del punto de suministro corresponde a un cliente existente, aparece un banner amarillo con su nombre.' },
            { icon: Building2, title: 'Guardar propuesta', desc: 'El botón "Guardar en CRM" registra los datos de la factura, los resultados y las recomendaciones en el historial.' },
            { icon: BarChart2, title: 'Historial de simulaciones', desc: 'Desde la ficha del cliente puedes ver todas las simulaciones realizadas, los ahorros estimados y el estado de las propuestas.' },
        ],
        tips: [
            'Si el cliente no está registrado aún, el CRM te da la opción de crearlo directamente desde los resultados.',
            'El historial de facturas previas aparece como sparkline en el formulario, permitiéndote detectar tendencias.',
        ],
    },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS: FaqItem[] = [
    {
        q: '¿Qué pasa si el PDF es un escaneo?',
        a: 'El motor OCR funciona mejor con PDFs nativos (generados digitalmente). Si la factura es un escaneo sin capa de texto, la extracción puede fallar o devolver campos con confianza muy baja. En ese caso, lo ideal es pedir al cliente la factura original descargada desde su área privada. Si no es posible, revisa manualmente todos los campos y corrige los errores antes de comparar.',
    },
    {
        q: '¿Por qué el botón "Comparar" está desactivado?',
        a: 'El botón requiere que los campos críticos estén completos: CUPS, tipo de tarifa (2.0TD, 3.0TD, 3.1TD), consumo por períodos y potencia contratada. Si alguno falta o tiene formato inválido, el botón permanece gris. Pasa el cursor por encima para ver qué dato exacto falta. Rellena el campo manualmente y el botón se activará automáticamente.',
    },
    {
        q: '¿Cuánto tiempo tarda el OCR?',
        a: 'Entre 10 y 60 segundos para una factura estándar. Facturas multipágina o con formato inusual pueden tardar hasta 2 minutos. Si pasan más de 5 minutos sin respuesta, puedes asumir que ha habido un error de servicio — cierra el formulario y vuelve a intentarlo. En la primera carga del día el servicio puede estar "en frío" y tardar un poco más.',
    },
    {
        q: '¿El ahorro mostrado es exacto?',
        a: 'Es una estimación basada en el consumo de UN único período facturado, extrapolado a 12 meses. Es muy fiable para clientes con consumo estable, pero puede desviarse hasta un 20-30% para clientes con fuerte estacionalidad (calefacción eléctrica, segundas residencias, etc). En esos casos, lo ideal es ejecutar el simulador con facturas de distintas épocas del año y promediar los resultados.',
    },
    {
        q: '¿Puedo corregir un campo después de confirmar?',
        a: 'Sí. Confirmar solo registra los datos para el entrenamiento del modelo, no bloquea la edición. Puedes seguir cambiando valores y pulsar "Comparar tarifas" con los datos actualizados. Si quieres marcar una nueva confirmación tras las correcciones, el botón vuelve a estar disponible.',
    },
    {
        q: '¿Qué es la energía reactiva y por qué es una anomalía crítica?',
        a: 'La energía reactiva es consumo eléctrico que no produce trabajo útil pero circula por la red, generado por motores, transformadores y otros equipos inductivos. Las comercializadoras penalizan al cliente cuando supera ciertos umbrales. Es una anomalía crítica porque suele indicar que falta una batería de condensadores: instalarla elimina la penalización y recupera la inversión en menos de un año. Además del cambio de tarifa, representa una oportunidad comercial adicional importante.',
    },
    {
        q: '¿Qué es el CUPS?',
        a: 'CUPS significa Código Universal del Punto de Suministro. Es un identificador único de 20-22 caracteres asignado a cada punto de suministro eléctrico en España (empieza por "ES"). Funciona como el DNI del contador. El simulador lo usa para vincular facturas al mismo cliente en el CRM y detectar facturas duplicadas o históricas del mismo suministro.',
    },
    {
        q: '¿Con qué frecuencia se actualizan las tarifas del mercado?',
        a: 'Las tarifas del catálogo se actualizan semanalmente mediante un proceso automático que lee las ofertas publicadas por las principales comercializadoras. Cambios puntuales (nuevas ofertas, retiradas) pueden reflejarse en 24-48h. Si sospechas que una oferta específica está desactualizada, avisa al equipo de producto y se revisa manualmente.',
    },
];

// ── Quick reference ───────────────────────────────────────────────────────────

interface RefItem {
    dotClass: string;
    label: string;
    desc: string;
}

interface RefGroup {
    title: string;
    items: RefItem[];
}

const QUICK_REF_GROUPS: RefGroup[] = [
    {
        title: 'Confianza OCR',
        items: [
            { dotClass: 'bg-emerald-500 shadow-emerald-500/50', label: 'Confianza alta', desc: 'Campo extraído correctamente.' },
            { dotClass: 'bg-amber-400 shadow-amber-400/50', label: 'Confianza media', desc: 'Verifica el dato contra el PDF.' },
            { dotClass: 'bg-rose-500 shadow-rose-500/50', label: 'Confianza baja', desc: 'Corrige antes de continuar.' },
        ],
    },
    {
        title: 'Anomalías',
        items: [
            { dotClass: 'bg-rose-600 shadow-rose-500/50', label: 'Crítica', desc: 'Acción inmediata requerida.' },
            { dotClass: 'bg-orange-500 shadow-orange-500/50', label: 'Advertencia', desc: 'Revisar como oportunidad.' },
            { dotClass: 'bg-sky-500 shadow-sky-500/50', label: 'Informativa', desc: 'Dato relevante sin urgencia.' },
        ],
    },
    {
        title: 'Etiquetas del sistema',
        items: [
            { dotClass: 'bg-violet-500 shadow-violet-500/50', label: 'IA', desc: 'Valor detectado automáticamente.' },
            { dotClass: 'bg-amber-400 shadow-amber-400/50', label: 'Historial', desc: 'Campo corregido en facturas anteriores.' },
            { dotClass: 'bg-emerald-500 shadow-emerald-500/50', label: 'Validado', desc: 'Confirmado por un humano.' },
        ],
    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StepCard({ step, icon: Icon, title, desc, accentClass }: { step: number; icon: React.ElementType; title: string; desc: string; accentClass: string }) {
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full ${accentClass} flex items-center justify-center shrink-0 text-xs font-black text-white shadow-sm`}>
                    {step}
                </div>
                <div className="w-px flex-1 bg-slate-100 mt-2" />
            </div>
            <div className="pb-5 pt-0.5 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Icon size={13} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-700">{title}</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function TipItem({ tip, colorClass }: { tip: string; colorClass: string }) {
    return (
        <li className="flex gap-2 text-sm text-slate-600 leading-relaxed">
            <ChevronRight size={14} className={`mt-0.5 shrink-0 ${colorClass}`} />
            <span>{tip}</span>
        </li>
    );
}

function ConfidenceDemo() {
    const fields = [
        { label: 'Titular', value: 'Juan García López', dot: 'bg-emerald-500 shadow-emerald-500/50', tag: 'Alta' },
        { label: 'CUPS', value: 'ES0021000001234567AB', dot: 'bg-emerald-500 shadow-emerald-500/50', tag: 'Alta' },
        { label: 'Consumo P3', value: '248 kWh', dot: 'bg-amber-400 shadow-amber-400/50', tag: 'Media' },
        { label: 'Potencia P6', value: '— kW', dot: 'bg-rose-500 shadow-rose-500/50', tag: 'Baja' },
    ];
    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Eye size={12} className="text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ejemplo de indicadores UI</span>
            </div>
            <div className="divide-y divide-slate-100">
                {fields.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`w-2 h-2 rounded-full shadow-[0_0_0_3px] ${f.dot}`} />
                        <span className="text-xs font-semibold text-slate-500 w-24">{f.label}</span>
                        <span className="text-xs font-mono text-slate-800 flex-1">{f.value}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{f.tag}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SectionCard({ section, defaultOpen }: { section: Section; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    const Icon = section.icon;
    const showConfidenceDemo = section.id === 'revision';

    return (
        <motion.section
            id={section.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
            {/* Header */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-start gap-4 px-5 sm:px-6 py-5 text-left hover:bg-slate-50/60 transition-colors"
            >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${section.bg}`}>
                    <Icon size={19} className={section.color} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">{section.title}</h2>
                        {section.badge && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                {section.badge}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">{section.tldr}</p>
                </div>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 shrink-0 mt-1 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Body */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 sm:px-6 pb-6 space-y-6 border-t border-slate-100">
                            <p className="text-sm text-slate-600 leading-relaxed pt-5">{section.intro}</p>

                            {showConfidenceDemo && <ConfidenceDemo />}

                            {section.steps && section.steps.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Cómo funciona</p>
                                    <div>
                                        {section.steps.map((s, i) => (
                                            <StepCard key={i} step={i + 1} icon={s.icon} title={s.title} desc={s.desc} accentClass={section.accent} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {section.tips && section.tips.length > 0 && (
                                <div className={`rounded-xl border p-4 ${section.bg}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                                        <Lightbulb size={11} className={section.color} />
                                        Consejos prácticos
                                    </p>
                                    <ul className="space-y-2">
                                        {section.tips.map((t, i) => <TipItem key={i} tip={t} colorClass={section.color} />)}
                                    </ul>
                                </div>
                            )}

                            {section.note && (
                                <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-800 leading-relaxed">{section.note}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

function FaqAccordion({ item, index }: { item: FaqItem; index: number }) {
    const [open, setOpen] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            className="border-b border-slate-100 last:border-b-0"
        >
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
            >
                <span className="text-[10px] font-black text-slate-300 mt-1 w-6 shrink-0">{String(index + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-sm font-semibold text-slate-800 leading-snug">{item.q}</span>
                <ChevronDown size={15} className={`text-slate-400 shrink-0 mt-0.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <p className="px-5 pb-5 pl-14 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Active section tracking ────────────────────────────────────────────────────

function useActiveSection(ids: string[]): string {
    const [active, setActive] = useState<string>(ids[0] ?? '');

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const elements = ids
            .map(id => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null);

        if (elements.length === 0) return;

        const observer = new IntersectionObserver(
            entries => {
                const visible = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (visible.length > 0) {
                    setActive(visible[0].target.id);
                }
            },
            {
                rootMargin: '-20% 0px -60% 0px',
                threshold: [0, 0.25, 0.5, 0.75, 1],
            }
        );

        elements.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [ids]);

    return active;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulatorGuidePage() {
    const sectionIds = SECTIONS.map(s => s.id).concat(['faqs']);
    const active = useActiveSection(sectionIds);

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="min-h-screen bg-[#fafaf7]">
            {/* Top nav */}
            <div className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-slate-200/70">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <Link
                        href="/dashboard/simulator"
                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">Volver al simulador</span>
                        <span className="sm:hidden">Volver</span>
                    </Link>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hidden md:block">
                        Guía · Simulador de facturas
                    </span>
                    <Link
                        href="/dashboard/simulator"
                        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                        <Zap size={12} />
                        Abrir simulador
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
                    {/* ── Sidebar (desktop) ─────────────────────────────────── */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-24">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-3">
                                En esta guía
                            </p>
                            <nav className="space-y-0.5">
                                {SECTIONS.map(s => {
                                    const isActive = active === s.id;
                                    const Icon = s.icon;
                                    return (
                                        <a
                                            key={s.id}
                                            href={`#${s.id}`}
                                            onClick={(e) => handleNavClick(e, s.id)}
                                            className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                                                isActive
                                                    ? 'bg-slate-900 text-white font-semibold shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Icon size={12} className={isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-600'} />
                                            <span className="flex-1 truncate">{s.title}</span>
                                            {s.badge && (
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                    isActive ? 'bg-white/15 text-emerald-200' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                                }`}>
                                                    {s.badge}
                                                </span>
                                            )}
                                        </a>
                                    );
                                })}
                                <a
                                    href="#faqs"
                                    onClick={(e) => handleNavClick(e, 'faqs')}
                                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all mt-2 ${
                                        active === 'faqs'
                                            ? 'bg-slate-900 text-white font-semibold shadow-sm'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    <HelpCircle size={12} className={active === 'faqs' ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-600'} />
                                    <span className="flex-1 truncate">Preguntas frecuentes</span>
                                </a>
                            </nav>

                            {/* Shortcuts card */}
                            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3 flex items-center gap-1.5">
                                    <Sparkles size={10} />
                                    Atajos
                                </p>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Subir factura</span>
                                        <kbd className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">U</kbd>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Comparar</span>
                                        <kbd className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Resaltar campo</span>
                                        <kbd className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">Clic lupa</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* ── Main content ──────────────────────────────────────── */}
                    <main className="min-w-0">
                        {/* Hero */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="mb-10"
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                                    <BookOpen size={10} />
                                    DOCUMENTACIÓN
                                </div>
                                <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-200">
                                    <Timer size={10} />
                                    LECTURA RÁPIDA · 8 MIN
                                </div>
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-[1.05] tracking-tight">
                                Guía del<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600">
                                    Simulador de Facturas
                                </span>
                            </h1>
                            <p className="text-slate-500 max-w-2xl text-base leading-relaxed">
                                Todo lo que necesitas saber para sacar el máximo partido al análisis de facturas,
                                la comparativa de tarifas y las herramientas de propuesta comercial.
                            </p>
                        </motion.div>

                        {/* ── Mobile tab strip ──────────────────────────────── */}
                        <div className="lg:hidden -mx-4 sm:-mx-6 mb-8 overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 px-4 sm:px-6 pb-2 min-w-max">
                                {SECTIONS.map(s => {
                                    const isActive = active === s.id;
                                    const Icon = s.icon;
                                    return (
                                        <a
                                            key={s.id}
                                            href={`#${s.id}`}
                                            onClick={(e) => handleNavClick(e, s.id)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                                isActive
                                                    ? 'bg-slate-900 text-white shadow-sm'
                                                    : 'bg-white text-slate-600 border border-slate-200'
                                            }`}
                                        >
                                            <Icon size={11} />
                                            {s.title}
                                        </a>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── 3-step flow diagram ───────────────────────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    El flujo en 3 pasos
                                </p>
                                <span className="text-[10px] font-semibold text-slate-400">~2 min/factura</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 relative">
                                {[
                                    { n: 1, icon: Upload, title: 'Subir PDF', desc: 'Arrastra la factura o selecciona un archivo. PDFs nativos funcionan mejor.', color: 'emerald' },
                                    { n: 2, icon: ScanSearch, title: 'Revisar OCR', desc: 'Verifica los campos extraídos y corrige los que tengan baja confianza.', color: 'blue' },
                                    { n: 3, icon: BarChart2, title: 'Analizar', desc: 'Lanza la comparativa y revisa ahorros, anomalías y recomendaciones.', color: 'violet' },
                                ].map((step, i) => {
                                    const StepIcon = step.icon;
                                    const isLast = i === 2;
                                    return (
                                        <div key={step.n} className="relative flex-1">
                                            <div className="flex sm:flex-col gap-4 sm:gap-3 items-start">
                                                <div className="relative shrink-0">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${
                                                        step.color === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
                                                        step.color === 'blue' ? 'bg-blue-50 border-blue-200' :
                                                        'bg-violet-50 border-violet-200'
                                                    }`}>
                                                        <StepIcon size={18} className={
                                                            step.color === 'emerald' ? 'text-emerald-600' :
                                                            step.color === 'blue' ? 'text-blue-600' :
                                                            'text-violet-600'
                                                        } />
                                                    </div>
                                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                                                        {step.n}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 sm:pr-4">
                                                    <h3 className="text-sm font-bold text-slate-800 mb-0.5">{step.title}</h3>
                                                    <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                                                </div>
                                            </div>
                                            {/* Connector */}
                                            {!isLast && (
                                                <div className="hidden sm:block absolute top-6 left-[calc(48px+1rem)] right-0 h-px">
                                                    <div className="h-px bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 relative">
                                                        <ArrowRight size={11} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-300" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* ── Quick reference ────────────────────────────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                            className="mb-10 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                        >
                            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                                <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
                                    <Eye size={14} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-800">Referencia rápida de indicadores</h2>
                                    <p className="text-[11px] text-slate-400">Qué significa cada símbolo y color en la interfaz</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
                                {QUICK_REF_GROUPS.map((group) => (
                                    <div key={group.title} className="bg-white p-5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">
                                            {group.title}
                                        </p>
                                        <ul className="space-y-2.5">
                                            {group.items.map((item, i) => (
                                                <li key={i} className="flex items-start gap-3">
                                                    <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_0_3px] ${item.dotClass}`} />
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                                        <span className="text-xs text-slate-500"> — {item.desc}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* ── Sections ──────────────────────────────────────── */}
                        <div className="space-y-3">
                            {SECTIONS.map((section, i) => (
                                <SectionCard key={section.id} section={section} defaultOpen={i === 0} />
                            ))}
                        </div>

                        {/* ── FAQs ──────────────────────────────────────────── */}
                        <motion.section
                            id="faqs"
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.5 }}
                            className="scroll-mt-24 mt-12 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-sm">
                                    <HelpCircle size={16} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 tracking-tight">Preguntas frecuentes</h2>
                                    <p className="text-xs text-slate-500">Respuestas a las dudas más habituales sobre el simulador.</p>
                                </div>
                            </div>
                            <div>
                                {FAQS.map((f, i) => (
                                    <FaqAccordion key={i} item={f} index={i} />
                                ))}
                            </div>
                        </motion.section>

                        {/* ── Footer CTA ────────────────────────────────────── */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="mt-12 relative rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 p-8 sm:p-10 text-white overflow-hidden"
                        >
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl" />
                            <div className="relative">
                                <Zap size={28} className="mb-4 text-emerald-300" />
                                <h3 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">¿Listo para empezar?</h3>
                                <p className="text-emerald-100/80 text-sm sm:text-base mb-6 max-w-md leading-relaxed">
                                    Vuelve al simulador y carga tu primera factura. Todo el proceso dura menos de 2 minutos.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        href="/dashboard/simulator"
                                        className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold text-sm px-5 py-3 rounded-xl hover:bg-emerald-50 transition-colors shadow-lg"
                                    >
                                        <Zap size={15} />
                                        Abrir el simulador
                                    </Link>
                                    <Link
                                        href="/dashboard/admin"
                                        className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors border border-white/20 backdrop-blur-sm"
                                    >
                                        <Trophy size={15} className="text-amber-300" />
                                        Ver el leaderboard de agentes
                                        <ArrowRight size={13} />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </main>
                </div>
            </div>
        </div>
    );
}
