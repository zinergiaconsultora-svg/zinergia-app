import { createClient } from '@/lib/supabase/client';
import { ClientDocument, DocumentCategory } from '@/types/crm';
import { getFranchiseId } from './shared';

const BUCKET = 'client_documents';

function buildFilePath(clientId: string, fileName: string): string {
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${clientId}/${Date.now()}_${sanitized}`;
}

export const documentsService = {
    async uploadDocument(
        clientId: string,
        file: File,
        category: DocumentCategory = 'otro'
    ): Promise<ClientDocument | null> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const franchiseId = await getFranchiseId(supabase);
        const filePath = buildFilePath(clientId, file.name);

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, file);

        if (uploadError) {
            console.error('[documentsService] Upload error:', uploadError);
            return null;
        }

        const { data, error: dbError } = await supabase
            .from('client_documents')
            .insert({
                client_id: clientId,
                agent_id: user.id,
                franchise_id: franchiseId,
                name: file.name,
                file_path: filePath,
                size_bytes: file.size,
                file_type: file.type || 'application/octet-stream',
                category,
            })
            .select()
            .single();

        if (dbError) {
            console.error('[documentsService] DB insert error:', dbError);
            await supabase.storage.from(BUCKET).remove([filePath]);
            return null;
        }

        return data as ClientDocument;
    },

    async getDocumentsByClient(clientId: string): Promise<ClientDocument[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('client_documents')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return (data || []) as ClientDocument[];
    },

    async getDownloadUrl(document: ClientDocument): Promise<string | null> {
        const supabase = createClient();
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(document.file_path, 3600);

        if (error) {
            console.error('[documentsService] Signed URL error:', error);
            return null;
        }
        return data?.signedUrl ?? null;
    },

    async deleteDocument(document: ClientDocument): Promise<boolean> {
        const supabase = createClient();

        const { error: storageError } = await supabase.storage
            .from(BUCKET)
            .remove([document.file_path]);

        if (storageError) {
            console.error('[documentsService] Storage delete error:', storageError);
        }

        const { error: dbError } = await supabase
            .from('client_documents')
            .delete()
            .eq('id', document.id);

        if (dbError) {
            console.error('[documentsService] DB delete error:', dbError);
            return false;
        }
        return true;
    },
};
