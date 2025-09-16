#!/usr/bin/env python3
"""
Supabase MCP Server (FastMCP + Smithery)
"""

from typing import Optional
from pydantic import BaseModel, Field
from mcp.server.fastmcp import Context, FastMCP
from smithery.decorators import smithery


class ConfigSchema(BaseModel):
    SUPABASE_URL: str = Field("", description="URL de votre projet Supabase")
    SUPABASE_ANON_KEY: str = Field("", description="Clé anonyme Supabase")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = Field(None, description="Clé service (optionnel)")
    SUPABASE_AUTH_JWT_SECRET: Optional[str] = Field(None, description="JWT secret (optionnel)")


@smithery.server(config_schema=ConfigSchema)
def create_server() -> FastMCP:
    server = FastMCP("Supabase MCP Server")

    @server.tool()
    def execute_sql(sql: str, ctx: Context) -> str:
        cfg = ctx.session_config
        if not cfg.SUPABASE_URL or not cfg.SUPABASE_ANON_KEY:
            return "Configuration Supabase manquante (SUPABASE_URL, SUPABASE_ANON_KEY)."
        return f"SQL reçu ({len(sql)} chars). Connexion prête pour {cfg.SUPABASE_URL}."

    @server.tool()
    def list_tables(ctx: Context) -> str:
        cfg = ctx.session_config
        if not cfg.SUPABASE_URL:
            return "Configuration Supabase manquante."
        return "Tables listées (démo)."

    @server.tool()
    def check_health(ctx: Context) -> str:
        cfg = ctx.session_config
        if not cfg.SUPABASE_URL:
            return "Configuration Supabase manquante."
        return "OK"

    return server


if __name__ == "__main__":
    srv = create_server()
    print("Serveur FastMCP prêt (Smithery). Outils:", list(srv._tools.keys()))


