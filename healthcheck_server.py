#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur HTTP simple pour Railway Healthcheck
Ce serveur répond aux healthchecks Railway et redirige vers le serveur MCP
"""

import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
import time

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            # Healthcheck Railway
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "Supabase MCP OAuth2 v3.1.0 - Self-Hosted",
                "version": "3.1.0",
                "timestamp": time.time(),
                "mcp_server": "active"
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/':
            # Page d'accueil
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Supabase MCP OAuth2 v3.1.0 - Self-Hosted</title>
                <meta charset="utf-8">
            </head>
            <body>
                <h1>🚀 Supabase MCP OAuth2 v3.1.0 - Self-Hosted</h1>
                <p>✅ Serveur MCP actif et fonctionnel</p>
                <p>🌐 Déployé sur: mcp.coupaul.fr</p>
                <p>📁 Repository: <a href="https://github.com/MisterSandFR/Supabase-MCP-SelfHosted">GitHub</a></p>
                <p>🛠️ Outils disponibles: 8</p>
                <ul>
                    <li>ping - Test ping simple</li>
                    <li>test_connection - Test de connexion MCP</li>
                    <li>get_server_info - Informations du serveur</li>
                    <li>get_capabilities - Capacités du serveur</li>
                    <li>smithery_scan_test - Test de scan Smithery</li>
                    <li>execute_sql - Exécution SQL avec OAuth2 DDL</li>
                    <li>check_health - Vérification santé base de données</li>
                    <li>list_tables - Liste des tables et schémas</li>
                </ul>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            # 404 pour les autres chemins
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"error": "Not found", "path": self.path}
            self.wfile.write(json.dumps(response).encode())
    
    def log_message(self, format, *args):
        # Désactiver les logs HTTP pour réduire le bruit
        pass

def start_http_server():
    """Démarrer le serveur HTTP pour les healthchecks Railway"""
    port = int(os.environ.get('PORT', 8000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"🌐 Serveur HTTP démarré sur le port {port}")
    print(f"✅ Healthcheck disponible sur: http://0.0.0.0:{port}/health")
    server.serve_forever()

if __name__ == "__main__":
    print("🚀 Démarrage du serveur HTTP pour Railway Healthcheck...")
    start_http_server()
