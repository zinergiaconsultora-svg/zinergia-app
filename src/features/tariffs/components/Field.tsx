'use client'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</div>
            {children}
        </label>
    )
}
