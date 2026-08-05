# Plan de desarrollo — Perfil Admin: flujo Lead→Cliente y diseño

> Estado: **propuesta** · Fecha: 2026-06-23
> Contexto: tras implementar el archivo en Drive + registro de facturas + ciclo
> **Lead→Cliente** (cierre admin-only), el perfil admin necesita integrar y dar
> protagonismo a estas nuevas responsabilidades. Ref: `2026-06-23-facturas-google-drive.md`.

## 1. Qué cambió y por qué afecta al admin

- Cada factura subida es un **LEAD**; solo el **admin** lo convierte en **CLIENTE**
  (check "aceptó la oferta") capturando compañía, tarifa, permanencia y comisión.
- Hoy esa conversión vive en `/dashboard/invoices` (vista compartida, estilo
  "slate limpio"), **fuera del área `/admin`** (glassmorphism). El admin tiene que
  buscar entre todas las facturas de la franquicia las que cerrar — **sin triaje,
  sin métricas, sin priorización**.
- La nueva infraestructura (sync a Drive, reconciliación, huérfanos RGPD,
  recordatorios de permanencia, cuota) **no tiene panel de salud** para el admin.

## 2. Objetivos

1. Hacer del **lead→cliente** una tarea de primera clase en el perfil admin:
   triaje rápido, filtros, conversión sin fricción, visibilidad de comisión.
2. Dar **métricas accionables** (embudo de conversión, leads pendientes,
   comisiones por cerrar, permanencias por revisar).
3. Un **panel de salud** del subsistema de facturas/Drive/RGPD.
4. **Unificar el diseño** entre el área admin y el nuevo registro.

## 3. Huecos concretos (auditoría del perfil admin actual)

| Hueco | Estado hoy |
|---|---|
| Cola de leads pendientes de cerrar | No existe (admin busca a mano) |
| KPI de conversión / leads abiertos | No existe |
| Comisiones ligadas al cierre de lead | Comisión se guarda en el job, pero no hay vista admin agregada |
| Salud de Drive (pendientes/fallidos/cuota) | No existe (solo logs + cron) |
| RGPD: borrados a Drive / huérfanos | Auditado en `audit_logs`, sin panel |
| Coherencia visual admin ↔ registro | Dos lenguajes distintos (glass vs slate) |
| Permanencias próximas (revisión) | Notificación push, sin vista admin |

---

## 4. Plan por fases

### Fase A — Cockpit de Leads del admin (núcleo)
**Objetivo:** una superficie admin para revisar y convertir leads sin fricción.

- Nueva ruta **`/admin/leads`** (o pestaña en el dashboard admin) con `requireRouteRole(['admin'])`.
- Lista priorizada desde `invoice_registry` con **filtros**: estado del proceso
  (lead/ocr_done/compared/cliente), comercial, franquicia, rango de fechas, importe.
- **Triaje:** orden por antigüedad/importe; foco en leads `ocr_done` aún sin cerrar.
- **Conversión inline:** reutiliza el modal "Convertir lead en cliente"
  (`closeInvoiceAction`) ya existente; añadir conversión desde la fila + atajos.
- **Acciones rápidas:** ver factura (`getInvoiceFileUrlAction`), abrir en Drive
  (admin), marcar como perdido (nuevo estado `closed_lost`, ver Decisión D2).
- Server action `getAdminLeadsAction(filtros, paginación)` sobre la VIEW (RLS admin
  ya da visibilidad global).

**Entregable:** el admin entra a `/admin/leads`, ve la cola, convierte en 2 clics.

### Fase B — Métricas y embudo de conversión
**Objetivo:** que el admin vea el rendimiento del flujo.

- **KPIs nuevos** en el dashboard admin (tarjetas):
  - Leads abiertos · Cerrados (clientes) este mes · **Tasa de conversión**.
  - **Comisión generada** por cierres (suma `commission_amount` de cerrados).
  - Facturas **pendientes de Drive** · **Permanencias** que vencen ≤30d.
