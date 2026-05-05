import { createClient } from '@/lib/supabase/client';
import { Task, TaskStatus, TaskType, TaskPriority } from '@/types/crm';
import { getFranchiseId } from './shared';

export const tasksService = {
    async createTask(task: {
        client_id?: string;
        proposal_id?: string;
        title: string;
        description?: string;
        type?: TaskType;
        priority?: TaskPriority;
        due_date?: string;
        auto_generated?: boolean;
    }): Promise<Task | null> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const franchiseId = await getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('tasks')
            .insert({
                ...task,
                agent_id: user.id,
                franchise_id: franchiseId,
                type: task.type || 'manual',
                priority: task.priority || 'medium',
                auto_generated: task.auto_generated ?? false,
            })
            .select()
            .single();

        if (error) {
            console.error('[tasksService] Error creating task:', error);
            return null;
        }
        return data as Task;
    },

    async updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'type' | 'priority' | 'status' | 'due_date'>>): Promise<boolean> {
        const supabase = createClient();

        const payload: Record<string, unknown> = { ...updates };
        if (updates.status === 'completed') {
            payload.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('tasks')
            .update(payload)
            .eq('id', id)
            .eq('agent_id', (await supabase.auth.getUser()).data.user?.id ?? '');

        if (error) {
            console.error('[tasksService] Error updating task:', error);
            return false;
        }
        return true;
    },

    async deleteTask(id: string): Promise<boolean> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('agent_id', user.id);

        return !error;
    },

    async getTasksByClient(clientId: string): Promise<Task[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('client_id', clientId)
            .order('due_date', { ascending: true, nullsFirst: false });

        if (error) return [];
        return (data || []) as Task[];
    },

    async getTasks(filters?: {
        status?: TaskStatus;
        type?: TaskType;
        overdue?: boolean;
        limit?: number;
    }): Promise<Task[]> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        let query = supabase
            .from('tasks')
            .select('*, clients(id, name), proposals(id, offer_snapshot)')
            .eq('agent_id', user.id)
            .order('due_date', { ascending: true, nullsFirst: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.overdue) {
            query = query.lt('due_date', new Date().toISOString().split('T')[0])
                .eq('status', 'pending');
        }
        if (filters?.limit) query = query.limit(filters.limit);

        const { data, error } = await query;
        if (error) return [];
        return (data || []) as Task[];
    },

    async getTaskStats(): Promise<{ pending: number; overdue: number; completed: number; total: number }> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { pending: 0, overdue: 0, completed: 0, total: 0 };

        const { data, error } = await supabase
            .from('tasks')
            .select('status, due_date')
            .eq('agent_id', user.id);

        if (error || !data) return { pending: 0, overdue: 0, completed: 0, total: 0 };

        const today = new Date().toISOString().split('T')[0];
        return {
            total: data.length,
            pending: data.filter(t => t.status === 'pending').length,
            overdue: data.filter(t => t.status === 'pending' && t.due_date && t.due_date < today).length,
            completed: data.filter(t => t.status === 'completed').length,
        };
    },

    async generateFollowUpTasks(clientId: string, proposalId: string, proposalStatus: string): Promise<void> {
        if (!['sent', 'accepted'].includes(proposalStatus)) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const franchiseId = await getFranchiseId(supabase);

        const tasks: Partial<Task>[] = [];

        if (proposalStatus === 'sent') {
            const in3Days = new Date();
            in3Days.setDate(in3Days.getDate() + 3);
            const in7Days = new Date();
            in7Days.setDate(in7Days.getDate() + 7);

            tasks.push({
                agent_id: user.id,
                franchise_id: franchiseId,
                client_id: clientId,
                proposal_id: proposalId,
                title: 'Seguimiento propuesta (3 días)',
                description: 'Contactar cliente para conocer su opinión sobre la propuesta enviada.',
                type: 'follow_up',
                priority: 'high',
                due_date: in3Days.toISOString().split('T')[0],
                auto_generated: true,
                status: 'pending',
            });

            tasks.push({
                agent_id: user.id,
                franchise_id: franchiseId,
                client_id: clientId,
                proposal_id: proposalId,
                title: 'Seguimiento propuesta (7 días)',
                description: 'Segundo intento de contacto si no hubo respuesta al primer seguimiento.',
                type: 'follow_up',
                priority: 'medium',
                due_date: in7Days.toISOString().split('T')[0],
                auto_generated: true,
                status: 'pending',
            });
        }

        if (proposalStatus === 'accepted') {
            tasks.push({
                agent_id: user.id,
                franchise_id: franchiseId,
                client_id: clientId,
                proposal_id: proposalId,
                title: 'Recopilar documentación',
                description: 'Solicitar al cliente la documentación necesaria para el cambio de comercializadora.',
                type: 'documentation',
                priority: 'high',
                due_date: new Date().toISOString().split('T')[0],
                auto_generated: true,
                status: 'pending',
            });
        }

        if (tasks.length === 0) return;

        try {
            await supabase.from('tasks').insert(tasks);
        } catch {
            // non-critical
        }
    },
};
