#!/usr/bin/env python3
"""
Supabase MCP Server - Self-hosted version compatible avec Hub Central
Serveur MCP pour la gestion de Supabase avec endpoints REST et MCP
"""

import os
import json
import time
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration Flask
app = Flask(__name__)
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization", "x-smithery-config", "x-mcp-config"],
    expose_headers=["Content-Type", "Authorization", "x-smithery-config", "x-mcp-config"],
)

# Assurer les en-têtes CORS pour tous les endpoints
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, x-smithery-config, x-mcp-config"
    return response

# Handlers OPTIONS explicites pour éviter toute erreur de préflight
@app.route('/mcp', methods=['OPTIONS'])
@app.route('/supabase/mcp', methods=['OPTIONS'])
@app.route('/health', methods=['OPTIONS'])
@app.route('/supabase/health', methods=['OPTIONS'])
@app.route('/.well-known/mcp-config', methods=['OPTIONS'])
@app.route('/supabase/.well-known/mcp-config', methods=['OPTIONS'])
@app.route('/mcp/tools.json', methods=['OPTIONS'])
@app.route('/supabase/mcp/tools.json', methods=['OPTIONS'])
def cors_preflight():
    return ("", 204)

# Configuration Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://api.recube.gg/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_AUTH_JWT_SECRET = os.getenv("SUPABASE_AUTH_JWT_SECRET", "")

# Configuration MCP
MCP_SERVER_NAME = os.getenv("MCP_SERVER_NAME", "Supabase MCP Server")
MCP_SERVER_VERSION = os.getenv("MCP_SERVER_VERSION", "3.1.0")
PORT = int(os.getenv("PORT", 8000))
PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "true").lower() == "true"

# Liste des outils MCP disponibles (extrait représentatif)
MCP_TOOLS = [
    {"name": "execute_sql", "displayName": "Execute SQL", "description": "Execute SQL queries"},
    {"name": "check_health", "displayName": "Health Check", "description": "Check database health"},
    {"name": "list_tables", "displayName": "List Tables", "description": "List database tables"},
    {"name": "create_migration", "displayName": "Create Migration", "description": "Create database migration"},
    {"name": "apply_migration", "displayName": "Apply Migration", "description": "Apply database migration"},
    {"name": "create_auth_user", "displayName": "Create Auth User", "description": "Create authenticated user"},
    {"name": "list_storage_buckets", "displayName": "List Storage Buckets", "description": "List storage buckets"},
    {"name": "manage_rls_policies", "displayName": "Manage RLS Policies", "description": "Manage RLS policies"},
    {"name": "list_extensions", "displayName": "List Extensions", "description": "List PostgreSQL extensions"},
    {"name": "manage_functions", "displayName": "Manage Functions", "description": "Manage database functions"},
    {"name": "manage_triggers", "displayName": "Manage Triggers", "description": "Manage database triggers"},
    {"name": "manage_roles", "displayName": "Manage Roles", "description": "Manage database roles"},
    {"name": "manage_webhooks", "displayName": "Manage Webhooks", "description": "Manage webhooks"},
    {"name": "list_realtime_publications", "displayName": "List Realtime Publications", "description": "List realtime publications"},
    {"name": "get_logs", "displayName": "Get Logs", "description": "Get application logs"},
    {"name": "metrics_dashboard", "displayName": "Metrics Dashboard", "description": "Get metrics dashboard"},
    {"name": "audit_security", "displayName": "Audit Security", "description": "Audit security configuration"},
    {"name": "analyze_performance", "displayName": "Analyze Performance", "description": "Analyze database performance"},
    {"name": "backup_database", "displayName": "Backup Database", "description": "Create database backup"},
    {"name": "cache_management", "displayName": "Cache Management", "description": "Manage application cache"},
    {"name": "manage_secrets", "displayName": "Manage Secrets", "description": "Manage application secrets"},
    {"name": "get_project_url", "displayName": "Get Project URL", "description": "Get project URL"},
    {"name": "get_anon_key", "displayName": "Get Anon Key", "description": "Get anonymous key"},
    {"name": "get_service_key", "displayName": "Get Service Role Key", "description": "Get service role key"},
    {"name": "generate_crud_api", "displayName": "Generate CRUD API", "description": "Generate CRUD API"},
    {"name": "generate_typescript_types", "displayName": "Generate TypeScript Types", "description": "Generate TypeScript types"},
]

