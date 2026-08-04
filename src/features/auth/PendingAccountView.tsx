import { logout } from '@/app/auth/actions';

export function PendingAccountView() {
    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <section className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">Acceso pendiente</p>
                <h1 className="text-2xl font-bold">Tu cuenta todavía no tiene acceso operativo</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Estamos revisando la activación o la asignación de tu cuenta. Por seguridad, no cargaremos datos de clientes, red ni comisiones hasta que quede resuelta.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <a
                        href="mailto:zinergiaconsultora@gmail.com?subject=Revisi%C3%B3n%20de%20acceso%20Zinergia"
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Contactar con soporte
                    </a>
                    <form action={logout}>
                        <button
                            type="submit"
                            className="min-h-11 w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Cerrar sesión
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}
