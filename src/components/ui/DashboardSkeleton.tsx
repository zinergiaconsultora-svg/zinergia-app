import React from 'react';

export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-[#FAFAFA] text-slate-600 font-sans relative overflow-hidden">
            <div className="max-w-[1600px] mx-auto px-6 py-8 md:px-8 md:py-10 pb-40 relative z-10 flex flex-col gap-10 md:gap-12 animate-pulse">

                {/* 1. HEADER SKELETON */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="w-32 h-10 bg-slate-200 rounded-lg"></div>
                    <div className="hidden md:flex items-center gap-6">
                        <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                        <div className="w-24 h-8 bg-slate-200 rounded-full"></div>
                        <div className="w-[1px] h-6 bg-slate-200"></div>
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-8 bg-slate-200 rounded-lg"></div>
                            <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* 2. HERO SKELETON */}
                <div className="flex flex-col gap-3">
                    <div className="w-96 h-12 bg-slate-200 rounded-2xl"></div>
                    <div className="w-full max-w-2xl h-6 bg-slate-200 rounded-xl"></div>
                </div>

                {/* 3. KPIs SKELETON */}
                <div className="flex flex-col md:grid md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-40 bg-white/60 border border-slate-100 rounded-3xl p-6 flex flex-col justify-between">
                            <div className="w-8 h-8 bg-slate-200 rounded-full mb-2"></div>
                            <div className="space-y-2">
                                <div className="w-24 h-4 bg-slate-200 rounded-full"></div>
                                <div className="w-32 h-10 bg-slate-200 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 4. CONTENT GRID SKELETON */}
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* A. Trend Chart */}
                    <div className="flex flex-col gap-4 lg:col-span-8">
                        <div className="w-48 h-6 bg-slate-200 rounded-full"></div>
                        <div className="h-[300px] w-full bg-white/60 rounded-3xl border border-slate-100"></div>
                    </div>

                    {/* B. Pipeline */}
                    <div className="flex flex-col gap-4 lg:col-span-4">
                        <div className="w-32 h-6 bg-slate-200 rounded-full"></div>
                        <div className="h-[300px] w-full bg-white/60 rounded-3xl border border-slate-100"></div>
                    </div>

                    {/* C. Leaderboard */}
                    <div className="flex flex-col gap-6 lg:col-span-4 lg:row-start-2">
                        <div className="w-40 h-6 bg-slate-200 rounded-full"></div>
                        <div className="h-[400px] w-full bg-white/60 rounded-[2.5rem] border border-slate-100"></div>
                    </div>

                    {/* D. Activity */}
                    <div className="flex flex-col gap-4 lg:col-span-8 lg:row-start-2">
                        <div className="w-40 h-6 bg-slate-200 rounded-full"></div>
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-20 w-full bg-white/60 rounded-2xl border border-slate-100"></div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