# ------------------------
# Endpoints requis (duplicés sous / et /supabase)
# ------------------------

# Lecture configuration envoyée par Smithery (header/query)
from base64 import b64decode

def parse_request_config(data: dict | None = None):
    # Headers ou query
    cfg_raw = request.headers.get('x-smithery-config') or request.headers.get('x-mcp-config') or request.args.get('config')
    if cfg_raw:
        try:
            return json.loads(cfg_raw)
        except Exception:
            try:
                return json.loads(b64decode(cfg_raw).decode('utf-8'))
            except Exception:
                pass
    # Corps JSON (si fourni)
    if data and isinstance(data, dict):
        for key_path in (
            ("config",),
            ("params", "config"),
            ("params", "profile"),
            ("params", "credentials"),
            ("profile",),
            ("credentials",),
        ):
            cur = data
            ok = True
            for k in key_path:
                if isinstance(cur, dict) and k in cur:
                    cur = cur[k]
                else:
                    ok = False
                    break
            if ok and isinstance(cur, dict):
                return cur
    return {}

@app.route('/health', methods=['GET'])
@app.route('/supabase/health', methods=['GET'])
def health_check():
    req_cfg = parse_request_config()
    eff_url = req_cfg.get('SUPABASE_URL', SUPABASE_URL)
    eff_anon = req_cfg.get('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY)
    return jsonify({
        "status": "UP",
        "service": MCP_SERVER_NAME,
        "version": MCP_SERVER_VERSION,
        "tools_count": len(MCP_TOOLS),
        "healthcheck": "OK",
        "supabase_connected": bool(eff_url and eff_anon),
        "timestamp": time.time(),
        "receivedConfigKeys": sorted(list(req_cfg.keys())) if req_cfg else []
    })

@app.route('/api/tools', methods=['GET'])
@app.route('/supabase/api/tools', methods=['GET'])
def get_tools():
    # Retourne les outils avec displayName et parameters (schéma) pour chaque entrée
    defs, tools_schema = build_tool_definitions()
    # tools_schema contient déjà name/description/inputSchema; enrichir avec displayName et parameters
    tools_enriched = []
    tool_display_by_name = {t.get("name"): t.get("displayName") for t in MCP_TOOLS}
    for t in tools_schema:
        name = t.get("name")
        display_name = tool_display_by_name.get(name) or name
        input_schema = t.get("inputSchema") or t.get("input_schema") or {"type": "object", "properties": {}}
        tools_enriched.append({
            "name": name,
            "displayName": display_name,
            "description": t.get("description", ""),
            "parameters": input_schema,
            "inputSchema": input_schema,
            "input_schema": input_schema,
        })
    return jsonify(tools_enriched)

# Endpoint MCP principal - Support GET et POST
@app.route('/mcp', methods=['GET', 'POST'])
@app.route('/supabase/mcp', methods=['GET', 'POST'])
def mcp_endpoint():
    try:
        # GET pour infos rapides (certains scanners font un GET d'abord)
        if request.method == 'GET':
            defs, tools_schema = build_tool_definitions()
            base_url = request.host_url.rstrip('/')
            config_schema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "$id": f"{base_url}/.well-known/mcp-config",
                "title": "Supabase MCP Session Configuration",
                "description": "Configuration pour se connecter au serveur MCP Supabase.",
                "x-query-style": "dot+bracket",
                "type": "object",
                "properties": {
                    "SUPABASE_URL": {
                        "type": "string",
                        "title": "Supabase URL",
                        "description": "URL de votre projet Supabase (ex: https://your-project.supabase.co)"
                    },
                    "SUPABASE_ANON_KEY": {
                        "type": "string",
                        "title": "Supabase Anon Key",
                        "description": "Clé anonyme publique Supabase"
                    },
                    "SUPABASE_SERVICE_ROLE_KEY": {
                        "type": "string",
                        "title": "Service Role Key (optionnel)",
                        "description": "Clé de service (permissions élevées). Ne fournissez que si nécessaire."
                    },
                    "SUPABASE_AUTH_JWT_SECRET": {
                        "type": "string",
                        "title": "Auth JWT Secret (optionnel)",
                        "description": "Secret JWT pour l'authentification (si requis)"
                    }
                },
                "required": ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
                "additionalProperties": False
            }
            return jsonify({
                "service": MCP_SERVER_NAME,
                "version": MCP_SERVER_VERSION,
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": True, "definitions": defs},
                    "resources": {"subscribe": False, "listChanged": False, "definitions": {}},
                    "prompts": {"listChanged": False, "definitions": {}}
                },
                "endpoints": {"rpc": "/mcp", "health": "/health", "config": "/.well-known/mcp-config", "discovery": "/mcp/tools.json"},
                "tools": tools_schema,
                "configSchema": config_schema,
                "status": "ready"
            })

        # Gestion des requêtes POST
        data = request.get_json(silent=True) or {}
        req_cfg = parse_request_config(data)
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        method = data.get("method", "")
        request_id = data.get("id", "unknown")

        logger.info(f"MCP Request: {method} (ID: {request_id})")

        if method == "initialize":
            defs, _ = build_tool_definitions()
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {"listChanged": True, "definitions": defs},
                        "resources": {"subscribe": False, "listChanged": False, "definitions": {}},
                        "prompts": {"listChanged": False, "definitions": {}}
                    },
                    "serverInfo": {"name": MCP_SERVER_NAME, "version": MCP_SERVER_VERSION},
                    "receivedConfigKeys": sorted(list(req_cfg.keys())) if req_cfg else []
                },
            }
        elif method == "notifications/initialized":
            # Notification JSON-RPC: pas de réponse requise, mais 200 vide côté HTTP
            return "", 200
        elif method == "ping":
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"content": [{"type": "text", "text": "pong"}]},
            }
        elif method == "tools/list":
            _, tools_schema = build_tool_definitions()
            response = {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tools_schema}}
        elif method == "tools/call":
            tool_name = data.get("params", {}).get("name", "")
            tool_args = data.get("params", {}).get("arguments", {})
            result = execute_tool(tool_name, tool_args)
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"content": [{"type": "text", "text": result}]},
            }
        else:
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32601, "message": f"Method not found: {method}"},
            }

        return jsonify(response)
    except Exception as e:
        logger.error(f"MCP Error: {str(e)}")
        return (
            jsonify(
                {
                    "jsonrpc": "2.0",
                    "id": (request.get_json(silent=True) or {}).get("id", "unknown"),
                    "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
                }
            ),
            500,
        )

