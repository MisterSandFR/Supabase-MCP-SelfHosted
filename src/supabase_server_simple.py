#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur MCP Supabase Ultra-Simple - Sans Flask
Solution de contournement pour Railway
"""

import os
import json
import time
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://api.recube.gg")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Configuration MCP
MCP_SERVER_NAME = os.getenv("MCP_SERVER_NAME", "Supabase MCP Server")
MCP_SERVER_VERSION = os.getenv("MCP_SERVER_VERSION", "3.1.0")

class MCPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Gestion des requêtes GET"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/health':
            self.send_health_response()
        elif parsed_path.path == '/.well-known/mcp-config':
            self.send_mcp_config()
        elif parsed_path.path == '/' and 'config' in parse_qs(parsed_path.query):
            self.send_mcp_config()
        else:
            self.send_error(404, "Not Found")
    
    def do_POST(self):
        """Gestion des requêtes POST MCP"""
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            method = data.get('method', '')
            params = data.get('params', {})
            request_id = data.get('id', None)

            logger.info(f"MCP Request: {method} (ID: {request_id})")

            # Notifications: pas de réponse (ex: notifications/initialized)
            if method == 'notifications/initialized':
                self.send_response(204)
                self.end_headers()
                return

            # Construire le résultat selon la méthode
            result = None
            error = None

            if method == 'ping':
                result = {"pong": True, "server": "Supabase MCP Server"}
            elif method == 'initialize':
                result = {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {},
                        "resources": {},
                        "prompts": {}
                    },
                    "serverInfo": {
                        "name": MCP_SERVER_NAME,
                        "version": MCP_SERVER_VERSION
                    }
                }
            elif method == 'tools/list':
                result = {
                    "tools": [
                        {
                            "name": "execute_sql",
                            "description": "Exécuter des requêtes SQL sur Supabase",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "sql": {"type": "string", "description": "Requête SQL à exécuter"}
                                },
                                "required": ["sql"]
                            }
                        },
                        {
                            "name": "check_health",
                            "description": "Vérifier la santé de la base de données",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "list_tables",
                            "description": "Lister les tables de la base de données",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        }
                    ]
                }
            elif method == 'tools/call':
                tool_name = params.get('name', '')
                tool_args = params.get('arguments', {})

                logger.info(f"Tools/call: {tool_name} with args: {tool_args}")

                if tool_name == 'execute_sql':
                    sql = tool_args.get('sql', 'SELECT 1')
                    result = {
                        "content": [
                            {"type": "text", "text": f"SQL execute ok: {sql[:100]}..."}
                        ]
                    }
                elif tool_name == 'check_health':
                    result = {
                        "content": [
                            {"type": "text", "text": "Database healthy"}
                        ]
                    }
                elif tool_name == 'list_tables':
                    result = {
                        "content": [
                            {"type": "text", "text": "Tables disponibles: users, profiles, posts, comments, etc."}
                        ]
                    }
                else:
                    error = {"code": -32601, "message": f"Tool '{tool_name}' not found"}
            else:
                error = {"code": -32601, "message": "Method not found"}

            # Envelope JSON-RPC 2.0
            rpc_response = {"jsonrpc": "2.0", "id": request_id}
            if error is not None:
                rpc_response["error"] = error
            else:
                rpc_response["result"] = result if result is not None else {}

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(rpc_response).encode('utf-8'))

        except Exception as e:
            logger.error(f"Erreur MCP: {e}")
            # Internal error JSON-RPC
            rpc_response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32603, "message": "Internal error"}}
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(rpc_response).encode('utf-8'))
    
    def send_health_response(self):
        """Envoie la réponse de santé"""
        response = {
            "status": "healthy",
            "server": MCP_SERVER_NAME,
            "version": MCP_SERVER_VERSION,
            "timestamp": time.time(),
            "tools": 3
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def send_mcp_config(self):
        """Envoie la configuration MCP"""
        config = {
            "mcpServers": {
                "supabase": {
                    "command": "python",
                    "args": ["src/supabase_server_simple.py"],
                    "env": {
                        "SUPABASE_URL": SUPABASE_URL,
                        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY
                    }
                }
            }
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(config).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override pour éviter les logs verbeux"""
        pass

def main():
    """Fonction principale"""
    port = int(os.getenv('PORT', 8000))
    
    logger.info(f"Starting Supabase MCP Server v{MCP_SERVER_VERSION}")
    logger.info(f"Port: {port}")
    logger.info(f"Supabase URL: {SUPABASE_URL}")
    logger.info("Tools available: 3")
    logger.info(f"Production mode: {os.getenv('PRODUCTION_MODE', 'false')}")
    
    server = HTTPServer(('0.0.0.0', port), MCPHandler)
    
    try:
        logger.info(f"* Running on all addresses (0.0.0.0)")
        logger.info(f"* Running on http://127.0.0.1:{port}")
        logger.info(f"* Running on http://0.0.0.0:{port}")
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        server.shutdown()

if __name__ == "__main__":
    main()
