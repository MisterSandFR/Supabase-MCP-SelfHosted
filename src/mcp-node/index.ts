#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Export config schema for Smithery auto-detection
export const configSchema = z.object({
  SUPABASE_URL: z.string().describe("URL de votre projet Supabase (ex: https://your-project.supabase.co)"),
  SUPABASE_ANON_KEY: z.string().describe("Clé anonyme publique Supabase"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe("Clé service (optionnelle)"),
  SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe("JWT secret (optionnel)"),
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: "Supabase MCP Server (Node Wrapper)",
    version: "3.1.0",
  });

  // Minimal tool to confirm server works and config passes through
  server.tool("check_health", {
    description: "Check basic health and presence of SUPABASE_URL",
    parameters: z.object({}),
  }, async () => {
    return `OK (url=${Boolean(config.SUPABASE_URL)})`;
  });

  return server.server;
}


