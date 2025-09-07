#!/usr/bin/env python3
"""
Redirection vers main.py pour Railway
Railway essaie d'exécuter src/supabase_server.py, on le redirige vers main.py
"""

import os
import sys
import subprocess

# Changer vers le répertoire parent
os.chdir('/app')

# Exécuter main.py
try:
    subprocess.run([sys.executable, 'main.py'], check=True)
except subprocess.CalledProcessError as e:
    print(f"Erreur lors de l'exécution de main.py: {e}")
    sys.exit(1)
except FileNotFoundError:
    print("main.py non trouvé, tentative de création d'un serveur HTTP simple...")
    
    # Créer un serveur HTTP simple en cas d'urgence
    import http.server
    import socketserver
    import json
    import time
    from http.server import BaseHTTPRequestHandler
    
    class EmergencyHandler(BaseHTTPRequestHandler):
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
                self.wfile.write(b"<h1>Supabase MCP Server</h1><p>Emergency Mode</p>")
        
        def log_message(self, format, *args):
            pass
    
    PORT = int(os.environ.get('PORT', 8000))
    print(f"Starting emergency server on port {PORT}")
    
    with socketserver.TCPServer(("", PORT), EmergencyHandler) as httpd:
        httpd.serve_forever()