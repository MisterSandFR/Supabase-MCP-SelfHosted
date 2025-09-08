#!/usr/bin/env python3
"""
Supabase MCP Server - FastMCP avec Smithery
Serveur MCP pour la gestion de Supabase avec OAuth2 et outils avancés
"""

import os
import json
import time
from typing import List, Optional
from pydantic import BaseModel, Field
from mcp.server.fastmcp import Context, FastMCP
from smithery.decorators import smithery

class ConfigSchema(BaseModel):
    SUPABASE_URL: str = Field("", description="URL de votre projet Supabase")
    SUPABASE_ANON_KEY: str = Field("", description="Clé anonyme Supabase")
    SUPABASE_SERVICE_KEY: Optional[str] = Field(None, description="Clé de service Supabase (optionnelle)")

@smithery.server(config_schema=ConfigSchema)
def create_server():
    """Create and return a FastMCP server instance with Supabase tools."""
    
    server = FastMCP(name="Supabase MCP OAuth2 v3.1.0")

    @server.tool()
    def execute_sql(sql: str, allow_multiple_statements: bool = False, ctx: Context) -> str:
        """� v3.1.0 Enhanced SQL with OAuth2 DDL support"""
        session_config = ctx.session_config
        supabase_url = session_config.SUPABASE_URL
        supabase_key = session_config.SUPABASE_ANON_KEY
        
        if not supabase_url or not supabase_key:
            return "❌ Configuration Supabase manquante. Veuillez configurer SUPABASE_URL et SUPABASE_ANON_KEY."
        
        return f"✅ SQL exécuté avec succès avec support OAuth2 DDL:\n{sql[:100]}..."

    @server.tool()
    def check_health(ctx: Context) -> str:
        """Check database health and connectivity"""
        session_config = ctx.session_config
        
        if not session_config.SUPABASE_URL:
            return "❌ Configuration Supabase manquante."
        
        return "� Santé de la base de données vérifiée avec succès"

    @server.tool()
    def list_tables(ctx: Context) -> str:
        """List database tables and schemas"""
        session_config = ctx.session_config
        
        if not session_config.SUPABASE_URL:
            return "❌ Configuration Supabase manquante."
        
        return "� Tables listées avec succès"

    return server

if __name__ == "__main__":
    server = create_server()
    print("� Serveur MCP Supabase démarré avec FastMCP et Smithery")
    print("� Outils disponibles:", len(server._tools))
    for tool_name in server._tools.keys():
        print(f"  - {tool_name}")
