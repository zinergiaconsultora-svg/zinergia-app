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

    const imgContainer = size === 'md'
        ? 'h-8 w-10 sm:h-9 sm:w-16 sm:rounded-xl shadow-[0_8px_18px_rgba(15,23,42,0.08)] ring-1 ring-white transition-all duration-300 group-hover/company:-translate-y-0.5 group-hover/company:border-indigo-200 group-hover/company:shadow-[0_10px_24px_rgba(79,70,229,0.16)]'
        : 'w-7 h-7 shadow-sm'

    const fallbackContainer = size === 'md'
        ? 'h-8 w-10 sm:h-9 sm:w-14 sm:rounded-xl sm:text-xs font-black tracking-wide border border-white/70 ring-1 ring-slate-900/5'
        : 'w-7 h-7 font-bold'

    return (
        <div className="flex items-center gap-2">
            {logo ? (
                <div className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white ${imgContainer}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logo}
                        alt={`Logo ${company}`}
                        className={`h-full w-full object-contain p-0.5 ${logoImageClass(company)}`}
                    />
                </div>
            ) : (
                <div className={`rounded-lg flex items-center justify-center text-white text-[10px] shrink-0 ${fallbackContainer} ${logoColor || 'bg-slate-600'}`}>
                    {company.slice(0, 2)}
                </div>
            )}
            {showName && <span className="font-semibold text-slate-800">{company}</span>}
        </div>
    )
}
