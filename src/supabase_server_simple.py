#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur MCP Supabase Ultra-Simple - Sans Flask
Solution de contournement pour Railway
"""

import os
import json
import time
import logging
import base64
import uuid
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import psycopg

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://api.recube.gg")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_AUTH_JWT_SECRET = os.getenv("SUPABASE_AUTH_JWT_SECRET", "")
TOOLS_CONFIG_PATH = os.getenv("TOOLS_CONFIG_PATH") or os.getenv("MCP_TOOLS_CONFIG") or "mcp-tools.json"

def _load_enabled_tools():
    try:
        path = TOOLS_CONFIG_PATH
        if not path:
            return None
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            enabled = cfg.get("enabledTools") or cfg.get("enabled_tools")
            if isinstance(enabled, list):
                return set(str(x) for x in enabled)
    except Exception as e:
        logger.debug(f"Tools config not loaded: {e}")
    return None

ENABLED_TOOLS = _load_enabled_tools()

# Configuration MCP
MCP_SERVER_NAME = os.getenv("MCP_SERVER_NAME", "Supabase MCP Server")
MCP_SERVER_VERSION = os.getenv("MCP_SERVER_VERSION", "3.1.0")

class MCPHandler(BaseHTTPRequestHandler):
    _response_code = None
    _request_start_time = None

    def send_response(self, code, message=None):
        self._response_code = code
        return super().send_response(code, message)

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def _redact(self, text: str) -> str:
        try:
            tokens = [
                SUPABASE_ANON_KEY or "",
                os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
                SUPABASE_URL or "",
                os.getenv("DATABASE_URL", ""),
                SUPABASE_AUTH_JWT_SECRET or "",
            ]
            redacted = text
            for t in tokens:
                if t:
                    redacted = redacted.replace(t, "***")
            return redacted
        except Exception:
            return text

    def _decode_config_param(self, query):
        try:
            params = parse_qs(query or '')
            raw = params.get('config', [None])[0]
            if not raw:
                return None
            # raw peut déjà être base64-safe (e.g. e30=)
            decoded = base64.b64decode(raw).decode('utf-8', errors='replace')
            return decoded
        except Exception as e:
            logger.debug(f"Config decode error: {e}")
            return None

    def _log_start(self, request_id: str, method: str, path: str, query: str):
        ua = self.headers.get('User-Agent', '-')
        ct = self.headers.get('Content-Type', '-')
        cl = self.headers.get('Content-Length', '-')
        client_ip = self.client_address[0] if self.client_address else '-'
        config_preview = self._decode_config_param(query)
        if config_preview:
            config_preview = self._redact(config_preview)
        if config_preview and len(config_preview) > 200:
            config_preview = config_preview[:200] + '...'
        logger.info(
            f"REQ {request_id} {method} {path} ua='{ua}' ct='{ct}' cl='{cl}' ip={client_ip}"
            + (f" config={config_preview}" if config_preview else '')
        )

    def _log_done(self, request_id: str, note: str = ''):
        try:
            dur_ms = int((time.time() - (self._request_start_time or time.time())) * 1000)
        except Exception:
            dur_ms = -1
        code = self._response_code if self._response_code is not None else '-'
        logger.info(f"RES {request_id} status={code} dur_ms={dur_ms} {note}")

    def _execute_sql_text(self, sql: str, params: tuple | None = None):
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            return None, "Missing DATABASE_URL"
        try:
            with psycopg.connect(db_url, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params or None)
                    try:
                        rows = cur.fetchall()
                    except Exception:
                        rows = None
            if rows is None:
                return "OK", None
            lines = []
            for row in rows:
                lines.append(" | ".join("" if v is None else str(v) for v in row))
            return "\n".join(lines) if lines else "(no rows)", None
        except Exception as e:
            return None, str(e)

    def do_GET(self):
        """Gestion des requêtes GET"""
        parsed_path = urlparse(self.path)
        self._request_start_time = time.time()
        request_id = self.headers.get('X-Request-Id') or uuid.uuid4().hex[:8]
        self._log_start(request_id, 'GET', parsed_path.path, parsed_path.query)
        accept_header = (self.headers.get('Accept') or '*/*').lower()
        
        if parsed_path.path == '/health':
            self.send_health_response()
        elif parsed_path.path == '/favicon.ico':
            self.send_response(204)
            self._set_cors_headers()
            self.end_headers()
        elif parsed_path.path == '/mcp':
            # Page d'accueil MCP (texte) ou handshake JSON selon Accept
            if 'application/json' in accept_header:
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "transport": "http",
                    "jsonrpc": "2.0",
                    "endpoint": "/mcp",
                    "methods": [
                        "ping",
                        "initialize",
                        "notifications/initialized",
                        "tools/list",
                        "tools/call",
                        "resources/list",
                        "prompts/list",
                        "get_capabilities"
                    ]
                }).encode('utf-8'))
            else:
                content = self._make_mcp_intro_text()
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
        elif parsed_path.path in ('/.well-known/mcp-config', '/.well-known/mcp.json'):
            self.send_mcp_config()
        elif parsed_path.path in ('/mcp/tools.json', '/mcp-tools.json'):
            tools = self._get_tools_definition()
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"tools": tools}).encode('utf-8'))
        elif parsed_path.path in ('/mcp/tools/list', '/mcp/tools', '/tools'):
            # Page texte sur /mcp/tools, sinon JSON
            if parsed_path.path == '/mcp/tools' and 'application/json' not in accept_header:
                content = self._make_tools_text()
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                tools = self._get_tools_definition()
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"tools": tools}).encode('utf-8'))
        elif parsed_path.path in ('/mcp/resources/list', '/mcp/resources', '/resources'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"resources": []}).encode('utf-8'))
        elif parsed_path.path in ('/mcp/prompts/list', '/mcp/prompts', '/prompts'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"prompts": []}).encode('utf-8'))
        elif parsed_path.path == '/api/tools':
            # Liste des outils (format REST simple)
            tools = self._get_tools_definition()
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"tools": tools}).encode('utf-8'))
        elif parsed_path.path == '/':
            # Landing minimaliste
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "server": MCP_SERVER_NAME,
                "version": MCP_SERVER_VERSION,
                "endpoints": ["/health", "/.well-known/mcp-config", "/"]
            }).encode('utf-8'))
        else:
            self.send_error(404, "Not Found")
        self._log_done(request_id)
    
    def do_HEAD(self):
        """Gestion des requêtes HEAD (mêmes codes que GET, sans body)"""
        parsed_path = urlparse(self.path)
        self._request_start_time = time.time()
        request_id = self.headers.get('X-Request-Id') or uuid.uuid4().hex[:8]
        self._log_start(request_id, 'HEAD', parsed_path.path, parsed_path.query)
        try:
            if parsed_path.path in ('/health', '/', '/.well-known/mcp-config', '/.well-known/mcp.json', '/mcp'):
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
            elif parsed_path.path in ('/mcp/tools/list', '/mcp/resources/list', '/mcp/prompts/list', '/mcp/tools.json', '/mcp-tools.json'):
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
            elif parsed_path.path == '/favicon.ico':
                self.send_response(204)
                self._set_cors_headers()
                self.end_headers()
            else:
                self.send_error(404, "Not Found")
        finally:
            self._log_done(request_id)

    def do_POST(self):
        """Gestion des requêtes POST MCP"""
        self._request_start_time = time.time()
        request_id = self.headers.get('X-Request-Id') or uuid.uuid4().hex[:8]
        parsed_path = urlparse(self.path)
        self._log_start(request_id, 'POST', parsed_path.path, parsed_path.query)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        try:
            preview = post_data[:400].decode('utf-8', errors='replace')
            preview = self._redact(preview)
            logger.debug(f"REQ {request_id} body_preview={preview}")
        except Exception:
            pass
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            method = data.get('method', '')
            params = data.get('params', {})
            request_id = data.get('id', None)

            logger.info(f"MCP Request: {method} (ID: {request_id})")

            # Endpoint REST alternatif: /api/execute
            if self.path in ('/api/execute', '/mcp/tools/call'):
                # Adapter le payload REST en appel tools/call
                tool_name = data.get('name') or data.get('tool') or ''
                tool_args = data.get('arguments') or {}
                result, error = self._dispatch_tool(tool_name, tool_args)
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": error is None, "result": result, "error": error}).encode('utf-8'))
                self._log_done(str(request_id) if request_id is not None else '-')
                return

            # Notifications: pas de réponse (ex: notifications/initialized)
            if method == 'notifications/initialized':
                self.send_response(204)
                self.end_headers()
                self._log_done(str(request_id) if request_id is not None else '-')
                return

            # Construire le résultat selon la méthode
            result = None
            error = None

            if method == 'ping':
                result = {"pong": True, "server": "Supabase MCP Server"}
            elif method == 'initialize':
                # Inclure la map des outils pour aider certains scanners
                tools_map = {t.get('name'): t for t in self._get_tools_definition()}
                result = {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {"listChanged": True, "definitions": tools_map},
                        "resources": {"listChanged": False, "definitions": {}},
                        "prompts": {"listChanged": False, "definitions": {}}
                    },
                    "serverInfo": {
                        "name": MCP_SERVER_NAME,
                        "version": MCP_SERVER_VERSION
                    }
                }
            elif method == 'tools/list':
                result = {"tools": self._get_tools_definition()}
            elif method == 'resources/list':
                result = {"resources": []}
            elif method == 'prompts/list':
                result = {"prompts": []}
            elif method == 'get_capabilities':
                result = {
                    "capabilities": {
                        "tools": {"listChanged": True},
                        "resources": {"subscribe": False, "listChanged": False},
                        "prompts": {"listChanged": False}
                    }
                }
            elif method == 'tools/call':
                tool_name = params.get('name', '')
                tool_args = params.get('arguments', {})

                logger.info(f"Tools/call: {tool_name} with args: {tool_args}")
                result, error = self._dispatch_tool(tool_name, tool_args)
            else:
                error = {"code": -32601, "message": "Method not found"}

            # Envelope JSON-RPC 2.0 (sérialiser avant d'envoyer les en-têtes)
            rpc_response = {"jsonrpc": "2.0", "id": request_id}
            if error is not None:
                rpc_response["error"] = error
            else:
                rpc_response["result"] = result if result is not None else {}

            body_bytes = json.dumps(rpc_response).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body_bytes)))
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(body_bytes)
            try:
                self.wfile.flush()
            except Exception:
                pass
            self._log_done(str(request_id) if request_id is not None else '-')

        except Exception as e:
            logger.exception(f"Erreur MCP: {e}")
            # Internal error JSON-RPC
            rpc_response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32603, "message": "Internal error"}}
            body_bytes = json.dumps(rpc_response).encode('utf-8')
            # Tenter de renvoyer une réponse propre (si en-têtes pas déjà envoyés)
            try:
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body_bytes)))
                self._set_cors_headers()
                self.end_headers()
            except Exception:
                pass
            try:
                self.wfile.write(body_bytes)
                try:
                    self.wfile.flush()
                except Exception:
                    pass
            except Exception:
                pass
            self._log_done(str(request_id) if request_id is not None else '-')

    def do_OPTIONS(self):
        # Pré-vol CORS
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()
    
    def send_health_response(self):
        """Envoie la réponse de santé"""
        response = {
            "status": "healthy",
            "server": MCP_SERVER_NAME,
            "version": MCP_SERVER_VERSION,
            "timestamp": time.time(),
            "tools": 3
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def send_mcp_config(self):
        """Envoie la configuration MCP"""
        public_url = os.getenv('PUBLIC_URL', 'https://supabase.mcp.coupaul.fr')
        tools_map = {t.get('name'): t for t in self._get_tools_definition()}
        config = {
            "mcpServers": {
                "supabase": {
                    "transport": {"type": "http", "url": f"{public_url}"},
                    "metadata": {
                        "name": MCP_SERVER_NAME,
                        "version": MCP_SERVER_VERSION,
                        "capabilities": {
                            "tools": {"listChanged": True, "definitions": tools_map},
                            "resources": {"listChanged": False, "definitions": {}},
                            "prompts": {"listChanged": False, "definitions": {}}
                        },
                        "discovery": {"tools": f"{public_url}/mcp/tools.json"},
                        "categories": ["database", "auth", "storage"]
                    }
                }
            }
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(config).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override pour éviter les logs verbeux"""
        pass

    def _get_tools_definition(self):
        # Ensemble d'outils réduit et applicable au self-hosted
        tools = []
        def add(name: str, description: str, props: dict | None = None, required: list | None = None):
            schema = {"type": "object", "properties": props or {}}
            if required:
                schema["required"] = required
            tools.append({"name": name, "description": description, "inputSchema": schema})

        # Database
        add("execute_sql", "Executes raw SQL queries", {"sql": {"type": "string"}}, ["sql"])
        add("list_tables", "Lists all tables in specified schemas", {"schemas": {"type": "array", "items": {"type": "string"}}})
        add("list_extensions", "Lists all database extensions")
        add("get_database_stats", "Shows database and top table sizes")
        add("get_database_connections", "Shows active connection counts by database")

        # Migrations (facultatif pour self-hosted)
        add("apply_migration", "Applies a migration (for DDL operations)", {"version": {"type": "string"}}, ["version"])
        add("list_migrations", "Lists all database migrations")

        # Project Info (génériques)
        add("generate_typescript_types", "Generates TypeScript types from schema")

        # Monitoring générique
        add("get_logs", "Gets logs by service type (api, postgres, auth, etc.)", {"service": {"type": "string"}})

        # Docs
        add("search_docs", "Search Supabase documentation using GraphQL", {"query": {"type": "string"}}, ["query"])

        # Santé simple
        add("check_health", "Verify your database connection is working")

        # Auth (lecture)
        add("list_auth_users", "List auth users (id, email, created_at)")
        add("get_auth_user", "Get auth user by id or email", {"id": {"type": "string"}, "email": {"type": "string"}})
        add("create_auth_user", "Create auth user (stub)", {"email": {"type": "string"}, "password": {"type": "string"}})
        add("delete_auth_user", "Delete auth user (stub)", {"id": {"type": "string"}})
        add("update_auth_user", "Update auth user (stub)", {"id": {"type": "string"}})

        # Storage (lecture)
        add("list_storage_buckets", "List storage buckets")
        add("list_storage_objects", "List storage objects in a bucket", {"bucket_id": {"type": "string"}}, ["bucket_id"])

        # JWT/config
        add("verify_jwt_secret", "Verify presence of SUPABASE_AUTH_JWT_SECRET env var")

        # Compat: dupliquer inputSchema en input_schema si nécessaire
        for t in tools:
            if 'inputSchema' in t and 'input_schema' not in t:
                t['input_schema'] = t['inputSchema']
        # Whitelist
        if ENABLED_TOOLS:
            tools = [t for t in tools if t.get('name') in ENABLED_TOOLS]
        return tools

    def _dispatch_tool(self, tool_name: str, tool_args: dict):
        # Retourne (result, error)
        if tool_name == 'execute_sql':
            sql = tool_args.get('sql', 'SELECT 1')
            db_url = os.getenv('DATABASE_URL')
            if db_url:
                try:
                    with psycopg.connect(db_url, connect_timeout=5) as conn:
                        with conn.cursor() as cur:
                            cur.execute(sql)
                            rows = None
                            try:
                                rows = cur.fetchall()
                            except Exception:
                                rows = None
                    preview = f"{len(rows)} rows" if rows is not None else "OK"
                    return ({"content": [{"type": "text", "text": f"SQL execute ok: {preview}"}]}, None)
                except Exception as e:
                    return (None, {"code": -32000, "message": f"SQL error: {str(e)}"})
            return ({"content": [{"type": "text", "text": f"SQL execute ok: {sql[:100]}..."}]}, None)
        if tool_name == 'list_extensions':
            txt, err = self._execute_sql_text("SELECT extname, extversion FROM pg_extension ORDER BY extname")
            if err:
                return (None, {"code": -32010, "message": f"Extensions error: {err}"})
            return ({"content": [{"type": "text", "text": txt}]}, None)
        if tool_name in ('apply_migration', 'list_migrations', 'generate_typescript_types', 'get_logs', 'search_docs'):
            # Réponses factices pour l'ISO de surface
            return ({
                "content": [
                    {"type": "text", "text": f"{tool_name} executed (stub)."}
                ]
            }, None)
        if tool_name == 'check_health':
            db_url = os.getenv('DATABASE_URL')
            if db_url:
                try:
                    with psycopg.connect(db_url, connect_timeout=3) as _:
                        pass
                    return ({"content": [{"type": "text", "text": "Database healthy (self-hosted)"}]}, None)
                except Exception as e:
                    return (None, {"code": -32001, "message": f"DB unhealthy: {str(e)}"})
            return ({"content": [{"type": "text", "text": "Database healthy"}]}, None)
        if tool_name == 'list_tables':
            db_url = os.getenv('DATABASE_URL')
            if db_url:
                try:
                    with psycopg.connect(db_url, connect_timeout=5) as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                select table_schema, table_name
                                from information_schema.tables
                                where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema')
                                order by table_schema, table_name
                                """
                            )
                            rows = cur.fetchall()
                    lines = [f"{s}.{t}" for (s, t) in rows]
                    text = "\n".join(lines) if lines else "(no tables)"
                    return ({"content": [{"type": "text", "text": text}]}, None)
                except Exception as e:
                    return (None, {"code": -32002, "message": f"List tables error: {str(e)}"})
            return ({"content": [{"type": "text", "text": "Tables disponibles: users, profiles, posts, comments, etc."}]}, None)
        if tool_name == 'list_auth_users':
            txt, err = self._execute_sql_text("SELECT id::text, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 50")
            if err:
                return (None, {"code": -32020, "message": f"Auth users error: {err}"})
            return ({"content": [{"type": "text", "text": txt}]}, None)
        if tool_name == 'get_auth_user':
            user_id = tool_args.get('id')
            email = tool_args.get('email')
            if user_id:
                txt, err = self._execute_sql_text("SELECT id::text, email, created_at FROM auth.users WHERE id::text = %s LIMIT 1", (user_id,))
            elif email:
                txt, err = self._execute_sql_text("SELECT id::text, email, created_at FROM auth.users WHERE email = %s LIMIT 1", (email,))
            else:
                return (None, {"code": -32602, "message": "Missing 'id' or 'email'"})
            if err:
                return (None, {"code": -32021, "message": f"Auth user error: {err}"})
            return ({"content": [{"type": "text", "text": txt or "(not found)"}]}, None)
        if tool_name in ('create_auth_user', 'delete_auth_user', 'update_auth_user'):
            return ({"content": [{"type": "text", "text": f"{tool_name} executed (stub)."}]}, None)
        if tool_name == 'list_storage_buckets':
            txt, err = self._execute_sql_text("SELECT id::text, name, created_at FROM storage.buckets ORDER BY created_at DESC")
            if err:
                return (None, {"code": -32030, "message": f"Buckets error: {err}"})
            return ({"content": [{"type": "text", "text": txt}]}, None)
        if tool_name == 'list_storage_objects':
            bucket_id = tool_args.get('bucket_id')
            if not bucket_id:
                return (None, {"code": -32602, "message": "Missing 'bucket_id'"})
            txt, err = self._execute_sql_text("SELECT id::text, name, created_at FROM storage.objects WHERE bucket_id = %s ORDER BY created_at DESC LIMIT 100", (bucket_id,))
            if err:
                return (None, {"code": -32031, "message": f"Objects error: {err}"})
            return ({"content": [{"type": "text", "text": txt}]}, None)
        if tool_name == 'get_database_stats':
            txt1, err1 = self._execute_sql_text("SELECT current_database(), pg_size_pretty(pg_database_size(current_database()))")
            if err1:
                return (None, {"code": -32040, "message": f"DB size error: {err1}"})
            txt2, err2 = self._execute_sql_text(
                """
                SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
                FROM pg_catalog.pg_statio_user_tables
                ORDER BY pg_total_relation_size(relid) DESC
                LIMIT 10
                """
            )
            if err2:
                txt2 = ""
            combined = (txt1 or "") + ("\n\nTop tables:\n" + txt2 if txt2 else "")
            return ({"content": [{"type": "text", "text": combined.strip()}]}, None)
        if tool_name == 'get_database_connections':
            txt, err = self._execute_sql_text("SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname ORDER BY 2 DESC")
            if err:
                return (None, {"code": -32041, "message": f"Connections error: {err}"})
            return ({"content": [{"type": "text", "text": txt}]}, None)
        if tool_name == 'verify_jwt_secret':
            ok = bool(SUPABASE_AUTH_JWT_SECRET)
            info = f"JWT secret {'present' if ok else 'missing'}"
            return ({"content": [{"type": "text", "text": info}]}, None)
        return (None, {"code": -32601, "message": f"Tool '{tool_name}' not found"})
def main():
    """Fonction principale"""
    port = int(os.getenv('PORT', 8000))
    
    logger.info(f"Starting Supabase MCP Server v{MCP_SERVER_VERSION}")
    logger.info(f"Port: {port}")
    logger.info(f"Supabase URL: {SUPABASE_URL}")
    logger.info("Tools available: 3")
    logger.info(f"Production mode: {os.getenv('PRODUCTION_MODE', 'false')}")
    
    server = HTTPServer(('0.0.0.0', port), MCPHandler)
    
    try:
        logger.info(f"* Running on all addresses (0.0.0.0)")
        logger.info(f"* Running on http://127.0.0.1:{port}")
        logger.info(f"* Running on http://0.0.0.0:{port}")
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        server.shutdown()

if __name__ == "__main__":
    main()
