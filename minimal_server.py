#!/usr/bin/env python3
"""
Serveur HTTP ultra-simple pour Railway healthcheck
Version minimale qui fonctionne à coup sûr
"""

import os
import json
import time
import http.server
import socketserver
from http.server import BaseHTTPRequestHandler

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"status": "UP", "timestamp": time.time()}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<h1>Supabase MCP Server</h1><p>OK</p>")

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 8000))
    print(f"Starting server on port {PORT}")
    
    with socketserver.TCPServer(("", PORT), SimpleHandler) as httpd:
        print(f"Server running on port {PORT}")
        httpd.serve_forever()
