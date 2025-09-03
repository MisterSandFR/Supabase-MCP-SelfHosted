import { z } from 'zod';

/**
 * Rate limiting and resource control utilities
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
    firstRequest: number;
}

interface ResourceLimit {
    maxMemoryMB: number;
    maxExecutionTimeMs: number;
    maxConcurrentRequests: number;
}

/**
 * In-memory rate limiter (for single-instance deployments)
 */
export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout;
    
    constructor(
        private maxRequests: number = 100,
        private windowMs: number = 60000, // 1 minute
        private cleanupIntervalMs: number = 60000
    ) {
        // Periodically clean up expired entries
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, cleanupIntervalMs);
    }
    
    /**
     * Checks if a request should be allowed
     */
    public async checkLimit(identifier: string): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
        retryAfter?: number;
    }> {
        const now = Date.now();
        const entry = this.limits.get(identifier);
        
        if (!entry || now >= entry.resetTime) {
            // New window or expired entry
            this.limits.set(identifier, {
                count: 1,
                resetTime: now + this.windowMs,
                firstRequest: now
            });
            
            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetTime: now + this.windowMs
            };
        }
        
        if (entry.count >= this.maxRequests) {
            // Rate limit exceeded
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime,
                retryAfter
            };
        }
        
        // Increment counter
        entry.count++;
        this.limits.set(identifier, entry);
        
        return {
            allowed: true,
            remaining: this.maxRequests - entry.count,
            resetTime: entry.resetTime
        };
    }
    
    /**
     * Resets the rate limit for an identifier
     */
    public reset(identifier: string): void {
        this.limits.delete(identifier);
    }
    
    /**
     * Cleans up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (now >= entry.resetTime) {
                this.limits.delete(key);
            }
        }
    }
    
    /**
     * Destroys the rate limiter and clears the cleanup interval
     */
    public destroy(): void {
        clearInterval(this.cleanupInterval);
        this.limits.clear();
    }
}

/**
 * Adaptive rate limiter that adjusts limits based on system load
 */
export class AdaptiveRateLimiter extends RateLimiter {
    private systemLoad: number = 0;
    private errorRate: number = 0;
    
    constructor(
        private baseMaxRequests: number = 100,
        windowMs: number = 60000,
        cleanupIntervalMs: number = 60000
    ) {
        super(baseMaxRequests, windowMs, cleanupIntervalMs);
        
        // Monitor system metrics
        setInterval(() => {
            this.updateSystemMetrics();
        }, 5000);
    }
    
    /**
     * Updates system metrics for adaptive limiting
     */
    private updateSystemMetrics(): void {
        // Get memory usage
        const memUsage = process.memoryUsage();
        const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        // Simple load calculation (would need real metrics in production)
        this.systemLoad = memoryUsagePercent / 100;
        
        // Adjust max requests based on system load
        const loadFactor = 1 - (this.systemLoad * 0.5); // Reduce by up to 50% under high load
        const adjustedMax = Math.max(10, Math.floor(this.baseMaxRequests * loadFactor));
        
        // Update the parent class's maxRequests
        (this as any).maxRequests = adjustedMax;
    }
    
    /**
     * Records an error for adaptive adjustment
     */
    public recordError(): void {
        this.errorRate = Math.min(1, this.errorRate + 0.1);
    }
    
    /**
     * Records a success for adaptive adjustment
     */
    public recordSuccess(): void {
        this.errorRate = Math.max(0, this.errorRate - 0.01);
    }
}

/**
 * Resource usage tracker
 */
export class ResourceTracker {
    private startTime: number;
    private memoryCheckpoints: number[] = [];
    
    constructor(private limits: ResourceLimit) {
        this.startTime = Date.now();
    }
    
    /**
     * Checks if execution time limit has been exceeded
     */
    public checkExecutionTime(): void {
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.limits.maxExecutionTimeMs) {
            throw new Error(`Execution time limit exceeded: ${elapsed}ms > ${this.limits.maxExecutionTimeMs}ms`);
        }
    }
    
    /**
     * Checks if memory limit has been exceeded
     */
    public checkMemoryUsage(): void {
        const memUsage = process.memoryUsage();
        const memoryMB = memUsage.heapUsed / 1024 / 1024;
        
        this.memoryCheckpoints.push(memoryMB);
        
        if (memoryMB > this.limits.maxMemoryMB) {
            throw new Error(`Memory limit exceeded: ${memoryMB.toFixed(2)}MB > ${this.limits.maxMemoryMB}MB`);
        }
    }
    
    /**
     * Gets resource usage statistics
     */
    public getStats(): {
        executionTime: number;
        memoryUsageMB: number;
        peakMemoryMB: number;
    } {
        const executionTime = Date.now() - this.startTime;
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const peakMemory = Math.max(...this.memoryCheckpoints, currentMemory);
        
        return {
            executionTime,
            memoryUsageMB: currentMemory,
            peakMemoryMB: peakMemory
        };
    }
}

/**
 * Concurrent request limiter
 */
export class ConcurrencyLimiter {
    private activeRequests: Map<string, Set<string>> = new Map();
    
    constructor(private maxConcurrent: number = 10) {}
    
    /**
     * Attempts to acquire a slot for execution
     */
    public async acquire(identifier: string, requestId: string): Promise<boolean> {
        const active = this.activeRequests.get(identifier) || new Set();
        
        if (active.size >= this.maxConcurrent) {
            return false;
        }
        
        active.add(requestId);
        this.activeRequests.set(identifier, active);
        return true;
    }
    
