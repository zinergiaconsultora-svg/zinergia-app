import { logger } from '@/lib/utils/logger';

export interface ConnectorConfig {
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
    maxRetries?: number;
}

export interface ConnectorResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    statusCode?: number;
}

export abstract class BaseConnector {
    protected readonly config: Required<Pick<ConnectorConfig, 'baseUrl' | 'timeoutMs' | 'maxRetries'>> & ConnectorConfig;
    protected readonly name: string;

    constructor(name: string, config: ConnectorConfig) {
        this.name = name;
        this.config = {
            ...config,
            timeoutMs: config.timeoutMs ?? 10_000,
            maxRetries: config.maxRetries ?? 2,
        };
    }

    protected async fetchWithRetry<T>(
        path: string,
        init?: RequestInit,
    ): Promise<ConnectorResult<T>> {
        const url = `${this.config.baseUrl}${path}`;
        let lastError: string | undefined;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
                    ...(init?.headers as Record<string, string> ?? {}),
                };

                const response = await fetch(url, {
                    ...init,
                    headers,
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    lastError = `HTTP ${response.status}: ${await response.text().catch(() => 'unknown')}`;
                    if (response.status >= 500 && attempt < this.config.maxRetries) {
                        await this.backoff(attempt);
                        continue;
                    }
                    return { success: false, error: lastError, statusCode: response.status };
                }

                const data = await response.json() as T;
                return { success: true, data, statusCode: response.status };
            } catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
                if (attempt < this.config.maxRetries) {
                    await this.backoff(attempt);
                    continue;
                }
            }
        }

        logger.warn(`[${this.name}] all retries exhausted`, { url, error: lastError });
        return { success: false, error: lastError };
    }

    private backoff(attempt: number): Promise<void> {
        const ms = Math.min(1000 * 2 ** attempt, 8000);
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