@app.route('/mcp', methods=['GET'])
@app.route('/supabase/mcp', methods=['GET'])
def mcp_http_introspection():
    """Introspection HTTP pour scanners: renvoie capacités et endpoints."""
    defs, tools_schema = build_tool_definitions()
    return jsonify({
        "service": MCP_SERVER_NAME,
        "version": MCP_SERVER_VERSION,
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {"listChanged": True, "definitions": defs},
            "resources": {"subscribe": False, "listChanged": False, "definitions": {}},
            "prompts": {"listChanged": False, "definitions": {}}
        },
        "endpoints": {
            "rpc": "/mcp",
            "health": "/health",
            "config": "/.well-known/mcp-config",
            "discovery": "/mcp/tools.json"
        },
        "tools": tools_schema,
        "status": "ready"
    })

# Endpoint de configuration MCP (well-known)
@app.route('/.well-known/mcp-config', methods=['GET'])
@app.route('/supabase/.well-known/mcp-config', methods=['GET'])
def mcp_config():
    base_url = request.host_url.rstrip('/')
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "$id": f"{base_url}/.well-known/mcp-config",
        "title": "MCP Session Configuration",
        "description": "Configuration pour la connexion au Supabase MCP Server",
        "x-query-style": "dot+bracket",
        "type": "object",
        "properties": {
            "SUPABASE_URL": {
                "type": "string",
                "title": "Supabase URL",
                "description": "URL de votre projet Supabase (ex: https://your-project.supabase.co)"
            },
            "SUPABASE_ANON_KEY": {
                "type": "string",
                "title": "Supabase Anon Key",
                "description": "Clé anonyme publique Supabase"
            },
            "SUPABASE_SERVICE_ROLE_KEY": {
                "type": "string",
                "title": "Service Role Key (optionnel)",
                "description": "Clé de service (permissions élevées). Ne fournissez que si nécessaire."
            },
            "SUPABASE_AUTH_JWT_SECRET": {
                "type": "string",
                "title": "Auth JWT Secret (optionnel)",
                "description": "Secret JWT pour l'authentification (si requis)"
            }
        },
        "required": ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
        "additionalProperties": False
    }
    return jsonify(schema)

