#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SelfhostedSupabaseClient } from "../client/index.js";
import type { ToolContext } from "../tools/types.js";
import { executeSqlTool } from "../tools/execute_sql.js";
import { listTablesTool } from "../tools/list_tables.js";

// Export config schema for Smithery auto-detection
export const configSchema = z.object({
  SUPABASE_URL: z.string().describe("URL de votre projet Supabase (ex: https://your-project.supabase.co)"),
  SUPABASE_ANON_KEY: z.string().describe("Clé anonyme publique Supabase"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe("Clé service (optionnelle)"),
  SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe("JWT secret (optionnel)"),
  DATABASE_URL: z.string().optional().describe("URL de connexion Postgres directe (optionnel)"),
  ALLOW_AUTO_CREATE_RPC: z.boolean().optional().default(false).describe("Autoriser la création auto de public.execute_sql (nécessite service role + database url)")
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: "Selfhosted Supabase MCP (Node)",
    version: "3.1.0",
  });

  let clientPromise: Promise<SelfhostedSupabaseClient> | null = null;
  function getClient(): Promise<SelfhostedSupabaseClient> {
    if (!clientPromise) {
      clientPromise = SelfhostedSupabaseClient.create({
        supabaseUrl: config.SUPABASE_URL,
        supabaseAnonKey: config.SUPABASE_ANON_KEY,
        supabaseServiceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
        jwtSecret: config.SUPABASE_AUTH_JWT_SECRET,
        databaseUrl: config.DATABASE_URL || process.env.DATABASE_URL,
      });
    }
    return clientPromise;
  }

  const makeContext = async (): Promise<ToolContext> => ({
    selfhostedClient: await getClient(),
    log: (message: string, level?: "info" | "warn" | "error") => {
      const prefix = level ? `[${level.toUpperCase()}]` : "[INFO]";
      console.error(prefix, message);
    },
  });

  // Health tool (simple)
  server.tool(
    "check_health",
    { description: "Check database health and config presence", parameters: z.object({}) },
    async () => {
      return `OK (url=${Boolean(config.SUPABASE_URL)}, anon=${Boolean(config.SUPABASE_ANON_KEY)})`;
    }
  );

  // Execute SQL tool (secured)
  server.tool(
    executeSqlTool.name,
    { description: executeSqlTool.description, parameters: executeSqlTool.inputSchema },
    async (args: unknown) => {
      // Security guard: forbid multi-statement without service role + db url
      const a = (args as any) || {};
      if (a.allow_multiple_statements) {
        if (!config.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error("allow_multiple_statements requires SUPABASE_SERVICE_ROLE_KEY");
        }
        if (!config.DATABASE_URL && !process.env.DATABASE_URL) {
          throw new Error("allow_multiple_statements requires DATABASE_URL for direct connection");
        }
      }
      const ctx = await makeContext();
      const result = await executeSqlTool.execute(args as any, ctx);
      return typeof result === "string" ? result : JSON.stringify(result);
    }
  );

  // List tables tool (read-only)
  server.tool(
    listTablesTool.name,
    { description: listTablesTool.description, parameters: listTablesTool.inputSchema },
    async (args: unknown) => {
      const ctx = await makeContext();
      const result = await listTablesTool.execute(args, ctx);
      return typeof result === "string" ? result : JSON.stringify(result);
    }
  );

  return server.server;
}


