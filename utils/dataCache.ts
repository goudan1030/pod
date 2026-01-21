// Simple in-memory cache for home page data
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class DataCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly TTL = 5 * 60 * 1000; // 5 minutes cache TTL

    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if cache is still valid
        if (Date.now() - entry.timestamp > this.TTL) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    clear(key?: string): void {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        // Check if cache is still valid
        if (Date.now() - entry.timestamp > this.TTL) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }
}

export const dataCache = new DataCache();
export const CACHE_KEYS = {
    CATEGORIES: 'categories',
    MODELS: 'models',
};
