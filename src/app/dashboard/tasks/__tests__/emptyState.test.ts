import { describe, expect, it } from 'vitest';
import { buildTasksEmptyState } from '../emptyState';

describe('buildTasksEmptyState', () => {
    it('guides the first manual follow-up when there are no tasks', () => {
        expect(buildTasksEmptyState('all')).toEqual({
            title: 'Sin tareas todavia',
            description: 'Crea seguimientos manuales o deja que el flujo de propuestas aceptadas genere tareas de documentacion automaticamente.',
            actionLabel: 'Crear tarea',
            actionKind: 'create-task',
        });
    });

    it('explains empty operational status tabs', () => {
        expect(buildTasksEmptyState('pending').title).toBe('No hay tareas pendientes');
        expect(buildTasksEmptyState('in_progress').description).toContain('seguimiento activo');
        expect(buildTasksEmptyState('completed').description).toContain('historial');
    });

    it('keeps the create task action stable for every empty state', () => {
        expect(buildTasksEmptyState('cancelled')).toMatchObject({
            actionLabel: 'Crear tarea',
            actionKind: 'create-task',
        });
    });
});
