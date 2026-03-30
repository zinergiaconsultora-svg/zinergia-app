# ⚡ Zinergia - Core Features & Capabilities

> [!TIP]
> **Propuesta de Valor Principal**: Zinergia es el primer ecosistema operativo (SaaS) diseñado exclusivamente para Consultorías Energéticas. Integra un CRM hiper-enfocado, un motor OCR de inteligencia artificial, y una calculadora de márgenes en tiempo real para cotizar y cerrar ventas en segundos.

---

## 1. 🤖 Motor de IA OCR Ingests (Aletheia Engine)
El corazón de la automatización. Las horas invertidas tecleando datos se reducen a segundos.

- **Drop & Quote (Hero Upload):** Arrastra y suelta un PDF de cualquier comercializadora del mercado en el Dashboard.
- **Extracción Inteligente:** El algoritmo lee e interpreta automáticamente consumos, potencias contratadas, penalizaciones de reactiva e impuestos (conectado a N8N y modelos de lenguaje LLM).
- **Procesamiento en Segundo Plano (Jobs Manager):** Historial visual en la pantalla principal para seguir en tiempo real qué facturas están siendo auditadas y cuáles fallaron por error de lectura, permitiendo su relanzamiento.

## 2. 📊 Dashboard de Rendimiento Directivo
Toda la biometría financiera del vendedor o de la franquicia alojada en una única vista panorámica, libre de ruido y distracciones.

- **KPIs Core en Tiempo Real:** Monitorización contante del _Ahorro Total Detectado en €_, _Pipeline Activo Mensual_ y _Tasa de Conversión_.
- **Tendencias de Ahorro Histórico:** Gráficos estéticos con curvas suaves para comparar la diferencia térmica entre el coste del cliente y la propuesta Zinergia a lo largo de los meses.
- **Distribución de Estado de Leads (Bento Grid):** Gráficos circulares que indican el ratio de "propuestas presentadas, ganadas y perdidas", con accesos directos de 1 clic a tu actividad reciente.

## 3. 🎯 Pipeline CRM Especializado
Gestión de cartera diseñada con las etapas naturales del sector de ventas y energía.

- **Kanban Energético:** Arrastra clientes (Drag-and-Drop) desde _Nuevo > Contactado > En Proceso > Firmado_. 
- **Scorecard de Prospecto:** Perfil individual donde se concentran los datos fiscales de la persona (CIF, representante legal), todas las propuestas generadas para sus diferentes suministros (CUPS) y la trazabilidad de interacción.
- **Vistas Inteligentes (List / Grid):** Interfaz robusta en modo listado tabular para auditoría masiva o Kanban para flujo comercial de agente.

## 4. 📝 Generador Automático de Propuestas
La tecnología elimina a los back-offices obsoletos calculando al milímetro en base al BOE y la tarifa de acceso exacta (2.0TD, 3.0TD, 6.1TD).

- **Snapshots Algorítmicos Inmutables:** Una vez generada una comparativa, las tarifas (precio kW, kWh y fees variables o fijos) quedan selladas a fuego en el tiempo. Un cambio tarifario global no arruina las propuestas antiguas, asegurando conformidad legal frente al cliente.
- **Top Candidates Rating:** El sistema lista automáticamente las 3 mejores tarifas cruzadas (Pymes Fija, Indexada ORO, etc) comparando los periodos P1 a P6 contra el perfil de carga detectado en el OCR de la factura origen.
- **Proyección Anual Universal:** La matemática estandariza sin ambigüedades (Toda factura se anualiza basándose en: `(coste/días) * 365`), blindando tu proceso de ventas contra facturas de "temporada corta o alta".

## 5. 🛡️ Arquitectura Multi-Franquicia & Seguridad (RLS/RBAC)
Ecosistema corporativo de grado empresarial de serie.

- **Control de Acceso basado en Roles (RBAC):** Super-Administradores tienen ojos sobre toda la malla de ventas nacional, mientras que los Agentes o Consultores solo acceden al inventario de clientes y ventas bajo su sub-directorio.
- **Policies (RLS) Activas Nativas:** Seguridad inquebrantable desde el core de la base de datos (PostgreSQL/Supabase). Ningún usuario puede hackear el acceso a cotizaciones de la competencia vecina mediante la interfaz o consultas de API falsificadas. 

## 6. 📱 Accesibilidad UI/UX Premium (Antigravity Design)
- **Glassmorphism Inteligente:** Todos los componentes se apilan visualmente sin solaparse usando técnicas de transluminiscencia, lo que lo hace ver moderno, limpio y de software de alto nivel.
- **Responsive 100%:** Todas las funciones desde Dashboard hasta lectura de facturas corren sin fisuras en iPads y el navegador del teléfono móvil de un técnico en terreno.