    /**
     * Releases a slot after execution
     */
    public release(identifier: string, requestId: string): void {
        const active = this.activeRequests.get(identifier);
        if (active) {
            active.delete(requestId);
            if (active.size === 0) {
                this.activeRequests.delete(identifier);
            }
        }
    }
    
    /**
     * Gets the number of active requests for an identifier
     */
    public getActiveCount(identifier: string): number {
        const active = this.activeRequests.get(identifier);
        return active ? active.size : 0;
    }
}

/**
 * Query complexity analyzer for database operations
 */
export class QueryComplexityAnalyzer {
    private readonly COMPLEXITY_WEIGHTS = {
        SELECT: 1,
        INSERT: 2,
        UPDATE: 3,
        DELETE: 3,
        JOIN: 5,
        SUBQUERY: 10,
        UNION: 8,
        GROUP_BY: 4,
        ORDER_BY: 2,
        HAVING: 3,
        DISTINCT: 2,
        AGGREGATE: 3 // COUNT, SUM, AVG, etc.
    };
    
    /**
     * Calculates the complexity score of a SQL query
     */
    public calculateComplexity(query: string): number {
        const upperQuery = query.toUpperCase();
        let complexity = 0;
        
        // Count occurrences of each operation
        for (const [operation, weight] of Object.entries(this.COMPLEXITY_WEIGHTS)) {
            const regex = new RegExp(`\\b${operation}\\b`, 'gi');
            const matches = upperQuery.match(regex);
            if (matches) {
                complexity += matches.length * weight;
            }
        }
        
        // Check for aggregate functions
        const aggregates = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
        for (const func of aggregates) {
            const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
            const matches = upperQuery.match(regex);
            if (matches) {
                complexity += matches.length * this.COMPLEXITY_WEIGHTS.AGGREGATE;
            }
        }
        
        // Additional complexity for nested queries
        const openParens = (upperQuery.match(/\(/g) || []).length;
        const closeParens = (upperQuery.match(/\)/g) || []).length;
        const nestingLevel = Math.min(openParens, closeParens);
        complexity += nestingLevel * 2;
        
        // Complexity based on query length
        complexity += Math.floor(query.length / 100);
        
        return complexity;
    }
    
    /**
     * Checks if a query exceeds the complexity limit
     */
    public checkComplexityLimit(query: string, maxComplexity: number = 50): void {
        const complexity = this.calculateComplexity(query);
        if (complexity > maxComplexity) {
            throw new Error(`Query complexity (${complexity}) exceeds limit (${maxComplexity})`);
        }
    }
}

/**
 * Request throttler with backpressure support
 */
export class RequestThrottler {
    private queue: Array<{
        execute: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = [];
    private processing = false;
    
    constructor(
        private maxQueueSize: number = 100,
        private processDelayMs: number = 100
    ) {}
    
    /**
     * Adds a request to the throttle queue
     */
    public async throttle<T>(execute: () => Promise<T>): Promise<T> {
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error('Request queue is full. Please try again later.');
        }
        
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ execute, resolve, reject });
            if (!this.processing) {
                this.processQueue();
            }
        });
    }
    
    /**
     * Processes queued requests
     */
    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }
        
        this.processing = true;
        const item = this.queue.shift();
        
        if (item) {
            try {
                const result = await item.execute();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }
        
        // Add delay between requests
        setTimeout(() => {
            this.processQueue();
        }, this.processDelayMs);
    }
    
    /**
     * Gets queue statistics
     */
    public getStats(): { queueLength: number; processing: boolean } {
        return {
            queueLength: this.queue.length,
            processing: this.processing
        };
    }
}

/**
 * Creates a rate-limited wrapper for a function
 */
export function createRateLimitedFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
        maxRequests?: number;
        windowMs?: number;
        identifier?: (...args: Parameters<T>) => string;
    } = {}
): T {
    const limiter = new RateLimiter(
        options.maxRequests || 10,
        options.windowMs || 60000
    );
    
    return (async (...args: Parameters<T>) => {
        const id = options.identifier ? options.identifier(...args) : 'default';
        const { allowed, retryAfter } = await limiter.checkLimit(id);
        
        if (!allowed) {
            throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
        }
        
        return fn(...args);
    }) as T;
}

/**
 * Default resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimit = {
    maxMemoryMB: 512,
    maxExecutionTimeMs: 30000, // 30 seconds
    maxConcurrentRequests: 10
};

/**
 * Creates a resource-limited execution context
 */
export async function withResourceLimits<T>(
    execute: () => Promise<T>,
    limits: Partial<ResourceLimit> = {}
): Promise<T> {
    const resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
    const tracker = new ResourceTracker(resourceLimits);
    
    // Set up periodic checks
    const checkInterval = setInterval(() => {
        tracker.checkExecutionTime();
        tracker.checkMemoryUsage();
    }, 1000);
    
    try {
        const result = await execute();
        return result;
    } finally {
        clearInterval(checkInterval);
        const stats = tracker.getStats();
        console.log(`Resource usage: ${stats.executionTime}ms, ${stats.memoryUsageMB.toFixed(2)}MB (peak: ${stats.peakMemoryMB.toFixed(2)}MB)`);
    }
}