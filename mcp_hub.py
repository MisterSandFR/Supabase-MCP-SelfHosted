#!/usr/bin/env python3
"""
MCP Hub Central - Centre de contrôle multi-serveurs MCP
Découverte automatique, routage intelligent et monitoring centralisé
"""

import os
import json
import time
import http.server
import socketserver
import urllib.request
import urllib.parse
import threading
from http.server import BaseHTTPRequestHandler
from datetime import datetime
from typing import Dict, List, Optional

# Configuration
HUB_VERSION = "1.0.0"
HUB_NAME = "MCP Hub Central"
DISCOVERY_INTERVAL = 30  # secondes

class MCPHubCentral(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.servers_config = self.load_servers_config()
        self.discovered_servers = {}
        self.last_discovery = None
        self.metrics = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "servers_online": 0,
            "servers_offline": 0
        }
        super().__init__(*args, **kwargs)
    
    def load_servers_config(self) -> Dict:
        """Charger la configuration des serveurs MCP"""
        try:
            with open('mcp_servers_config.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return self.get_default_config()
    
    def get_default_config(self) -> Dict:
        """Configuration par défaut"""
        return {
            "hub": {
                "name": HUB_NAME,
                "version": HUB_VERSION,
                "description": "Multi-server MCP hub for centralized management",
                "domain": "mcp.coupaul.fr"
            },
            "servers": {
                "supabase": {
                    "name": "Supabase MCP Server",
                    "version": "3.1.0",
                    "description": "Enhanced Edition v3.1 - 47 MCP tools for Supabase management",
                    "host": "supabase.mcp.coupaul.fr",
                    "port": 443,
                    "protocol": "https",
                    "path": "/supabase",
                    "status": "active",
                    "categories": ["database", "auth", "storage", "realtime", "security"],
                    "github_url": "https://github.com/MisterSandFR/Supabase-MCP-SelfHosted"
                }
            },
            "discovery": {
                "enabled": True,
                "interval": DISCOVERY_INTERVAL,
                "timeout": 5
            }
        }
    
    def discover_servers(self) -> Dict:
        """Découvrir automatiquement les serveurs MCP disponibles"""
        discovered = {}
        
        for server_id, config in self.servers_config["servers"].items():
            if config["status"] != "active":
                continue
                
            try:
                health_url = f"{config['protocol']}://{config['host']}:{config['port']}/health"
                req = urllib.request.Request(health_url)
                
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        config["health_status"] = "online"
                        config["last_seen"] = datetime.now().isoformat()
                        
                        # Récupérer les outils disponibles
                        try:
                            tools_url = f"{config['protocol']}://{config['host']}:{config['port']}/api/tools"
                            tools_req = urllib.request.Request(tools_url)
                            with urllib.request.urlopen(tools_req, timeout=5) as tools_response:
                                if tools_response.status == 200:
                                    tools_data = json.loads(tools_response.read().decode())
                                    config["available_tools"] = len(tools_data)
                                    config["tools"] = tools_data
                        except:
                            config["available_tools"] = config.get("tools_count", 0)
                            config["tools"] = []
                        
                        discovered[server_id] = config
                        self.metrics["servers_online"] += 1
                    else:
                        config["health_status"] = "offline"
                        self.metrics["servers_offline"] += 1
            except Exception as e:
                print(f"Server {server_id} discovery failed: {e}")
                config["health_status"] = "offline"
                config["error"] = str(e)
                self.metrics["servers_offline"] += 1
        
        self.discovered_servers = discovered
        self.last_discovery = datetime.now().isoformat()
        return discovered
    
    def intelligent_routing(self, request_path: str, request_data: Optional[str] = None) -> Optional[Dict]:
        """Routage intelligent basé sur les capacités des serveurs"""
        discovered = self.discover_servers()
        
        # Analyser la requête pour déterminer le meilleur serveur
        if request_data:
            try:
                data = json.loads(request_data) if isinstance(request_data, str) else request_data
                method = data.get("method", "")
                
                # Routage basé sur la méthode JSON-RPC
                if method == "tools/list":
                    return self.aggregate_all_tools(discovered)
                elif method in ["execute_sql", "check_health", "list_tables"]:
                    return self.find_server_by_capability(discovered, "database")
                elif method in ["read_file", "write_file", "list_files"]:
                    return self.find_server_by_capability(discovered, "file_operations")
                elif method in ["git_clone", "git_commit", "git_push"]:
                    return self.find_server_by_capability(discovered, "repository")
                elif method in ["scrape_website", "extract_data"]:
                    return self.find_server_by_capability(discovered, "scraping")
            except:
                pass
        
        # Routage par path
        for server_id, config in discovered.items():
            if request_path.startswith(config["path"]):
                return config
        
        # Routage par défaut vers le serveur principal
        return self.find_server_by_capability(discovered, "database")
    
    def find_server_by_capability(self, servers: Dict, capability: str) -> Optional[Dict]:
        """Trouver le serveur avec la capacité demandée"""
        for server_id, config in servers.items():
            if config.get("health_status") == "online":
                if capability in config.get("categories", []):
                    return config
        # Retourner le premier serveur en ligne si aucun match
        for server_id, config in servers.items():
            if config.get("health_status") == "online":
                return config
        return None
    
    def aggregate_all_tools(self, servers: Dict) -> Dict:
        """Agréger tous les outils de tous les serveurs"""
        all_tools = []
        for server_id, config in servers.items():
            if config.get("health_status") == "online":
                tools = config.get("tools", [])
                for tool in tools:
                    tool["server"] = server_id
                    tool["server_name"] = config["name"]
                    all_tools.append(tool)
        return {"tools": all_tools, "total": len(all_tools)}
    
    def proxy_to_server(self, server_config: Dict, method: str):
        """Proxy la requête vers le serveur MCP approprié"""
        try:
            target_url = f"{server_config['protocol']}://{server_config['host']}:{server_config['port']}"
            
            # Adapter le path pour le serveur cible
            if self.path.startswith(server_config["path"]):
                target_path = self.path[len(server_config["path"]):] or "/"
            else:
                target_path = self.path
            
            full_url = f"{target_url}{target_path}"
            print(f"Proxying {method} request to: {full_url}")
            
            # Préparer la requête
            if method == 'GET':
                req = urllib.request.Request(full_url)
            elif method == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length) if content_length > 0 else None
                req = urllib.request.Request(full_url, data=post_data)
                req.add_header('Content-Type', self.headers.get('Content-Type', 'application/json'))
            
            # Copier les headers importants
            for header in ['Authorization', 'User-Agent', 'Accept']:
                if header in self.headers:
                    req.add_header(header, self.headers[header])
            
            # Faire la requête
            with urllib.request.urlopen(req, timeout=30) as response:
                # Copier les headers de réponse
                for header, value in response.headers.items():
                    if header.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(header, value)
                
                self.send_response(response.status)
                self.end_headers()
                
                # Copier le body de réponse
                self.wfile.write(response.read())
                
                self.metrics["successful_requests"] += 1
                
        except Exception as e:
            print(f"Proxy error: {e}")
            self.metrics["failed_requests"] += 1
            self.send_error_response(502, f"Bad Gateway: {str(e)}")
    
    def do_GET(self):
        try:
            self.metrics["total_requests"] += 1
            print(f"GET request to: {self.path}")
            
            # Routage intelligent vers les serveurs MCP
            routed_server = self.intelligent_routing(self.path)
            if routed_server and self.path.startswith(routed_server["path"]):
                self.proxy_to_server(routed_server, 'GET')
                return
            
            # Endpoints du hub central
            if self.path == '/health':
                self.send_health_response()
            elif self.path == '/api/servers':
                self.send_servers_api()
            elif self.path == '/api/discovery':
                self.send_discovery_api()
            elif self.path == '/api/metrics':
                self.send_metrics_api()
            elif self.path == '/':
                self.send_hub_page()
            else:
                self.send_404_response()
        except Exception as e:
            print(f"Error in GET {self.path}: {e}")
            self.metrics["failed_requests"] += 1
            self.send_error_response(500, str(e))
    
    def do_POST(self):
        try:
            self.metrics["total_requests"] += 1
            print(f"POST request to: {self.path}")
            
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8', errors='ignore') if content_length > 0 else ""
            
            # Routage intelligent vers les serveurs MCP
            routed_server = self.intelligent_routing(self.path, post_data)
            if routed_server and self.path.startswith(routed_server["path"]):
                self.proxy_to_server(routed_server, 'POST')
                return
            
            # Endpoints du hub central
            if self.path == '/mcp' or self.path.startswith('/mcp?'):
                self.handle_jsonrpc_request(post_data)
            elif self.path == '/.well-known/mcp-config':
                self.send_mcp_config()
            else:
                self.send_404_response()
        except Exception as e:
            print(f"Error in POST {self.path}: {e}")
            self.metrics["failed_requests"] += 1
            self.send_error_response(500, str(e))
    
    def send_health_response(self):
        """Health check du hub central"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        
        uptime = time.time() - start_time
        health_data = {
            "status": "healthy",
            "hub": self.servers_config["hub"],
            "uptime": uptime,
            "servers_discovered": len(self.discovered_servers),
            "servers_online": len([s for s in self.discovered_servers.values() if s.get("health_status") == "online"]),
            "last_discovery": self.last_discovery,
            "timestamp": datetime.now().isoformat()
        }
        
        self.wfile.write(json.dumps(health_data, indent=2).encode())
    
    def send_discovery_api(self):
        """API de découverte des serveurs MCP"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        discovered_servers = self.discover_servers()
        discovery_data = {
            "hub": self.servers_config["hub"],
            "servers": discovered_servers,
            "total_servers": len(discovered_servers),
            "online_servers": len([s for s in discovered_servers.values() if s.get("health_status") == "online"]),
            "total_tools": sum(s.get("available_tools", 0) for s in discovered_servers.values()),
            "last_discovery": self.last_discovery,
            "discovery_config": self.servers_config["discovery"]
        }
        
        self.wfile.write(json.dumps(discovery_data, indent=2).encode())
    
    def send_servers_api(self):
        """API des serveurs MCP avec découverte automatique"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        discovered_servers = self.discover_servers()
        servers = []
        
        for server_id, config in discovered_servers.items():
            server_info = {
                "id": server_id,
                "name": config["name"],
                "version": config["version"],
                "description": config["description"],
                "path": config["path"],
                "status": config.get("health_status", "unknown"),
                "tools_count": config.get("available_tools", config.get("tools_count", 0)),
                "categories": config.get("categories", []),
                "github_url": config.get("github_url", ""),
                "last_seen": config.get("last_seen", ""),
                "error": config.get("error", None)
            }
            servers.append(server_info)
        
        self.wfile.write(json.dumps(servers, indent=2).encode())
    
    def send_metrics_api(self):
        """API des métriques du hub"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        metrics_data = {
            "hub": self.servers_config["hub"],
            "metrics": self.metrics,
            "servers": {
                "total": len(self.discovered_servers),
                "online": len([s for s in self.discovered_servers.values() if s.get("health_status") == "online"]),
                "offline": len([s for s in self.discovered_servers.values() if s.get("health_status") == "offline"])
            },
            "timestamp": datetime.now().isoformat()
        }
        
        self.wfile.write(json.dumps(metrics_data, indent=2).encode())
    
    def send_hub_page(self):
        """Page d'accueil du hub central"""
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        discovered_servers = self.discover_servers()
        online_servers = len([s for s in discovered_servers.values() if s.get("health_status") == "online"])
        total_tools = sum(s.get("available_tools", 0) for s in discovered_servers.values())
        
        html_content = f"""
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{HUB_NAME}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root {{
            --background: 222.2 84% 4.9%;
            --foreground: 210 40% 98%;
            --primary: 217.2 91.2% 59.8%;
        }}
        .gradient-bg {{
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        }}
    </style>
</head>
<body class="min-h-screen gradient-bg">
    <div class="container mx-auto px-4 py-8">
        <header class="text-center mb-12">
            <h1 class="text-5xl font-bold text-white mb-4">🚀 {HUB_NAME}</h1>
            <p class="text-xl text-white/90 mb-6">Centre de contrôle multi-serveurs MCP</p>
            <div class="flex justify-center space-x-4">
                <span class="bg-green-600 px-3 py-1 rounded-full text-sm">{online_servers} Serveurs</span>
                <span class="bg-blue-600 px-3 py-1 rounded-full text-sm">{total_tools} Outils</span>
                <span class="bg-purple-600 px-3 py-1 rounded-full text-sm">En ligne</span>
            </div>
        </header>
        
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 class="text-xl font-semibold text-white mb-4">🔍 Découverte</h3>
                <p class="text-white/80 mb-4">Découverte automatique des serveurs MCP disponibles</p>
                <div class="text-sm text-white/60">
                    <div>Dernière découverte: {self.last_discovery or 'Jamais'}</div>
                    <div>Serveurs configurés: {len(self.servers_config['servers'])}</div>
                </div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 class="text-xl font-semibold text-white mb-4">🧠 Routage Intelligent</h3>
                <p class="text-white/80 mb-4">Routage automatique vers le serveur approprié</p>
                <div class="text-sm text-white/60">
                    <div>Basé sur les capacités</div>
                    <div>Load balancing automatique</div>
                </div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 class="text-xl font-semibold text-white mb-4">📊 Monitoring</h3>
                <p class="text-white/80 mb-4">Surveillance centralisée de tous les serveurs</p>
                <div class="text-sm text-white/60">
                    <div>Métriques en temps réel</div>
                    <div>Alertes automatiques</div>
                </div>
            </div>
        </div>
        
        <div class="mt-12">
            <h2 class="text-2xl font-semibold text-white mb-6 text-center">Serveurs MCP Découverts</h2>
            <div class="grid md:grid-cols-2 gap-6">
"""
        
        for server_id, config in discovered_servers.items():
            status_color = "green" if config.get("health_status") == "online" else "red"
            status_text = "En ligne" if config.get("health_status") == "online" else "Hors ligne"
            
            html_content += f"""
                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-semibold text-white">{config['name']}</h3>
                        <span class="bg-{status_color}-600 px-2 py-1 rounded text-sm">{status_text}</span>
                    </div>
                    <p class="text-white/80 mb-4">{config['description']}</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-white/60">Version:</div>
                            <div class="text-white">{config['version']}</div>
                        </div>
                        <div>
                            <div class="text-white/60">Outils:</div>
                            <div class="text-white">{config.get('available_tools', 0)}</div>
                        </div>
                        <div>
                            <div class="text-white/60">Path:</div>
                            <div class="text-white">{config['path']}</div>
                        </div>
                        <div>
                            <div class="text-white/60">Dernière vue:</div>
                            <div class="text-white">{config.get('last_seen', 'Jamais')}</div>
                        </div>
                    </div>
                </div>
"""
        
        html_content += """
            </div>
        </div>
        
        <footer class="mt-12 text-center">
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                <p class="text-white/80 text-lg font-medium mb-2">🚀 MCP Hub Central v""" + HUB_VERSION + """</p>
                <p class="text-white/60 text-sm">Multi-server MCP hub for centralized management</p>
                <p class="text-white/50 text-xs mt-2">Déployé sur mcp.coupaul.fr | Compatible Smithery</p>
            </div>
        </footer>
    </div>
</body>
</html>
        """
        
        self.wfile.write(html_content.encode('utf-8'))
    
    def handle_jsonrpc_request(self, request_data: str):
        """Gérer les requêtes JSON-RPC"""
        try:
            data = json.loads(request_data)
            method = data.get("method", "")
            request_id = data.get("id")
            
            print(f"JSON-RPC method: {method}, id: {request_id}")
            
            if method == "initialize":
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "protocolVersion": "2025-06-18",
                        "capabilities": {
                            "tools": {},
                            "resources": {},
                            "prompts": {}
                        },
                        "serverInfo": {
                            "name": HUB_NAME,
                            "version": HUB_VERSION,
                            "description": "Multi-server MCP hub for centralized management"
                        }
                    }
                }
            elif method == "tools/list":
                discovered_servers = self.discover_servers()
                aggregated_tools = self.aggregate_all_tools(discovered_servers)
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": aggregated_tools
                }
            elif method == "ping":
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {}
                }
            elif method == "notifications/initialized":
                # Pas de réponse pour les notifications
                return
            elif method == "resources/list":
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {"resources": []}
                }
            elif method == "prompts/list":
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {"prompts": []}
                }
            else:
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            if response:
                print(f"JSON-RPC response: {json.dumps(response, indent=2)}")
                self.wfile.write(json.dumps(response).encode())
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            self.send_error_response(400, "Invalid JSON")
        except Exception as e:
            print(f"JSON-RPC error: {e}")
            self.send_error_response(500, str(e))
    
    def send_mcp_config(self):
        """Configuration MCP pour Smithery"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        config = {
            "mcpServers": {
                "mcp-hub-central": {
                    "command": "python",
                    "args": ["mcp_hub.py"],
                    "env": {
                        "PORT": "8000"
                    }
                }
            }
        }
        
        self.wfile.write(json.dumps(config, indent=2).encode())
    
    def send_404_response(self):
        """Réponse 404"""
        print(f"404 - Path not found: {self.path}")
        self.send_response(404)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(f"<h1>404 - Page not found</h1><p>Path: {self.path}</p><p><a href='/'>Back to hub</a></p>".encode())
    
    def send_error_response(self, status_code: int, message: str):
        """Réponse d'erreur"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        error_response = {
            "error": {
                "code": status_code,
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        self.wfile.write(json.dumps(error_response).encode())
    
    def log_message(self, format, *args):
        pass

def create_server():
    """Fonction pour Smithery - Créer le serveur MCP"""
    return MCPHubCentral

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 8000))
    start_time = time.time()
    
    print(f"🚀 Starting {HUB_NAME} on port {PORT}")
    print(f"🔍 Discovery enabled: {DISCOVERY_INTERVAL}s interval")
    print(f"🌐 Access at: http://localhost:{PORT}")
    print(f"📊 API endpoints: /api/servers, /api/discovery, /api/metrics")
    
    with socketserver.TCPServer(("", PORT), MCPHubCentral) as httpd:
        print(f"✅ {HUB_NAME} running on port {PORT}")
        httpd.serve_forever()
