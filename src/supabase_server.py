#!/usr/bin/env python3
"""
Serveur MCP Supabase ultra-simple pour test Railway
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

class SimpleMCPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "message": "Supabase MCP Server is running",
                "tools": 5
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == "/":
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <html>
                <head><title>Supabase MCP Server</title></head>
                <body>
                    <h1>🚀 Supabase MCP Server</h1>
                    <p>Status: Running</p>
                    <p>Tools: 5</p>
                    <p><a href="/health">Health Check</a></p>
                    <p><a href="/mcp">MCP Endpoint</a></p>
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
                
                print(f"📨 POST /mcp - Requête: {request}")
                
                method = request.get("method")
                request_id = request.get("id", "test")
                
                if method == "tools/list":
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "tools": [
                                {
                                    "name": "execute_sql",
                                    "description": "Execute SQL queries",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "sql": {"type": "string"}
                                        },
                                        "required": ["sql"]
                                    }
                                },
                                {
                                    "name": "list_tables",
                                    "description": "List tables",
                                    "inputSchema": {"type": "object", "properties": {}}
                                }
                            ]
                        }
                    }
                elif method == "initialize":
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {"tools": {}},
                            "serverInfo": {"name": "supabase-mcp", "version": "1.0.0"}
                        }
                    }
                else:
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {"code": -32601, "message": f"Method {method} not found"}
                    }
                
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
    
    def log_message(self, format, *args):
        print(f"📡 {format % args}")

def run_server():
    port = int(os.getenv("PORT", 3000))
    server = HTTPServer(('0.0.0.0', port), SimpleMCPHandler)
    print(f"🚀 Serveur MCP démarré sur le port {port}")
    print(f"🌐 URL: http://0.0.0.0:{port}")
    print(f"🔧 MCP: http://0.0.0.0:{port}/mcp")
    print(f"🏥 Health: http://0.0.0.0:{port}/health")
    server.serve_forever()

if __name__ == "__main__":
    run_server()