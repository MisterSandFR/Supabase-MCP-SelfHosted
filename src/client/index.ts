import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SelfhostedSupabaseClientOptions, SqlExecutionResult, SqlErrorResponse, SqlSuccessResponse } from '../types/index.js';
import { Pool } from 'pg'; // We'll need this later for direct DB access
import type { PoolClient } from 'pg'; // Import PoolClient type

/**
 * A client tailored for interacting with self-hosted Supabase instances.
 * Handles both Supabase API interactions and direct database connections.
 */
export class SelfhostedSupabaseClient {
    private options: SelfhostedSupabaseClientOptions;
    public supabase: SupabaseClient;
    private pgPool: Pool | null = null; // Lazy initialized pool for direct DB access
    private rpcFunctionExists = false;

    // SQL definition for the helper function
    private static readonly CREATE_EXECUTE_SQL_FUNCTION = `
        CREATE OR REPLACE FUNCTION public.execute_sql(query text, read_only boolean DEFAULT false)
        RETURNS jsonb -- Using jsonb is generally preferred over json
        LANGUAGE plpgsql
        AS $$
        DECLARE
          result jsonb;
        BEGIN
          -- Note: SET TRANSACTION READ ONLY might not behave as expected within a function
          -- depending on the outer transaction state. Handle read-only logic outside if needed.

          -- Execute the dynamic query and aggregate results into a JSONB array
          EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t' INTO result;

          RETURN result;
        EXCEPTION
          WHEN others THEN
            -- Rethrow the error with context, including the original SQLSTATE
            RAISE EXCEPTION 'Error executing SQL (SQLSTATE: %): % ', SQLSTATE, SQLERRM;
        END;
        $$;
    `;

    // SQL to grant permissions
    private static readonly GRANT_EXECUTE_SQL_FUNCTION = `
        GRANT EXECUTE ON FUNCTION public.execute_sql(text, boolean) TO authenticated;
        -- Optionally grant to anon if needed (uncomment if required):
        -- GRANT EXECUTE ON FUNCTION public.execute_sql(text, boolean) TO anon;
    `;

    /**
     * Creates an instance of SelfhostedSupabaseClient.
     * Note: Call initialize() after creating the instance to check for RPC functions.
     * @param options - Configuration options for the client.
     */
    private constructor(options: SelfhostedSupabaseClientOptions) {
        this.options = options;

        // Initialize the primary Supabase client (anon key)
        this.supabase = createClient(options.supabaseUrl, options.supabaseAnonKey, options.supabaseClientOptions);

        // Validate required options
        if (!options.supabaseUrl || !options.supabaseAnonKey) {
            throw new Error('Supabase URL and Anon Key are required.');
        }
    }

    /**
     * Factory function to create and asynchronously initialize the client.
     * Checks for the existence of the helper RPC function.
     */
    public static async create(options: SelfhostedSupabaseClientOptions): Promise<SelfhostedSupabaseClient> {
        const client = new SelfhostedSupabaseClient(options);
        await client.initialize();
        return client;
    }

    /**
     * Initializes the client by checking for the required RPC function.
     * Attempts to create the function if it doesn't exist and a service role key is provided.
     */
    public async initialize(): Promise<void> {
        console.error('Initializing SelfhostedSupabaseClient...');
        try {
            await this.checkAndCreateRpcFunction();
            console.error(`RPC function 'public.execute_sql' status: ${this.rpcFunctionExists ? 'Available' : 'Unavailable'}`);
        } catch (error) {
            console.error('Error during client initialization:', error);
            // Decide if we should throw or allow continuation without RPC
            // For now, let's log and continue, executeSqlViaRpc will throw if needed
        }
        console.error('Initialization complete.');
    }

    // --- Public Methods (to be implemented) ---