- **Embudo**: subida → OCR → comparada → cliente (reusar patrón de charts admin).
- Server action `getLeadFunnelAction()` (agregados sobre `ocr_jobs`).
- Por comercial: ranking de conversión (extiende `AgentLeaderboard`).

### Fase C — Panel de salud del subsistema (Ops)
**Objetivo:** operar Drive/RGPD/recordatorios desde la UI.

- Sección admin "Estado de Facturas/Drive":
  - Sync Drive: archivadas / pendientes / fallidas (de `drive_synced_at`).
  - Botón **"Reintentar ahora"** → dispara reconciliación (server action que llama
    a `reconcilePendingDriveArchives`).
  - **Cuota** de Drive (de `getStorageQuota`) con barra y aviso al 80%.
  - **RGPD**: últimos borrados a Drive / huérfanos (de `audit_logs`
    `rgpd_drive_*`) — integrar en `RgpdPanel`/`AuditPanel` existentes.
  - Estado de la **integración** (`integration_credentials.status`): badge
    `active`/`degraded` + acción **"Reconectar Drive"** si degradado.

### Fase D — Unificación de diseño y pulido
**Objetivo:** una identidad visual coherente y de calidad.

- **Decidir lenguaje** (ver Decisión D1) y aplicarlo al registro + cockpit:
  jerarquía, badges Lead/Cliente, estados hover/focus, densidad.
- Componentizar: extraer `LeadStatusBadge`, `ProcessBadge`, `DriveChip`,
  `KpiCard` a `components/ui` para reutilizar en admin y dashboard.
- Responsive/móvil (el resto de la app es mobile-first): tabla → cards en móvil.
- Accesibilidad: foco visible, roles ARIA en el modal, contraste de los badges.
- Estados vacíos/carga/skeletons coherentes.

---

## 5. Dirección de diseño (propuesta)

Mantener el **slate limpio** del registro como base (más legible para listas densas
de trabajo) y **bajar la intensidad glass** del admin hacia ese sistema, conservando
1 acento (energy/emerald para "cliente", sky para "lead", amber para avisos).
Tokens y badges compartidos → coherencia sin rehacer todo.

## 6. Decisiones tomadas (2026-06-23)

- **D1 — Lenguaje visual:** **slate limpio** (unificar el admin hacia el estilo del
  registro). Extraer tokens/badges compartidos.
- **D2 — Lead perdido:** **sí**, añadir estado **`closed_lost`** (lead que no aceptó).
  Implica: columna/flag `lost` (o `outcome` enum `won|lost`), acción
  `markLeadLostAction` (admin), y el embudo/tasa de conversión lo usan.
- **D3 — Ubicación:** **`/admin/leads` dedicado** (cockpit admin), con
  `requireRouteRole(['admin'])`.
- **D4 — Alcance de cierre:** **solo `admin`** (se mantiene el gate actual).

## 7. Estimación orientativa

| Fase | Alcance | Estimación |
|---|---|---|
| A | Cockpit de leads + conversión | 2–3 días |
| B | KPIs + embudo | 1,5–2 días |
| C | Panel de salud Ops | 1,5 días |
| D | Diseño + componentización + a11y | 2 días |
| **Total** | | **~7–8,5 días** |

## 8. Orden recomendado
A → B → D (parcial, lo que toque A/B) → C. La Fase A es la de mayor valor
(desbloquea la operativa real del admin); C puede ir en paralelo.

---

## 9. Estado de implementación

### Mejoras al plan aplicadas
- La VIEW `invoice_registry` no producía `closed_lost`; se añade columna `lost` y se
  deriva. Se añaden `agent_name` y `franchise_name` (joins) para el cockpit.
- Modal de cierre y badges extraídos a `features/invoices/components/invoiceParts.tsx`
  (DRY, reutilizados por registro y cockpit).

### Fase A — Cockpit de Leads (HECHO)
- Migración `lead_lost`: `ocr_jobs.lost/lost_at/lost_reason` + VIEW reescrita
  (closed_lost + agent_name + franchise_name). Aplicada en staging.
- Acciones: `markLeadLostAction` (admin), `getAdminLeadsAction` (filtros outcome/
  agent/franchise/search), `reopenInvoiceAction` limpia también `lost`.
