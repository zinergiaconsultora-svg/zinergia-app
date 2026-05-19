export interface WeeklySummaryMetrics {
    wonThisWeek: number;
    urgentFollowups: number;
    unauditedClients: number;
    pendingCommissions: number;
    conversionRate30d: number;
}

export interface WeeklySummaryContent {
    title: string;
    body: string;
    html: string;
    hasActionableItems: boolean;
}

export function buildWeeklySummaryContent(
    metrics: WeeklySummaryMetrics,
    now = new Date(),
): WeeklySummaryContent {
    const title = `Resumen semanal - ${now.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
    })}`;
    const lines: string[] = [];

    if (metrics.wonThisWeek > 0) {
        lines.push(`${metrics.wonThisWeek} venta${metrics.wonThisWeek > 1 ? 's' : ''} esta semana`);
    }
    if (metrics.urgentFollowups > 0) {
        lines.push(`${metrics.urgentFollowups} seguimiento${metrics.urgentFollowups > 1 ? 's' : ''} urgente${metrics.urgentFollowups > 1 ? 's' : ''}`);
    }
    if (metrics.unauditedClients > 0) {
        lines.push(`${metrics.unauditedClients} cliente${metrics.unauditedClients > 1 ? 's' : ''} sin auditoria`);
    }
    if (metrics.pendingCommissions > 0) {
        lines.push(`${metrics.pendingCommissions} comision${metrics.pendingCommissions > 1 ? 'es' : ''} pendiente${metrics.pendingCommissions > 1 ? 's' : ''}`);
    }
    lines.push(`Conversion 30d: ${metrics.conversionRate30d}%`);

    return {
        title,
        body: lines.join(' · '),
        html: buildHtml(title, metrics),
        hasActionableItems: metrics.wonThisWeek > 0 ||
            metrics.urgentFollowups > 0 ||
            metrics.unauditedClients > 0 ||
            metrics.pendingCommissions > 0,
    };
}

function buildHtml(title: string, metrics: WeeklySummaryMetrics): string {
    const cards = [
        ['Ventas esta semana', metrics.wonThisWeek],
        ['Seguimientos urgentes', metrics.urgentFollowups],
        ['Clientes sin auditoria', metrics.unauditedClients],
        ['Comisiones pendientes', metrics.pendingCommissions],
        ['Conversion 30d', `${metrics.conversionRate30d}%`],
    ];

    return `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;">
  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:22px;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Actividad comercial y tareas prioritarias de la semana.</p>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
      ${cards.map(([label, value]) => `
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">
          <p style="margin:0 0 6px;color:#64748b;font-size:12px;">${escapeHtml(String(label))}</p>
          <p style="margin:0;color:#0f172a;font-size:24px;font-weight:700;">${escapeHtml(String(value))}</p>
        </div>
      `).join('')}
    </div>
    <a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || 'https://zinergia.vercel.app')}/dashboard"
       style="display:inline-block;margin-top:22px;padding:12px 18px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
      Abrir dashboard
    </a>
  </div>
</div>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
