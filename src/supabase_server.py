#!/usr/bin/env python3
"""
Serveur MCP Ultra-Simplifié pour Smithery.ai
Version minimale qui devrait fonctionner avec Smithery
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

@app.route('/.well-known/mcp-config', methods=['GET'])
def mcp_config():
    """Configuration MCP ultra-simple pour Smithery"""
    return jsonify({
        "mcpServers": {
            "supabase-mcp": {
                "command": "python",
                "args": ["src/supabase_server.py"],
                "env": {
                    "MCP_SERVER_NAME": "Supabase MCP Server",
                    "MCP_SERVER_VERSION": "3.7.0"
                }
            }
        }
    })

@app.route('/', methods=['GET', 'POST'])
def mcp_endpoint():
    """Endpoint MCP ultra-simple"""
    if request.method == 'GET':
        return jsonify({
            "service": "Supabase MCP Server",
            "version": "3.7.0",
            "status": "ready"
        })
    
    # Gestion des requêtes POST
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data"}), 400
        
        method = data.get("method", "")
        request_id = data.get("id", "unknown")
        
        logger.info(f"MCP Request: {method} (ID: {request_id})")
        
        if method == "ping":
            return jsonify({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"pong": True}
            })
        
        elif method == "initialize":
            return jsonify({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "Supabase MCP Server",
                        "version": "3.7.0"
                    }
                }
            })
        
        elif method == "notifications/initialized":
            # Pas de réponse pour les notifications
            return "", 204
        
        elif method == "tools/list":
            return jsonify({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "tools": []
                }
            })
        
        else:
            return jsonify({
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            })
    
    except Exception as e:
        logger.error(f"MCP Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        "status": "healthy",
        "service": "Supabase MCP Server",
        "version": "3.7.0"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)