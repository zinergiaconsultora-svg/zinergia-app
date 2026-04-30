import WalletView from "@/features/gamification/components/WalletView";
import BillingHistoryPanel from "@/features/gamification/components/BillingHistoryPanel";
import { getUserRole, canManageNetwork } from "@/lib/auth/permissions";
import { getAllCommissionsAction } from "@/app/actions/commissions";
import { createClient } from "@/lib/supabase/server";
import { Commission } from "@/types/crm";

export default async function WalletPage() {
    const role = await getUserRole();
    const canManage = role ? canManageNetwork(role) : false;

    // Obtener userId para pasar como franchiseId al panel de liquidaciones
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    let franchiseId: string | null = null;
    if (userId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', userId)
            .single();
        franchiseId = profile?.franchise_id ?? null;
    }

    let allCommissions: Commission[] = [];
    if (canManage) {
        const result = await getAllCommissionsAction();
        if (result.success) {
            allCommissions = result.data;
        }
    }

    return (
        <>
            <WalletView canManage={canManage} allCommissions={allCommissions} />
            <div className="max-w-7xl mx-auto px-0 mt-8">
                <BillingHistoryPanel franchiseId={franchiseId} canManage={canManage} />
            </div>
        </>
    );
}