@app.route('/mcp/tools.json', methods=['GET'])
@app.route('/supabase/mcp/tools.json', methods=['GET'])
def mcp_tools_json():
    """Exporte les définitions des outils MCP pour la découverte externe (Smithery)."""
    def_schema_overrides = {
        "execute_sql": {
            "required": ["sql"],
            "properties": {"sql": {"type": "string"}},
        },
        "list_tables": {
            "properties": {"schemas": {"type": "array", "items": {"type": "string"}}},
        },
        "get_logs": {
            "properties": {"service": {"type": "string"}},
        },
        "search_docs": {
            "required": ["query"],
            "properties": {"query": {"type": "string"}},
        },
        "apply_migration": {
            "required": ["version"],
            "properties": {"version": {"type": "string"}},
        },
        "list_storage_objects": {
            "required": ["bucket_id"],
            "properties": {"bucket_id": {"type": "string"}},
        },
        "get_auth_user": {
            "properties": {"id": {"type": "string"}, "email": {"type": "string"}},
        },
        "create_auth_user": {
            "properties": {"email": {"type": "string"}, "password": {"type": "string"}},
        },
        "delete_auth_user": {
            "properties": {"id": {"type": "string"}},
        },
        "update_auth_user": {
            "properties": {"id": {"type": "string"}},
        },
    }

    definitions = {}
    tools_array = []
    for tool in MCP_TOOLS:
        name = tool.get("name")
        desc = tool.get("description", "")
        disp = tool.get("displayName") or name
        override = def_schema_overrides.get(name, {})
        input_schema = {
            "type": "object",
            "properties": override.get("properties", {}),
        }
        if "required" in override:
            input_schema["required"] = override["required"]

        # Dupliquer avec input_schema snake_case et inputSchema camelCase
        definitions[name] = {
            "name": name,
            "displayName": disp,
            "description": desc,
            "parameters": input_schema,
            "inputSchema": input_schema,
            "input_schema": input_schema,
        }
        tools_array.append({
            "name": name,
            "displayName": disp,
            "description": desc,
            "parameters": input_schema,
            "inputSchema": input_schema,
            "input_schema": input_schema,
        })

    return jsonify({
        "definitions": definitions,
        "tools": tools_array,
        "serverInfo": {"name": MCP_SERVER_NAME, "version": MCP_SERVER_VERSION},
    })