    /**
     * Executes SQL using the preferred RPC method.
     */
    public async executeSqlViaRpc(query: string, readOnly = false): Promise<SqlExecutionResult> {
        if (!this.rpcFunctionExists) {
            // This should ideally not be hit if initialize() succeeded and the function
            // was expected to be available, but good to have a check.
            console.error('Attempted to call executeSqlViaRpc, but RPC function is not available.');
            return {
                error: {
                    message: 'execute_sql RPC function not found or client not properly initialized.',
                    code: 'MCP_CLIENT_ERROR',
                },
            } as SqlErrorResponse;
        }

        console.error(`Executing via RPC (readOnly: ${readOnly}): ${query.substring(0, 100)}...`);

        try {
            const { data, error } = await this.supabase.rpc('execute_sql', {
                query: query,
                read_only: readOnly,
            });

            if (error) {
                console.error('Error executing SQL via RPC:', error);
                // Attempt to conform to SqlErrorResponse structure
                return {
                    error: {
                        message: error.message,
                        code: error.code, // Propagate Supabase/PostgREST error code
                        details: error.details,
                        hint: error.hint,
                    },
                };
            }

            // The RPC function returns JSONB which Supabase client parses.
            // We expect it to be an array of objects (records).
            // Ensure we always return an array, even if data is null/undefined
            if (data === null || data === undefined) {
                console.error('RPC returned null/undefined, returning empty array');
                return [] as SqlSuccessResponse;
            }
            
            if (Array.isArray(data)) {
                 // Explicitly cast to expected success type
                return data as SqlSuccessResponse;
            }
            // If it's not an array, something went wrong with the RPC function's output
            console.error('Unexpected response format from execute_sql RPC:', data);
            return {
                error: {
                    message: 'Unexpected response format from execute_sql RPC. Expected JSON array.',
                    code: 'MCP_RPC_FORMAT_ERROR',
                },
             } as SqlErrorResponse;
        } catch (rpcError: unknown) {
            const errorMessage = rpcError instanceof Error ? rpcError.message : String(rpcError);
             console.error('Exception during executeSqlViaRpc call:', rpcError);
            return {
                error: {
                    message: `Exception during RPC call: ${errorMessage}`,
                    code: 'MCP_RPC_EXCEPTION',
                },
            } as SqlErrorResponse;
        }
    }

