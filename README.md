# Self-Hosted Supabase MCP Server - Enhanced Security Edition

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![smithery badge](https://smithery.ai/badge/@MisterSandFR/selfhosted-supabase-mcp)](https://smithery.ai/server/@MisterSandFR/selfhosted-supabase-mcp)
[![Security: Enhanced](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Security-Guide)
[![Version: 2.0.0](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/releases)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-brightgreen.svg)](https://nodejs.org)

> 🔒 **Enhanced Security Edition** - A production-ready fork of the original [selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp) by [@HenkDz](https://github.com/HenkDz) with comprehensive security improvements, rate limiting, and Docker/Coolify optimizations.

## 🌟 Overview

A secure [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification) server designed for interacting with **self-hosted Supabase instances**. This enhanced version addresses critical security vulnerabilities and adds enterprise-grade features while maintaining full compatibility with the original API.

Built upon the solid foundation created by [@HenkDz](https://github.com/HenkDz), this fork adds comprehensive security layers, connection resilience, and production-ready features essential for enterprise deployments.

### Why Choose the Enhanced Security Edition?

- ✅ **All Security Issues Fixed** - Addresses issues #5, #7, #8, #9, #10 from the original repo
- 🛡️ **Production Ready** - Battle-tested in Docker/Coolify environments
- ⚡ **Performance Optimized** - Connection pooling, retry logic, resource limits
- 📚 **Fully Documented** - Comprehensive Wiki with guides and troubleshooting
- 🔒 **Enterprise Security** - Rate limiting, SQL injection prevention, strong auth

## 🔐 Security Enhancements

This fork includes comprehensive security improvements that address all critical vulnerabilities:

### ✅ Fixed Security Issues
- **Connection Resilience** - Enhanced connection handling for Coolify/Docker environments with automatic retry logic
- **SQL Injection Prevention** - Comprehensive SQL sanitization and validation  
- **Secure Authentication** - Strong password policies and secure token handling
- **Input Validation** - Complete input sanitization across all endpoints
- **Rate Limiting** - Adaptive rate limiting and resource controls
- **Query Complexity Analysis** - Prevents resource exhaustion from complex queries

### 🛡️ Security Features

#### SQL Security
- Query validation and injection pattern detection
- Parameterized query support
- Table/column name validation
- Query complexity limits (100 points max)
- Safe string escaping

#### Authentication Security  
- Password strength validation (8+ chars, uppercase, lowercase, number, special char)
- Secure token generation using crypto
- Safe logging without exposing sensitive data
- HMAC signature verification
- Timing-safe comparisons

#### Rate Limiting & Resource Control
- 100 requests/minute default limit
- Max 10 concurrent requests
- Query complexity scoring
- Memory limits (256MB max)
- Execution time limits (30s max)
- Adaptive throttling based on system load

#### Input Validation
- Comprehensive sanitization for all inputs
- File upload validation
- Protection against prototype pollution
- Object depth limits
- XSS prevention

## 🚀 Features

The server exposes the following tools to MCP clients:

*   **Schema & Migrations**
    *   `list_tables`: Lists tables in the database schemas.
    *   `list_extensions`: Lists installed PostgreSQL extensions.
    *   `list_migrations`: Lists applied Supabase migrations.
    *   `apply_migration`: Applies a SQL migration script.
*   **Database Operations & Stats**
    *   `execute_sql`: Executes an arbitrary SQL query (via RPC or direct connection).
    *   `get_database_connections`: Shows active database connections (`pg_stat_activity`).
    *   `get_database_stats`: Retrieves database statistics (`pg_stat_*`).
*   **Project Configuration & Keys**
    *   `get_project_url`: Returns the configured Supabase URL.
    *   `get_anon_key`: Returns the configured Supabase anon key.
    *   `get_service_key`: Returns the configured Supabase service role key (if provided).
    *   `verify_jwt_secret`: Checks if the JWT secret is configured and returns a preview.
*   **Development & Extension Tools**
    *   `generate_typescript_types`: Generates TypeScript types from the database schema.
    *   `rebuild_hooks`: Attempts to restart the `pg_net` worker (if used).
*   **Auth User Management**
    *   `list_auth_users`: Lists users from `auth.users`.
    *   `get_auth_user`: Retrieves details for a specific user.
    *   `create_auth_user`: Creates a new user (Requires direct DB access, insecure password handling).
    *   `delete_auth_user`: Deletes a user (Requires direct DB access).
    *   `update_auth_user`: Updates user details (Requires direct DB access, insecure password handling).
*   **Storage Insights**
    *   `list_storage_buckets`: Lists all storage buckets.
    *   `list_storage_objects`: Lists objects within a specific bucket.
*   **Realtime Inspection**
    *   `list_realtime_publications`: Lists PostgreSQL publications (often `supabase_realtime`).

*(Note: `get_logs` was initially planned but skipped due to implementation complexities in a self-hosted environment).*

## 📦 Installation

### Via Smithery (Recommended)

```bash
# Install for Claude Desktop
npx -y @smithery/cli install @MisterSandFR/selfhosted-supabase-mcp-secure --client claude

# Install for other clients
npx -y @smithery/cli install @MisterSandFR/selfhosted-supabase-mcp-secure
```

### Manual Installation

```bash
# Clone the enhanced security fork
git clone https://github.com/MisterSandFR/selfhosted-supabase-mcp.git
cd selfhosted-supabase-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Prerequisites

- Node.js 18.x or later
- npm (included with Node.js)
- Access to your self-hosted Supabase instance
- PostgreSQL connection string (recommended for production)

## ⚙️ Configuration

The server requires configuration details for your Supabase instance. These can be provided via command-line arguments or environment variables. CLI arguments take precedence.

**Required:**

*   `--url <url>` or `SUPABASE_URL=<url>`: The main HTTP URL of your Supabase project (e.g., `http://localhost:8000`).
*   `--anon-key <key>` or `SUPABASE_ANON_KEY=<key>`: Your Supabase project's anonymous key.

**Optional (but Recommended/Required for certain tools):**

*   `--service-key <key>` or `SUPABASE_SERVICE_ROLE_KEY=<key>`: Your Supabase project's service role key. Needed for operations requiring elevated privileges, like attempting to automatically create the `execute_sql` helper function if it doesn't exist.
*   `--db-url <url>` or `DATABASE_URL=<url>`: The direct PostgreSQL connection string for your Supabase database (e.g., `postgresql://postgres:password@localhost:5432/postgres`). Required for tools needing direct database access or transactions (`apply_migration`, Auth tools, Storage tools, querying `pg_catalog`, etc.).
*   `--jwt-secret <secret>` or `SUPABASE_AUTH_JWT_SECRET=<secret>`: Your Supabase project's JWT secret. Needed for tools like `verify_jwt_secret`.
*   `--tools-config <path>`: Path to a JSON file specifying which tools to enable (whitelist). If omitted, all tools defined in the server are enabled. The file should have the format `{"enabledTools": ["tool_name_1", "tool_name_2"]}`.

### 💡 Important Notes

- **Direct Database Connection**: For production use, always provide `DATABASE_URL` for better reliability and to bypass JWT authentication issues
- **Helper Function**: The server auto-creates a `public.execute_sql` function if it doesn't exist (requires service key and database URL)
- **Security**: Never commit credentials to version control - use environment variables

## 🚀 Usage

### Running the Server

```bash
# Using CLI arguments (example)
node dist/index.js --url http://localhost:8000 --anon-key <your-anon-key> --db-url postgresql://postgres:password@localhost:5432/postgres [--service-key <your-service-key>]

# Example with tool whitelisting via config file
node dist/index.js --url http://localhost:8000 --anon-key <your-anon-key> --tools-config ./mcp-tools.json

# Or configure using environment variables and run:
# export SUPABASE_URL=http://localhost:8000
# export SUPABASE_ANON_KEY=<your-anon-key>
# export DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
# export SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
# The --tools-config option MUST be passed as a CLI argument if used
node dist/index.js

# Using npm start script (if configured in package.json to pass args/read env)
npm start -- --url ... --anon-key ...
```

The server communicates via standard input/output (stdio) and is designed to be invoked by an MCP client application (e.g., an IDE extension like Cursor). The client will connect to the server's stdio stream to list and call the available tools.

## 🔧 Client Configuration

> ⚠️ **Security Note**: Never commit configuration files with credentials. Use environment variables or secure vaults.

### Claude Desktop / Cursor

1.  Create or open the file `.cursor/mcp.json` in your project root.
2.  Add the following configuration:

    ```json
    {
      "mcpServers": {
        "selfhosted-supabase": { 
          "command": "node",
          "args": [
            "<path-to-dist/index.js>", // e.g., "F:/Projects/mcp-servers/self-hosted-supabase-mcp/dist/index.js"
            "--url",
            "<your-supabase-url>", // e.g., "http://localhost:8000"
            "--anon-key",
            "<your-anon-key>",
            // Optional - Add these if needed by the tools you use
            "--service-key",
            "<your-service-key>",
            "--db-url",
            "<your-db-url>", // e.g., "postgresql://postgres:password@host:port/postgres"
            "--jwt-secret",
            "<your-jwt-secret>",
            // Optional - Whitelist specific tools
            "--tools-config",
            "<path-to-your-mcp-tools.json>" // e.g., "./mcp-tools.json"
          ]
        }
      }
    }
    ```

### Visual Studio Code (Copilot)

VS Code Copilot allows using environment variables populated via prompted inputs, which is more secure for keys.

1.  Create or open the file `.vscode/mcp.json` in your project root.
2.  Add the following configuration:

    ```json
    {
      "inputs": [
        { "type": "promptString", "id": "sh-supabase-url", "description": "Self-Hosted Supabase URL", "default": "http://localhost:8000" },
        { "type": "promptString", "id": "sh-supabase-anon-key", "description": "Self-Hosted Supabase Anon Key", "password": true },
        { "type": "promptString", "id": "sh-supabase-service-key", "description": "Self-Hosted Supabase Service Key (Optional)", "password": true, "required": false },
        { "type": "promptString", "id": "sh-supabase-db-url", "description": "Self-Hosted Supabase DB URL (Optional)", "password": true, "required": false },
        { "type": "promptString", "id": "sh-supabase-jwt-secret", "description": "Self-Hosted Supabase JWT Secret (Optional)", "password": true, "required": false },
        { "type": "promptString", "id": "sh-supabase-server-path", "description": "Path to self-hosted-supabase-mcp/dist/index.js" },
        { "type": "promptString", "id": "sh-supabase-tools-config", "description": "Path to tools config JSON (Optional, e.g., ./mcp-tools.json)", "required": false }
      ],
      "servers": {
        "selfhosted-supabase": {
          "command": "node",
          // Arguments are passed via environment variables set below OR direct args for non-env options
          "args": [
            "${input:sh-supabase-server-path}",
            // Use direct args for options not easily map-able to standard env vars like tools-config
            // Check if tools-config input is provided before adding the argument
            ["--tools-config", "${input:sh-supabase-tools-config}"] 
            // Alternatively, pass all as args if simpler:
            // "--url", "${input:sh-supabase-url}",
            // "--anon-key", "${input:sh-supabase-anon-key}",
            // ... etc ... 
           ],
          "env": {
            "SUPABASE_URL": "${input:sh-supabase-url}",
            "SUPABASE_ANON_KEY": "${input:sh-supabase-anon-key}",
            "SUPABASE_SERVICE_ROLE_KEY": "${input:sh-supabase-service-key}",
            "DATABASE_URL": "${input:sh-supabase-db-url}",
            "SUPABASE_AUTH_JWT_SECRET": "${input:sh-supabase-jwt-secret}"
            // The server reads these environment variables as fallbacks if CLI args are missing
          }
        }
      }
    }
    ```
3.  When you use Copilot Chat in Agent mode (@workspace), it should detect the server. You will be prompted to enter the details (URL, keys, path) when the server is first invoked.

### Other Clients (Windsurf, Cline, Claude)

Adapt the configuration structure shown for Cursor or the official Supabase documentation, replacing the `command` and `args` with the `node` command and the arguments for this server, similar to the Cursor example:

```json
{
  "mcpServers": {
    "selfhosted-supabase": { 
      "command": "node",
      "args": [
        "<path-to-dist/index.js>", 
        "--url", "<your-supabase-url>", 
        "--anon-key", "<your-anon-key>", 
        // Optional args...
        "--service-key", "<your-service-key>", 
        "--db-url", "<your-db-url>", 
        "--jwt-secret", "<your-jwt-secret>",
        // Optional tools config
        "--tools-config", "<path-to-your-mcp-tools.json>"
      ]
    }
  }
}
```
Consult the specific documentation for each client on where to place the `mcp.json` or equivalent configuration file.

## 🐳 Docker/Coolify Deployment

This enhanced version includes specific optimizations for containerized environments:

- Connection pooling with keep-alive settings
- Automatic retry logic for transient network issues  
- Enhanced timeout configurations
- Docker-friendly connection parameters

```yaml
# docker-compose.yml example
services:
  supabase-mcp:
    build: .
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      DATABASE_URL: ${DATABASE_URL}
    restart: unless-stopped
```

## 📊 Monitoring & Limits

### Default Limits
- **Rate Limit**: 100 requests/minute
- **Concurrent Requests**: 10 maximum
- **Query Complexity**: 100 points maximum
- **Execution Time**: 30 seconds maximum
- **Memory Usage**: 256MB maximum

### Monitoring
The server logs detailed metrics including:
- Connection attempts and failures
- Query execution times
- Resource usage statistics
- Security violations
- Rate limit hits

## 🔒 Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use DATABASE_URL** - Direct connection bypasses JWT issues
3. **Enable rate limiting** - Protects against abuse
4. **Monitor query complexity** - Prevents resource exhaustion
5. **Validate all inputs** - Prevents injection attacks
6. **Use strong passwords** - Minimum 8 characters with complexity
7. **Audit logs** - Monitor all database operations

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All code passes TypeScript compilation
- Security best practices are followed
- Tests are included for new features
- Documentation is updated

## 📚 Documentation

For detailed documentation, see our [Wiki](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki):
- [Security Guide](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Security-Guide)
- [Configuration Guide](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Configuration-Guide)
- [Troubleshooting](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Troubleshooting)
- [API Reference](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/API-Reference)

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original project by [@HenkDz](https://github.com/HenkDz)
- [Supabase](https://supabase.com) team for the amazing platform
- [Model Context Protocol](https://github.com/modelcontextprotocol/specification) contributors

## ⚠️ Security Notice

This tool provides direct database access. Always:
- Use strong, unique passwords
- Limit access to trusted networks
- Monitor usage and logs
- Keep dependencies updated
- Follow the principle of least privilege

---

**Version**: 2.0.0 | **Status**: Production Ready | **Security**: Enhanced

## 🚀 Quick Start with Smithery

The easiest way to get started is through Smithery:

1. **Install via Smithery CLI:**
```bash
npx -y @smithery/cli install @MisterSandFR/selfhosted-supabase-mcp-secure --client claude
```

2. **Configure your credentials** when prompted:
- Supabase URL (e.g., `http://localhost:8000`)
- Anonymous Key (starts with `eyJ...`)
- Database URL (optional but recommended)
- Service Role Key (optional)

3. **Start using** the MCP tools in Claude Desktop!

For manual configuration and other clients, see the [Configuration Guide](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Configuration-Guide). 
