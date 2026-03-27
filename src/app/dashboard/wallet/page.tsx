import WalletView from "@/features/gamification/components/WalletView";
import { getUserRole, canManageNetwork } from "@/lib/auth/permissions";
import { getAllCommissionsAction } from "@/app/actions/commissions";
import { Commission } from "@/types/crm";

export default async function WalletPage() {
    const role = await getUserRole();
    const canManage = role ? canManageNetwork(role) : false;

    let allCommissions: Commission[] = [];
    if (canManage) {
        try {
            allCommissions = await getAllCommissionsAction();
        } catch {
            // Non-fatal: admin panel will be empty
        }
    }

    return <WalletView canManage={canManage} allCommissions={allCommissions} />;
}
