import type { TaskStatus } from '@/types/crm';

type TaskFilter = TaskStatus | 'all';

export interface TasksEmptyStateCopy {
    title: string;
    description: string;
    actionLabel: string;
    actionKind: 'create-task';
}

const STATUS_EMPTY_COPY: Record<Exclude<TaskFilter, 'all' | 'cancelled'>, Omit<TasksEmptyStateCopy, 'actionLabel' | 'actionKind'>> = {
    pending: {
        title: 'No hay tareas pendientes',
        description: 'Tu cola de seguimiento esta limpia. Crea una tarea manual si quieres dejar preparado el siguiente contacto con un cliente.',
    },
    in_progress: {
        title: 'No hay tareas en progreso',
        description: 'Cuando empieces un seguimiento activo aparecera aqui. Puedes crear una tarea si necesitas mover una gestion ahora.',
    },
    completed: {
        title: 'No hay tareas completadas todavia',
        description: 'Las tareas cerradas quedaran aqui como historial de seguimiento comercial.',
    },
};

export function buildTasksEmptyState(filter: TaskFilter): TasksEmptyStateCopy {
    const action = {
        actionLabel: 'Crear tarea',
        actionKind: 'create-task' as const,
    };

    if (filter === 'cancelled') {
        return {
            title: 'No hay tareas canceladas',
            description: 'No tienes seguimientos descartados. Si una tarea deja de aplicar, podra quedar aqui como referencia.',
            ...action,
        };
    }

    if (filter !== 'all') {
        return {
            ...STATUS_EMPTY_COPY[filter],
            ...action,
        };
    }

    return {
        title: 'Sin tareas todavia',
        description: 'Crea seguimientos manuales o deja que el flujo de propuestas aceptadas genere tareas de documentacion automaticamente.',
        ...action,
    };
}
