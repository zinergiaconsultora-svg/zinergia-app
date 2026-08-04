import { redirect, unstable_rethrow } from 'next/navigation';

import { getTrustedActorProfile } from '@/lib/auth/permissions';
import { PendingAccountView } from '@/features/auth/PendingAccountView';

export default async function AccountPendingPage() {
    try {
        await getTrustedActorProfile();
        redirect('/dashboard');
    } catch (error) {
        unstable_rethrow(error);
    }
    return <PendingAccountView />;
}
