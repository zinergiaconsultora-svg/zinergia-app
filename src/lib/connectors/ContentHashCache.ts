import { createHash } from 'crypto';

export function computeContentHash(content: Buffer | Uint8Array): string {
    return createHash('sha256').update(content).digest('hex');
}

export interface CacheEntry<T> {
    hash: string;
    data: T;
    cachedAt: Date;
}

export class ContentHashCache<T> {
    private readonly cache = new Map<string, CacheEntry<T>>();
    private readonly ttlMs: number;
    private readonly maxSize: number;

    constructor(ttlMs = 7 * 24 * 60 * 60 * 1000, maxSize = 1000) {
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
    }

    get(hash: string): T | null {
        const entry = this.cache.get(hash);
        if (!entry) return null;
        if (Date.now() - entry.cachedAt.getTime() > this.ttlMs) {
            this.cache.delete(hash);
            return null;
        }
        return entry.data;
    }

    set(hash: string, data: T): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(hash, { hash, data, cachedAt: new Date() });
    }

    has(hash: string): boolean {
        return this.get(hash) !== null;
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}
