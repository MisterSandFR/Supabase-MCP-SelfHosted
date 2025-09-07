#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur HTTP simple pour Railway healthcheck
Version minimale qui fonctionne à coup sûr
"""

import os
import json
import time
import http.server
import socketserver
from http.server import BaseHTTPRequestHandler

# Handler HTTP pour les healthchecks Railway
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "UP",
                "timestamp": time.time(),
                "service": "Supabase MCP Server",
                "version": "3.1.0",
                "healthcheck": "OK"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html_content = """
            <h1>🚀 Supabase MCP Server</h1>
            <p>✅ Serveur HTTP actif</p>
            <p>🌐 Self-hosted: mcp.coupaul.fr</p>
            <p>📊 Version: 3.1.0</p>
            <p><a href="/health">Health Status</a></p>
            """
            self.wfile.write(html_content.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def log_message(self, format, *args):
        # Supprimer les logs HTTP pour éviter le spam
        pass

def start_server():
    """Démarrer le serveur HTTP pour Railway healthcheck"""
    PORT = int(os.environ.get('PORT', 8000))
    
    print(f"🚀 Démarrage du serveur HTTP pour Railway...")
    print(f"🌐 Port: {PORT}")
    print(f"🔗 Healthcheck: http://localhost:{PORT}/health")
    
    with socketserver.TCPServer(("", PORT), HealthCheckHandler) as httpd:
        print(f"✅ Serveur HTTP actif sur le port {PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    start_server()
