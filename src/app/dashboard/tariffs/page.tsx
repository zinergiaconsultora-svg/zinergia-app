import { requireRouteRole, getUserRole } from '@/lib/auth/permissions'
import { getTarifas, getTariffCommissions, getCollaboratorPct } from '@/app/actions/tariffs'
import TarifasAdminView from '@/features/tariffs/components/TarifasAdminView'
import TarifasAgentView from '@/features/tariffs/components/TarifasAgentView'

export default async function TariffsPage() {
    await requireRouteRole(['admin', 'franchise', 'agent'])

    const role = await getUserRole()
    const activeOnly = role !== 'admin'

    const [electricity, gas, commissions, collaboratorPct] = await Promise.all([
        getTarifas('electricity', activeOnly),
        getTarifas('gas', activeOnly),
        getTariffCommissions(),
        getCollaboratorPct(),
    ]);

    if (role === 'admin') {
        return (
            <TarifasAdminView
                initialElectricity={electricity}
                initialGas={gas}
                initialCommissions={commissions}
                initialCollaboratorPct={collaboratorPct}
                isAdmin={true}
            />
        )
    }

    // franchise y agent → vista de lectura con su comisión
    return (
        <TarifasAgentView
            electricity={electricity}
            gas={gas}
            commissions={commissions}
            collaboratorPct={collaboratorPct}
        />
    )
}
