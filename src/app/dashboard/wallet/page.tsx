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

    let allCommissions: Commission[] = [];
    if (canManage) {
        try {
            allCommissions = await getAllCommissionsAction();
        } catch {
            // Non-fatal: admin panel will be empty
        }
    }

    return (
        <>
            <WalletView canManage={canManage} allCommissions={allCommissions} />
            <div className="max-w-7xl mx-auto px-0 mt-8">
                <BillingHistoryPanel franchiseId={userId} canManage={canManage} />
            </div>
        </>
    );
}
