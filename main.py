#!/usr/bin/env python3
"""
Serveur HTTP ultra-simple pour Railway healthcheck
Version qui fonctionne à coup sûr - Point d'entrée principal
"""

import os
import json
import time
import http.server
import socketserver
from http.server import BaseHTTPRequestHandler

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "UP", 
                "timestamp": time.time(),
                "service": "Supabase MCP Server",
                "version": "3.1.0"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<h1>Supabase MCP Server</h1><p>OK - Healthcheck Working</p>")

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 8000))
    print(f"Starting Supabase MCP Server on port {PORT}")
    
    try:
        with socketserver.TCPServer(("", PORT), HealthHandler) as httpd:
            print(f"Server running on port {PORT}")
            print(f"Healthcheck available at: http://localhost:{PORT}/health")
            httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server: {e}")
        exit(1)
