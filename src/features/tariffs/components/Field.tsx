export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            {children}
        </label>
    );
}