- UI: `AdminLeadsView` (tabs Abiertos/Clientes/Perdidos/Todos + búsqueda + filas con
  comercial + acciones Ver/Pasar a cliente/Perdido), hook `useAdminLeads`, ruta
  `/admin/leads`, enlace "🎯 Leads" en el nav admin. Diseño slate limpio.
- Verificado: `closed_lost` derivado, `agent_name` en la VIEW. 0 errores TS · 268/268 tests.

### Fase B — Métricas + embudo (HECHO)
- BD: funciones `get_lead_metrics()` y `get_lead_agent_ranking()` (SECURITY INVOKER,
  respetan RLS; `REVOKE` de anon). Aplicadas en staging.
- Acción: `getLeadMetricsAction()` (admin) → métricas + ranking.
- UI: `LeadMetrics` (6 KPIs: leads abiertos, clientes/mes, **tasa conversión**,
  comisión generada, pendientes Drive, permanencias ≤30d) + **embudo**
  (subida→OCR→comparada→cliente) + **ranking por comercial**. `conversionRate` puro
  testeado. Renderizado encima del cockpit en `/admin/leads`.
- Verificado con datos reales (won/lost/open + comisión). 0 errores TS · 271/271 tests.

### Fase C — Panel de salud Ops (HECHO)
- Acciones: `getDriveHealthAction` (estado integración, contadores de sync, cuota
  vía `about.get`, feed RGPD desde `audit_logs`) y `triggerDriveReconcileAction`
  (reintento manual). Admin only.
- UI: `DriveHealthPanel` en `/admin/drive` (enlace ☁️ Drive en el nav): estado de
  la integración (active/degraded + guía de reconexión), sync (total/archivadas/
  pendientes/fallidas) + **"Reintentar ahora"**, **barra de cuota** (15 GB, aviso
  80%), **borrados RGPD recientes**.
- Verificado en vivo: `about.get` funciona con scope `drive.file` (cuota real
  ~15 GB). 0 errores TS · 271/271 tests.

### Fase D — Diseño / a11y / móvil (HECHO)
- **Componentización:** `StatCard` compartido en `components/ui` (reutilizado por
  `LeadMetrics` y `DriveHealthPanel`, elimina duplicados).
- **Accesibilidad:** hook `useEscapeKey` → cierre con Escape en los modales de
  conversión y de "perdido"; `role="dialog"`/`aria-modal` ya presentes; `aria-pressed`
  + `focus-visible` en las pestañas del cockpit; `aria-label` en botones de icono.
- **Móvil:** nav admin con scroll horizontal (`overflow-x-auto`) para sus 10 enlaces;
  grids ya responsive (KPIs 2→6 col, tablas con `overflow-x-auto`).
- 0 errores TS · 271/271 tests.

### Auditoría pre-deploy (2026-06-23)
- 🔴 **Bug corregido:** `closeInvoiceAction` no limpiaba `lost` → un lead perdido y
  luego convertido quedaba `closed=true` **y** `lost=true` (falseaba la tasa de
  conversión). Ahora el cierre limpia `lost`. Igual en el `onClosed` del modal.
- 🟠 **Hardening corregido:** el `REVOKE ... FROM anon` de las funciones de métricas
  era inefectivo (EXECUTE se hereda de PUBLIC). Cambiado a `REVOKE ... FROM PUBLIC` +
  `GRANT ... TO authenticated`. Verificado: `anon_exec=false`.
- ✅ Advisor de seguridad: las funciones nuevas (INVOKER + search_path) y la VIEW
  (`security_invoker`) **no generan ningún aviso nuevo**. Resto = preexistente.
- ✅ `closeInvoiceAction` revalida también `/admin/leads`.
- 0 errores TS · 271/271 tests.

## ✅ Plan completo (A–D)
Las 4 fases del perfil admin están implementadas y verificadas en staging. El admin
dispone de **🎯 Leads** (cockpit con métricas, embudo, ranking, conversión y
"perdido") y **☁️ Drive** (salud, reintento, cuota, RGPD), todo en diseño slate
limpio y con accesibilidad básica.
