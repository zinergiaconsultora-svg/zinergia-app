import type { UserRole } from '@/types/crm';

export type AppNavigationIcon =
    | 'work'
    | 'clients'
    | 'commissions'
    | 'billing'
    | 'team'
    | 'admin'
    | 'settings'
    | 'invoice'
    | 'proposal'
    | 'tariff'
    | 'network'
    | 'task'
    | 'ocr'
    | 'drive'
    | 'reporting'
    | 'privacy'
    | 'academy'
    | 'metrics';

export type AppNavigationItem = {
    label: string;
    href: string;
    icon: AppNavigationIcon;
};

const commercialPrimary: AppNavigationItem[] = [
    { label: 'Trabajo', href: '/dashboard', icon: 'work' },
    { label: 'Clientes', href: '/dashboard/clients', icon: 'clients' },
    { label: 'Comisiones', href: '/dashboard/commissions', icon: 'commissions' },
    { label: 'Ajustes', href: '/dashboard/settings', icon: 'settings' },
];

const commercialSecondary: AppNavigationItem[] = [
    { label: 'Facturas subidas', href: '/dashboard/invoices', icon: 'invoice' },
    { label: 'Propuestas', href: '/dashboard/proposals', icon: 'proposal' },
    { label: 'Tarifas', href: '/dashboard/tariffs', icon: 'tariff' },
    { label: 'Tareas', href: '/dashboard/tasks', icon: 'task' },
];

const franchiseSecondary: AppNavigationItem[] = [
    ...commercialSecondary,
    { label: 'Red comercial', href: '/dashboard/network', icon: 'network' },
];

const adminPrimary: AppNavigationItem[] = [
    { label: 'Operaciones', href: '/admin', icon: 'work' },
    { label: 'Clientes', href: '/dashboard/clients', icon: 'clients' },
    { label: 'Comisiones', href: '/admin/commissions', icon: 'commissions' },
    { label: 'Facturación', href: '/dashboard/invoicing', icon: 'billing' },
    { label: 'Equipo', href: '/admin/agents', icon: 'team' },
    { label: 'Administración', href: '/admin/audit', icon: 'admin' },
];

const adminSecondary: AppNavigationItem[] = [
    { label: 'Gestión avanzada de leads', href: '/admin/leads', icon: 'clients' },
    { label: 'Control OCR', href: '/admin/ocr', icon: 'ocr' },
    { label: 'Archivo Drive', href: '/admin/drive', icon: 'drive' },
    { label: 'Informes', href: '/admin/reporting', icon: 'reporting' },
    { label: 'Tarifas', href: '/dashboard/tariffs', icon: 'tariff' },
    { label: 'Red comercial', href: '/dashboard/network', icon: 'network' },
    { label: 'Protección de datos', href: '/admin/rgpd', icon: 'privacy' },
    { label: 'Academia', href: '/admin/academy', icon: 'academy' },
    { label: 'Indicadores', href: '/admin/business-metrics', icon: 'metrics' },
];

export function getAppNavigation(role: UserRole): {
    primary: AppNavigationItem[];
    secondary: AppNavigationItem[];
} {
    if (role === 'admin') {
        return { primary: adminPrimary, secondary: adminSecondary };
    }

    return {
        primary: commercialPrimary,
        secondary: role === 'franchise'
            ? franchiseSecondary
            : commercialSecondary,
    };
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
    if (href === '/dashboard' || href === '/admin') {
        return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}
