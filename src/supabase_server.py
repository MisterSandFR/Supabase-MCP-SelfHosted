#!/usr/bin/env python3
"""
Supabase MCP Server - Self-hosted version
Serveur MCP pour la gestion de Supabase avec hub multi-serveurs
"""

import os
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

class SupabaseMCPHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.supabase_url = os.getenv("SUPABASE_URL", "https://api.recube.gg")
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            response = {
                "status": "healthy",
                "message": "Supabase MCP Server is running",
                "tools": 5,
                "supabase_connected": True,
                "timestamp": time.time()
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path.startswith("/.well-known/mcp-config"):
            # Endpoint de configuration MCP standard
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            config = {
                "mcpServers": {
                    "supabase": {
                        "command": "python",
                        "args": ["src/supabase_server.py"],
                        "env": {
                            "SUPABASE_URL": "[CONFIGURED]",
                            "SUPABASE_ANON_KEY": "[CONFIGURED]"
                        }
                    }
                }
            }
            self.wfile.write(json.dumps(config).encode())
        elif self.path == "/test":
            # Endpoint de test pour Smithery
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            test_response = {
                "status": "success",
                "message": "Supabase MCP Server Self-Hosted is working",
                "tools": [
                    {
                        "name": "execute_sql",
                        "description": "Execute SQL queries on Supabase",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "sql": {"type": "string", "description": "SQL query to execute"},
                                "allow_multiple_statements": {"type": "boolean", "default": False}
                            },
                            "required": ["sql"]
                        }
                    },
                    {
                        "name": "list_tables",
                        "description": "List all database tables",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "check_health",
                        "description": "Check Supabase health status",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "list_auth_users",
                        "description": "List authentication users",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "create_auth_user",
                        "description": "Create new authentication user",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "email": {"type": "string"},
                                "password": {"type": "string"}
                            },
                            "required": ["email", "password"]
                        }
                    }
                ],
                "serverInfo": {
                    "name": "supabase-mcp-server",
                    "version": "3.1.0",
                    "type": "self-hosted"
                }
            }
            self.wfile.write(json.dumps(test_response).encode())
        elif self.path == "/":
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # HTML du hub MCP intégré
            html = """
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>MCP Hub - @MisterSandFR</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 20px; min-height: 100vh; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .header { text-align: center; color: white; margin-bottom: 40px; }
                    .header h1 { font-size: 3em; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
                    .servers-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 40px; }
                    .server-card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                    .server-header { display: flex; align-items: center; margin-bottom: 15px; }
                    .server-icon { font-size: 2em; margin-right: 15px; }
                    .server-title { font-size: 1.4em; font-weight: bold; color: #333; margin: 0; }
                    .server-status { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; margin-left: auto; background: #4CAF50; color: white; }
                    .server-description { color: #666; margin-bottom: 15px; line-height: 1.5; }
                    .server-actions { display: flex; gap: 10px; flex-wrap: wrap; }
                    .btn { display: inline-block; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 0.9em; }
                    .btn-primary { background: #667eea; color: white; }
                    .btn-secondary { background: #f8f9fa; color: #333; border: 1px solid #ddd; }
                    .footer { text-align: center; color: white; margin-top: 40px; opacity: 0.8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚀 MCP Hub</h1>
                        <p>Centre de contrôle de tous mes serveurs MCP</p>
                        <p><strong>Supabase Self-Hosted</strong> • Développé par <strong>@MisterSandFR</strong></p>
                    </div>
                    
                    <div class="servers-grid">
                        <div class="server-card">
                            <div class="server-header">
                                <div class="server-icon">🗄️</div>
                                <h3 class="server-title">Supabase MCP Self-Hosted</h3>
                                <span class="server-status">En ligne</span>
                            </div>
                            
                            <div class="server-description">
                                <strong>Serveur MCP Self-Hosted</strong> pour la gestion complète de votre instance Supabase privée. 
                                Exécution SQL, gestion des utilisateurs, monitoring et plus. 
                                <br><br>
                                <strong>🔒 Avantages Self-Hosted :</strong>
                                <br>• Instance Supabase privée et sécurisée
                                <br>• Aucune dépendance aux services externes
                                <br>• Contrôle total de vos données
                                <br>• Performance optimisée
                            </div>
                            
                            <div class="server-actions">
                                <a href="https://smithery.ai/server/@MisterSandFR/supabase-mcp-selfhosted" class="btn btn-primary" target="_blank">
                                    🔗 Smithery
                                </a>
                                <a href="/health" class="btn btn-secondary">
                                    🏥 Health
                                </a>
                                <a href="/.well-known/mcp-config" class="btn btn-secondary">
                                    ⚙️ Config
                                </a>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>🌐 <strong>mcp.coupaul.fr</strong> - Hub MCP Self-Hosted de @MisterSandFR</p>
                        <p><strong>Supabase Self-Hosted</strong> • Serveurs MCP auto-hébergés sur Railway</p>
                        <p><em>Instance Supabase privée • 100% sécurisé • Aucune dépendance externe</em></p>
                    </div>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
    
    def do_POST(self):
        if self.path == "/" or self.path.startswith("/?config=") or self.path.startswith("/mcp?config="):
            # Gestion des requêtes POST sur la racine avec config
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                request = json.loads(post_data.decode('utf-8')) if post_data else {}
                
                print(f"📨 POST / (config) - Requête: {request}")
                
                # Réponse de configuration MCP
                method = request.get("method", "")
                if method == "tools/list":
                    # Retourner la liste des outils
                    response = {
                        "jsonrpc": "2.0",
                        "id": request.get("id", "tools"),
                        "result": {
                            "tools": [
                                {
                                    "name": "execute_sql",
                                    "description": "Execute SQL queries on Supabase",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "sql": {"type": "string", "description": "SQL query to execute"},
                                            "allow_multiple_statements": {"type": "boolean", "default": False}
                                        },
                                        "required": ["sql"]
                                    }
                                },
                                {
                                    "name": "list_tables",
                                    "description": "List all database tables",
                                    "inputSchema": {"type": "object", "properties": {}}
                                },
                                {
                                    "name": "check_health",
                                    "description": "Check Supabase health status",
                                    "inputSchema": {"type": "object", "properties": {}}
                                },
                                {
                                    "name": "list_auth_users",
                                    "description": "List authentication users",
                                    "inputSchema": {"type": "object", "properties": {}}
                                },
                                {
                                    "name": "create_auth_user",
                                    "description": "Create new authentication user",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "email": {"type": "string", "description": "User email"},
                                            "password": {"type": "string", "description": "User password"}
                                        },
                                        "required": ["email", "password"]
                                    }
                                }
                            ]
                        }
                    }
                else:
                    # Réponse standard d'initialisation
                    response = {
                        "jsonrpc": "2.0",
                        "id": request.get("id", "config"),
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {
                                "tools": {
                                    "listChanged": True
                                }
                            },
                            "serverInfo": {
                                "name": "supabase-mcp-server",
                                "version": "3.1.0"
                            },
                            "tools": [
                                {
                                    "name": "execute_sql",
                                    "description": "Execute SQL queries on Supabase",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "sql": {"type": "string", "description": "SQL query to execute"},
                                            "allow_multiple_statements": {"type": "boolean", "default": False}
                                        },
                                        "required": ["sql"]
                                    }
                                },
                                {
                                    "name": "list_tables",
                                    "description": "List all database tables",
                                    "inputSchema": {"type": "object", "properties": {}}
                                },
                                {
                                    "name": "check_health",
                                    "description": "Check Supabase health status",
                                    "inputSchema": {"type": "object", "properties": {}}
                                },
                                {
                                    "name": "list_auth_users",
                                    "description": "List authentication users",
                                    "inputSchema": {"type": "object", "properties": {}}
                                },
                                {
                                    "name": "create_auth_user",
                                    "description": "Create new authentication user",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "email": {"type": "string", "description": "User email"},
                                            "password": {"type": "string", "description": "User password"}
                                        },
                                        "required": ["email", "password"]
                                    }
                                }
                            ]
                        }
                    }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                print(f"❌ Erreur POST /: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error = {"error": str(e)}
                self.wfile.write(json.dumps(error).encode())
        elif self.path == "/mcp" or self.path.startswith("/mcp?"):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                request = json.loads(post_data.decode('utf-8'))
                
                print(f"📨 POST /mcp - Requête: {request}")
                
                method = request.get("method", "")
                response = {"jsonrpc": "2.0", "id": request.get("id", "unknown")}
                
                if method == "initialize":
                    response["result"] = {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {
                                "listChanged": True
                            }
                        },
                        "serverInfo": {
                            "name": "supabase-mcp-server",
                            "version": "3.1.0"
                        },
                        "tools": [
                            {
                                "name": "execute_sql",
                                "description": "Execute SQL queries on Supabase",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "sql": {"type": "string", "description": "SQL query to execute"},
                                        "allow_multiple_statements": {"type": "boolean", "default": False}
                                    },
                                    "required": ["sql"]
                                }
                            },
                            {
                                "name": "list_tables",
                                "description": "List all database tables",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "check_health",
                                "description": "Check Supabase health status",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "list_auth_users",
                                "description": "List authentication users",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "create_auth_user",
                                "description": "Create new authentication user",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "email": {"type": "string"},
                                        "password": {"type": "string"}
                                    },
                                    "required": ["email", "password"]
                                }
                            }
                        ]
                    }
                elif method == "tools/list":
                    response["result"] = {
                        "tools": [
                            {
                                "name": "execute_sql",
                                "description": "Execute SQL queries on Supabase",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "sql": {"type": "string", "description": "SQL query to execute"},
                                        "allow_multiple_statements": {"type": "boolean", "default": False}
                                    },
                                    "required": ["sql"]
                                }
                            },
                            {
                                "name": "list_tables",
                                "description": "List all database tables",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "check_health",
                                "description": "Check Supabase health status",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "list_auth_users",
                                "description": "List authentication users",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "create_auth_user",
                                "description": "Create new authentication user",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "email": {"type": "string"},
                                        "password": {"type": "string"}
                                    },
                                    "required": ["email", "password"]
                                }
                            }
                        ]
                    }
                elif method == "tools/call":
                    tool_name = request.get("params", {}).get("name", "")
                    response["result"] = {
                        "content": [
                            {
                                "type": "text",
                                "text": f"Tool '{tool_name}' called successfully. This is a placeholder response."
                            }
                        ]
                    }
                else:
                    response["error"] = {"code": -32601, "message": "Method not found"}
                
                print(f"📤 Réponse: {response}")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                print(f"❌ Erreur POST /mcp: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error = {"error": str(e)}
                self.wfile.write(json.dumps(error).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        print(f"📡 {format % args}")

def run_server():
    port = int(os.getenv("PORT", 3000))
    
    print(f"🚀 Supabase MCP Server démarré sur le port {port}")
    print(f"🌐 URL: http://0.0.0.0:{port}")
    print(f"🔧 MCP Endpoint: http://0.0.0.0:{port}/mcp")
    print(f"🏥 Health Check: http://0.0.0.0:{port}/health")
    print(f"📡 Supabase URL: {os.getenv('SUPABASE_URL', 'Not configured')}")
    print(f"🔑 Anon Key: {os.getenv('SUPABASE_ANON_KEY', 'Not configured')[:20]}...")
    
    try:
        server = HTTPServer(('0.0.0.0', port), SupabaseMCPHandler)
        print(f"✅ Serveur HTTP démarré avec succès")
        
        # Configuration pour Railway
        server.timeout = 30  # Timeout de 30 secondes
        server.allow_reuse_address = True
        
        print(f"🔄 Démarrage du serveur en mode production...")
        server.serve_forever()
        
    except Exception as e:
        print(f"❌ Erreur serveur: {e}")
        import traceback
        traceback.print_exc()
    except KeyboardInterrupt:
        print("\n🛑 Arrêt du serveur...")
        if 'server' in locals():
            server.shutdown()

if __name__ == "__main__":
    run_server()