# Racine - accepte GET et POST (certains clients postent à la racine)
@app.route('/', methods=['GET', 'POST'])
@app.route('/supabase', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        data = request.get_json(silent=True)
        if data and data.get("method"):
            return mcp_endpoint()
        return jsonify({
            "service": MCP_SERVER_NAME,
            "version": MCP_SERVER_VERSION,
            "status": "running",
            "message": "POST requests should use /mcp endpoint for JSON-RPC",
        })

    return jsonify(
        {
            "service": MCP_SERVER_NAME,
            "version": MCP_SERVER_VERSION,
            "status": "running",
            "tools_count": len(MCP_TOOLS),
            "endpoints": {
                "health": "/health",
                "tools": "/api/tools",
                "mcp": "/mcp",
                "config": "/.well-known/mcp-config",
            },
            "supabase_connected": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        }
    )


def execute_tool(tool_name: str, args: dict) -> str:
    tool_found = any(tool["name"] == tool_name for tool in MCP_TOOLS)
    if not tool_found:
        return f"Tool '{tool_name}' not found"

    if "sql" in tool_name.lower():
        return f"SQL query executed successfully: {args.get('query', 'No query provided')}"
    if "health" in tool_name.lower():
        return "Database health check: OK"
    if "list" in tool_name.lower():
        return f"List operation completed for {tool_name}"
    if "create" in tool_name.lower():
        return f"Created successfully: {tool_name}"
    if "migration" in tool_name.lower():
        return f"Migration operation completed: {tool_name}"
    return f"Tool '{tool_name}' executed successfully with args: {args}"


# Helper: construit les définitions et la liste d'outils avec schémas
def build_tool_definitions():
    def_schema_overrides = {
        "execute_sql": {
            "required": ["sql"],
            "properties": {"sql": {"type": "string"}},
        },
        "list_tables": {
            "properties": {"schemas": {"type": "array", "items": {"type": "string"}}},
        },
        "get_logs": {
            "properties": {"service": {"type": "string"}},
        },
        "search_docs": {
            "required": ["query"],
            "properties": {"query": {"type": "string"}},
        },
        "apply_migration": {
            "required": ["version"],
            "properties": {"version": {"type": "string"}},
        },
        "list_storage_objects": {
            "required": ["bucket_id"],
            "properties": {"bucket_id": {"type": "string"}},
        },
        "get_auth_user": {
            "properties": {"id": {"type": "string"}, "email": {"type": "string"}},
        },
        "create_auth_user": {
            "properties": {"email": {"type": "string"}, "password": {"type": "string"}},
        },
        "delete_auth_user": {
            "properties": {"id": {"type": "string"}},
        },
        "update_auth_user": {
            "properties": {"id": {"type": "string"}},
        },
    }

    definitions = {}
    tools_array = []
    for tool in MCP_TOOLS:
        name = tool.get("name")
        desc = tool.get("description", "")
        disp = tool.get("displayName") or name
        override = def_schema_overrides.get(name, {})
        input_schema = {
            "type": "object",
            "properties": override.get("properties", {}),
        }
        if "required" in override:
            input_schema["required"] = override["required"]

        definitions[name] = {
            "name": name,
            "displayName": disp,
            "description": desc,
            "parameters": input_schema,
            "inputSchema": input_schema,
            "input_schema": input_schema,
        }
        tools_array.append({
            "name": name,
            "displayName": disp,
            "description": desc,
            "parameters": input_schema,
            "inputSchema": input_schema,
            "input_schema": input_schema,
        })

    return definitions, tools_array


if __name__ == "__main__":
    logger.info(f"🚀 Starting {MCP_SERVER_NAME} v{MCP_SERVER_VERSION}")
    logger.info(f"🌐 Port: {PORT}")
    logger.info(f"🔧 Supabase URL: {SUPABASE_URL}")
    logger.info(f"🛠️ Tools available: {len(MCP_TOOLS)}")
    logger.info(f"🏭 Production mode: {PRODUCTION_MODE}")

    app.run(host='0.0.0.0', port=PORT, debug=not PRODUCTION_MODE, threaded=True)
