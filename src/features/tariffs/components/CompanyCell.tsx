import { getMarketerLogo, normalizeMarketerName } from '@/lib/marketers/logos'

const logoImageClass = (company: string) => {
    switch (normalizeMarketerName(company)) {
        case 'NATURGY':
            return 'scale-100 sm:scale-[1.35]'
        case 'PLENITUDE':
            return 'scale-100 sm:scale-[1.45]'
        default:
            return 'scale-100'
    }
}

interface CompanyCellProps {
    company: string
    logoColor?: string | null
    size?: 'sm' | 'md'
    showName?: boolean
}

export function CompanyCell({ company, logoColor, size = 'sm', showName = true }: CompanyCellProps) {
    const logo = getMarketerLogo(company)

    const dim = size === 'md'
        ? 'h-8 w-10 sm:h-9 sm:w-16 sm:rounded-xl'
        : 'w-7 h-7'

    return (
        <div className="flex items-center gap-2">
            {logo ? (
                <div className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${dim}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logo}
                        alt={`Logo ${company}`}
                        className={`h-full w-full object-contain p-0.5 ${logoImageClass(company)}`}
                    />
                </div>
            ) : (
                <div className={`rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${dim} ${logoColor || 'bg-slate-600'}`}>
                    {company.slice(0, 2)}
                </div>
            )}
            {showName && <span className="font-semibold text-slate-800">{company}</span>}
        </div>
    )
}
