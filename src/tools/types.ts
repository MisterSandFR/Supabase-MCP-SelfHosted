import type { SelfhostedSupabaseClient } from '../client/index.js';
import { z } from "zod";

// Define log function type
type LogFunction = (message: string, level?: 'info' | 'warn' | 'error') => void;

/**
 * Defines the expected shape of the context object passed to tool execute functions.
 */
export interface ToolContext {
    selfhostedClient: SelfhostedSupabaseClient;
    log: LogFunction; // Explicitly define the log function
    workspacePath?: string; // Path to the workspace root
    [key: string]: unknown; // Allow other context properties, though log is now typed
}

export interface AppTool {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    mcpInputSchema: object;
    outputSchema: z.ZodTypeAny;
    execute: (input: unknown, context: ToolContext) => Promise<unknown>;
} 