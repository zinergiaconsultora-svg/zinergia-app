'use client';

import React, { useCallback, useRef, useEffect } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AsyncFunction<T> = (...args: any[]) => Promise<T>;

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 5 * 60 * 1000;

function getCacheKey<T extends AsyncFunction<any>>(fn: T, args: any[]): string {
    return `${fn.name}-${JSON.stringify(args)}`;
}

function isCacheEntryValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < CACHE_DURATION;
}

export function useSWRLike<T>(
    key: string | null,
    fetcher: () => Promise<T>,
    options: {
        revalidateOnFocus?: boolean;
        revalidateOnReconnect?: boolean;
        dedupingInterval?: number;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
    } = {}
) {
    const { revalidateOnFocus = false, dedupingInterval = 2000, onSuccess, onError } = options;
    
    const fetchedRef = useRef<Date | null>(null);
    const [data, setData] = React.useState<T | null>(null);
    const [error, setError] = React.useState<Error | null>(null);
    const [isValidating, setIsValidating] = React.useState(false);

    const mutate = useCallback(async () => {
        if (!key) return;
        
        const now = Date.now();
        if (fetchedRef.current && now - fetchedRef.current.getTime() < dedupingInterval) {
            return;
        }

        setIsValidating(true);
        setError(null);

        try {
            const result = await fetcher();
            setData(result);
            fetchedRef.current = new Date();
            onSuccess?.(result);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            onError?.(error);
        } finally {
            setIsValidating(false);
        }
    }, [key, fetcher, dedupingInterval, onSuccess, onError]);

    useEffect(() => {
        if (key) {
            mutate();
        }
    }, [key, mutate]);

    useEffect(() => {
        if (!revalidateOnFocus || !key) return;
        
        const handleFocus = () => mutate();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [key, mutate, revalidateOnFocus]);

    return { data, error, isValidating, mutate };
}

export function useCachedFetch<T extends AsyncFunction<any>>(fn: T) {
    return useCallback(async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const key = getCacheKey(fn, args);
        const cached = cache.get(key);

        if (cached && isCacheEntryValid(cached)) {
            return cached.data as ReturnType<T>;
        }

        const result = await fn(...args);
        cache.set(key, { data: result, timestamp: Date.now() });

        return result;
    }, [fn]);
}

export function clearCache(pattern?: string) {
    if (!pattern) {
        cache.clear();
        return;
    }

    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
}

export function preloadData<T>(key: string, data: T) {
    cache.set(key, { data, timestamp: Date.now() });
}
