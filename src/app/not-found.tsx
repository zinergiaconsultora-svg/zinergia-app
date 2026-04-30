import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
            <div className="text-center max-w-md">
                <div className="text-8xl font-black text-slate-200 dark:text-slate-800 select-none mb-2">404</div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                    Página no encontrada
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                    La página que buscas no existe o ha sido movida.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link
                        href="/dashboard"
                        className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                    >
                        Ir al Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                    >
                        Inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
