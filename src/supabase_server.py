#!/usr/bin/env python3
"""
Serveur MCP Supabase ultra-minimal pour test Smithery
"""

import asyncio
import json
from typing import Any, Dict, List

async def main():
    """Serveur MCP minimal pour test"""
    
    # Configuration MCP de base
    config = {
        "name": "supabase-mcp-minimal",
        "version": "1.0.0",
        "description": "Serveur MCP Supabase minimal pour test"
    }
    
    # Outils disponibles
    tools = [
        {
            "name": "test_connection",
            "description": "Test de connexion Supabase",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL Supabase"}
                },
                "required": ["url"]
            }
        }
    ]
    
    print(json.dumps({"config": config, "tools": tools}, indent=2))

if __name__ == "__main__":
    asyncio.run(main())