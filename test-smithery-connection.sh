#!/bin/bash

echo "🔧 Test de connexion Smithery.ai"
echo ""

echo "📋 URLs de connexion MCP:"
echo "• Supabase MCP: https://supabase.mcp.coupaul.fr/"
echo "• Minecraft MCP: https://minecraft.mcp.coupaul.fr/"
echo ""

echo "📋 Configuration MCP:"
echo "• Supabase Config: https://supabase.mcp.coupaul.fr/.well-known/mcp-config"
echo "• Minecraft Config: https://minecraft.mcp.coupaul.fr/.well-known/mcp-config"
echo ""

echo "🧪 Test de ping MCP:"
echo "Supabase:"
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","params":{},"id":1}' \
  "https://supabase.mcp.coupaul.fr/" | jq .

echo ""
echo "Minecraft:"
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","params":{},"id":1}' \
  "https://minecraft.mcp.coupaul.fr/" | jq .
