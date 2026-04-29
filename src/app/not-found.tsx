import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC] p-6">
            <div className="text-center max-w-md">
                <div className="text-8xl font-black text-slate-200 select-none mb-2">404</div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">
                    Página no encontrada
                </h1>
                <p className="text-slate-500 mb-8">
                    La página que buscas no existe o ha sido movida.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link
                        href="/dashboard"
                        className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                        Ir al Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                        Inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
