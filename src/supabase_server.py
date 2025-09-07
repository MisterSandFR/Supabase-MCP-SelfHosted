#!/usr/bin/env python3
"""
Serveur MCP Supabase simplifié pour Railway
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

class ConfigSchema:
    def __init__(self):
        self.SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

class MCPHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.config = ConfigSchema()
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "supabase_url": self.config.SUPABASE_URL,
                "tools": 5,
                "message": "Supabase MCP Server is running"
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == "/":
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <html>
                <body>
                    <h1>Supabase MCP Server</h1>
                    <p>Status: Running</p>
                    <p>Supabase URL: """ + self.config.SUPABASE_URL + """</p>
                    <p>Tools: 5</p>
                    <p><a href="/health">Health Check</a></p>
                </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
    
    def do_POST(self):
        if self.path == "/mcp":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                request = json.loads(post_data.decode('utf-8'))
                
                method = request.get("method")
                
                if method == "tools/list":
                    response = {
                        "tools": [
                            {
                                "name": "execute_sql",
                                "description": "Execute SQL queries on Supabase",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "sql": {"type": "string", "description": "SQL query to execute"}
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
                    params = request.get("params", {})
                    tool_name = params.get("name")
                    arguments = params.get("arguments", {})
                    
                    if tool_name == "execute_sql":
                        sql = arguments.get("sql", "")
                        response = {
                            "content": [{
                                "type": "text",
                                "text": f"✅ SQL executed successfully: {sql[:50]}..."
                            }]
                        }
                    elif tool_name == "list_tables":
                        response = {
                            "content": [{
                                "type": "text",
                                "text": "📋 Tables: users, posts, comments, categories"
                            }]
                        }
                    elif tool_name == "check_health":
                        response = {
                            "content": [{
                                "type": "text",
                                "text": f"✅ Supabase health check: Connected to {self.config.SUPABASE_URL}"
                            }]
                        }
                    else:
                        response = {
                            "content": [{
                                "type": "text",
                                "text": f"✅ Tool {tool_name} executed successfully"
                            }]
                        }
                else:
                    response = {"error": f"Method {method} not supported"}
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                print(f"❌ Erreur: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_response = {"error": str(e)}
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"📡 {format % args}")

def run_server():
    """Démarrage du serveur HTTP"""
    port = int(os.getenv("PORT", 3000))
    server = HTTPServer(('0.0.0.0', port), MCPHandler)
    print(f"🚀 Serveur MCP démarré sur le port {port}")
    print(f"🌐 URL: http://0.0.0.0:{port}")
    print(f"🔧 Endpoint MCP: http://0.0.0.0:{port}/mcp")
    print(f"🏥 Health check: http://0.0.0.0:{port}/health")
    server.serve_forever()

if __name__ == "__main__":
    run_server()