    /**
     * Executes SQL directly against the database using the pg library.
     * Requires DATABASE_URL to be configured.
     * Useful for simple queries when RPC is unavailable or direct access is preferred.
     * NOTE: Does not support transactions or parameterization directly.
     * Consider executeTransactionWithPg for more complex operations.
     */
    public async executeSqlWithPg(query: string): Promise<SqlExecutionResult> {
        if (!this.options.databaseUrl) {
            return { error: { message: 'DATABASE_URL is not configured. Cannot execute SQL directly.', code: 'MCP_CONFIG_ERROR' } };
        }
        
        // Retry logic for transient connection errors
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.ensurePgPool(); // Ensure pool is initialized
                if (!this.pgPool) { // Should not happen if ensurePgPool works, but type guard
                     return { error: { message: 'pg Pool not available after initialization attempt.', code: 'MCP_POOL_ERROR' } };
                }

                let client: PoolClient | undefined;
                try {
                    client = await this.pgPool.connect();
                    console.error(`Executing via pg (attempt ${attempt}): ${query.substring(0, 100)}...`);
                    const result = await client.query(query);
                    // Return result in a format consistent with SqlSuccessResponse
                    // Ensure we always return an array, even if empty
                    const rows = result.rows || [];
                    return rows as SqlSuccessResponse;
                } catch (dbError: unknown) {
                    const error = dbError instanceof Error ? dbError : new Error(String(dbError));
                    
                    // Check if this is a transient error that we should retry
                    if (attempt < maxRetries && this.isTransientError(error)) {
                        lastError = error;
                        console.error(`Transient error on attempt ${attempt}:`, error.message);
                        
                        // Reset pool if connection error
                        if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
                            console.error('Resetting connection pool due to network error...');
                            await this.resetPgPool();
                        }
                        
                        // Wait before retrying
                        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                        console.error(`Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; // Retry the operation
                    }
                    
                    // Not a transient error or max retries reached
                    console.error('Error executing SQL with pg:', error);
                    // Try to extract code if possible (pg errors often have a .code property)
                    const code = (dbError as { code?: string })?.code || 'PG_ERROR';
                    return { error: { message: error.message, code: code } };
                } finally {
                    client?.release();
                }
            } catch (poolError: unknown) {
                lastError = poolError instanceof Error ? poolError : new Error(String(poolError));
                console.error(`Pool initialization error on attempt ${attempt}:`, lastError.message);
                
                if (attempt < maxRetries) {
                    // Reset pool and retry
                    await this.resetPgPool();
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // All retries exhausted
        return { 
            error: { 
                message: `Failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`, 
                code: 'MCP_MAX_RETRIES_EXCEEDED' 
            } 
        };
    }
    
    /**
     * Determines if an error is transient and should be retried.
     */
    private isTransientError(error: Error): boolean {
        const transientPatterns = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ECONNREFUSED',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'connection timeout',
            'Connection terminated',
            'socket hang up',
            'connect ETIMEDOUT'
        ];
        
        return transientPatterns.some(pattern => 
            error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }
    
    /**
     * Resets the PostgreSQL connection pool.
     */
    private async resetPgPool(): Promise<void> {
        if (this.pgPool) {
            console.error('Closing existing pg pool...');
            try {
                await this.pgPool.end();
            } catch (err) {
                console.error('Error closing pg pool:', err);
            }
            this.pgPool = null;
        }
    }

    /**
     * Ensures the pg connection pool is initialized.
     * Should be called before accessing this.pgPool.
     */
    private async ensurePgPool(): Promise<void> {
        if (this.pgPool) return;
        if (!this.options.databaseUrl) {
            throw new Error('DATABASE_URL is not configured. Cannot initialize pg pool.');
        }

        console.error('Initializing pg pool with enhanced connection settings...');
        
        // Enhanced pool configuration for better resilience in Coolify/Docker environments
        this.pgPool = new Pool({ 
            connectionString: this.options.databaseUrl,
            // Connection pool configuration
            max: 10, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: 10000, // Give up trying to connect after 10 seconds
            
            // Connection retry configuration for network issues
            allowExitOnIdle: false, // Keep the pool alive even if all clients are idle
            
            // Additional connection options for better compatibility
            application_name: 'selfhosted-supabase-mcp',
            
            // Statement timeout to prevent long-running queries from blocking
            statement_timeout: 60000, // 60 seconds
            
            // Keep-alive settings for Docker/container environments
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000
        });

        this.pgPool.on('error', (err, client) => {
            console.error('PG Pool Error: Unexpected error on idle client', err);
            // Reset pool on critical errors
            if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')) {
                console.error('Connection error detected. Pool will attempt to recover automatically.');
            }
        });

        // Test connection with retry logic
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const client = await this.pgPool.connect();
                await client.query('SELECT 1'); // Simple test query
                console.error(`pg pool connected successfully on attempt ${attempt}.`);
                client.release();
                return; // Success, exit the method
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                console.error(`Connection attempt ${attempt} failed:`, lastError.message);
                
                if (attempt < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.error(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // All retries exhausted
                    console.error('All connection attempts failed.');
                    await this.pgPool.end();
                    this.pgPool = null;
                    throw new Error(`Failed to connect pg pool after ${maxRetries} attempts: ${lastError.message}`);
                }
            }
        }
    }

     /**
     * Executes a series of operations within a single database transaction using the pg library.
     * Requires DATABASE_URL to be configured.
     * @param callback A function that receives a connected pg client and performs queries.
     *                 It should return a promise that resolves on success or rejects on failure.
     *                 The transaction will be committed if the promise resolves,
     *                 and rolled back if it rejects.
     */
    public async executeTransactionWithPg<T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        if (!this.options.databaseUrl) {
            throw new Error('DATABASE_URL is not configured. Cannot execute transaction directly.');
        }
        await this.ensurePgPool();
        if (!this.pgPool) {
            throw new Error('pg Pool not available for transaction.');
        }

        const client = await this.pgPool.connect();
        try {
            await client.query('BEGIN');
            console.error('BEGIN transaction');
            const result = await callback(client);
            await client.query('COMMIT');
            console.error('COMMIT transaction');
            return result;
        } catch (error) {
            console.error('Transaction Error - Rolling back:', error);
            await client.query('ROLLBACK');
            console.error('ROLLBACK transaction');
            // Re-throw the error so the caller knows the transaction failed
            throw error;
        } finally {
            client.release();
        }
    }

    // --- Helper/Private Methods (to be implemented) ---

    private async checkAndCreateRpcFunction(): Promise<void> {
        console.error("Checking for public.execute_sql RPC function...");
        try {
            // Try calling the function with a simple query
            const { error } = await this.supabase.rpc('execute_sql', { query: 'SELECT 1' });

            if (!error) {
                console.error("'public.execute_sql' function found.");
                this.rpcFunctionExists = true;
                return;
            }

            const UNDEFINED_FUNCTION_ERROR_CODE = '42883';
            // PostgREST error when function definition is not found in its cache
            const POSTGREST_FUNCTION_NOT_FOUND_CODE = 'PGRST202';

            if (
                error.code === UNDEFINED_FUNCTION_ERROR_CODE ||
                error.code === POSTGREST_FUNCTION_NOT_FOUND_CODE
            ) {
                console.error(
                    `'public.execute_sql' function not found (Code: ${error.code}). Attempting creation...`,
                );
                if (!this.options.supabaseServiceRoleKey) {
                    console.error("Cannot create 'public.execute_sql': supabaseServiceRoleKey not provided.");
                    this.rpcFunctionExists = false;
                    return;
                }
                if (!this.options.databaseUrl) {
                    // Prefer direct DB connection for DDL if available
                    console.error("Cannot create 'public.execute_sql' reliably without databaseUrl for direct connection.");
                    // Could attempt with a service role client, but less ideal for DDL
                     this.rpcFunctionExists = false;
                    return;
                }

                try {
                    console.error("Creating 'public.execute_sql' function using direct DB connection...");
                    // Use direct DB connection (pg) as it's generally better for DDL
                    await this.executeSqlWithPg(SelfhostedSupabaseClient.CREATE_EXECUTE_SQL_FUNCTION);
                    await this.executeSqlWithPg(SelfhostedSupabaseClient.GRANT_EXECUTE_SQL_FUNCTION);
                    console.error("'public.execute_sql' function created and permissions granted successfully.");
                    
                    // Attempt to notify PostgREST to reload its schema cache
                    console.error("Notifying PostgREST to reload schema cache...");
                    await this.executeSqlWithPg("NOTIFY pgrst, 'reload schema'");
                    console.error("PostgREST schema reload notification sent.");

                    // Assume success for now, but subsequent RPC calls will verify
                    this.rpcFunctionExists = true; 
                } catch (creationError: unknown) {
                    const errorMessage = creationError instanceof Error ? creationError.message : String(creationError);
                    console.error("Failed to create 'public.execute_sql' function or notify PostgREST:", creationError);
                    this.rpcFunctionExists = false;
                    // Rethrow or handle as appropriate
                    throw new Error(`Failed to create execute_sql function/notify: ${errorMessage}`);
                }
            } else {
                console.error(
                    "Unexpected error checking for 'public.execute_sql' function:",
                    error,
                );
                this.rpcFunctionExists = false;
                // Throw the original Supabase/PostgREST error for clarity
                throw new Error(
                    `Error checking for execute_sql function: ${error.message}`,
                );
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("Exception during RPC function check/creation:", err);
            this.rpcFunctionExists = false;
            // Rethrow the error to be caught by initialize()
            throw new Error(`Exception during RPC function check/creation: ${errorMessage}`); // Rethrow with a typed error
        }
    }

    // --- Getters --- 
    public getSupabaseUrl(): string {
        return this.options.supabaseUrl;
    }

    public getAnonKey(): string {
        return this.options.supabaseAnonKey;
    }

    public getServiceRoleKey(): string | undefined {
        return this.options.supabaseServiceRoleKey;
    }

    /**
     * Gets the configured JWT secret, if provided.
     */
    public getJwtSecret(): string | undefined {
        return this.options.jwtSecret;
    }

    /**
     * Gets the configured direct database connection URL, if provided.
     */
    public getDbUrl(): string | undefined {
        return this.options.databaseUrl;
    }

    /**
     * Checks if the direct database connection (pg) is configured.
     */
    public isPgAvailable(): boolean {
        return !!this.options.databaseUrl;
    }

    /**
     * Gets the pgPool instance.
     */
    public getPgPool(): Pool | null {
        return this.pgPool;
    }
}