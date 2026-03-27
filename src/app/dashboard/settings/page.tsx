import SettingsView from '@/features/crm/components/SettingsView';
import { getUserRole, canConfigureCommissions } from '@/lib/auth/permissions';
import { getActiveCommissionRule, getCommissionRules } from '@/app/actions/commissionRules';

export default async function SettingsPage() {
    const role = await getUserRole();
    const canWrite = role ? canConfigureCommissions(role) : false;

    const [activeRule, allRules] = canWrite
        ? await Promise.all([getActiveCommissionRule(), getCommissionRules()])
        : [null, []];

    return (
        <SettingsView
            canManageCommissions={canWrite}
            activeCommissionRule={activeRule}
            commissionRulesHistory={allRules}
        />
    );
}
