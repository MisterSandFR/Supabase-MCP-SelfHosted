# Self-Hosted Supabase MCP Server - Enhanced Security Edition

[![smithery badge](https://smithery.ai/badge/@MisterSandFR/supabase-mcp-selfhosted)](https://smithery.ai/server/@MisterSandFR/supabase-mcp-selfhosted)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Enhanced](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Security-Guide)
[![Version: 2.3.0](https://img.shields.io/badge/Version-2.3.0-blue.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/releases)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-brightgreen.svg)](https://nodejs.org)

> 🔒 **Enhanced Security Edition** - A production-ready fork of the original [selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp) by [@HenkDz](https://github.com/HenkDz) with comprehensive security improvements, rate limiting, Docker/Coolify optimizations, and extensive management tools for self-hosted deployments.

## 🌟 Overview

A secure [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification) server designed for interacting with **self-hosted Supabase instances**. This enhanced version addresses critical security vulnerabilities and adds enterprise-grade features while maintaining full compatibility with the original API.

Built upon the solid foundation created by [@HenkDz](https://github.com/HenkDz), this fork adds comprehensive security layers, connection resilience, and production-ready features essential for enterprise deployments.

### Why Choose the Enhanced Security Edition?

- ✅ **All Security Issues Fixed** - Addresses issues #5, #7, #8, #9, #10 from the original repo
- 🛡️ **Production Ready** - Battle-tested in Docker/Coolify environments
- ⚡ **Performance Optimized** - Connection pooling, retry logic, resource limits
- 🔍 **Comprehensive Monitoring** - Health checks, performance analysis, logging
- 🐳 **Docker Management** - Built-in container management for self-hosted setups
- 💾 **Backup & Recovery** - Database backup utilities with multiple formats
- 🚀 **Available on Smithery** - Easy deployment through [Smithery.ai](https://smithery.ai/protocol/@mistersandfr/selfhosted-supabase-mcp)

## 📦 Installation

### Via Smithery (Recommended)

The easiest way to use this MCP server is through [Smithery](https://smithery.ai/protocol/@mistersandfr/selfhosted-supabase-mcp):

```bash
npx @smithery/cli install @mistersandfr/selfhosted-supabase-mcp
```

Then configure in your Claude Desktop settings with your Supabase credentials.

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/MisterSandFR/selfhosted-supabase-mcp.git
cd selfhosted-supabase-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start -- --url YOUR_SUPABASE_URL --anon-key YOUR_ANON_KEY
```

### Docker Installation

```bash
# Build the Docker image
docker build -t selfhosted-supabase-mcp .

# Run the container
docker run -e SUPABASE_URL=your_url -e SUPABASE_ANON_KEY=your_key selfhosted-supabase-mcp
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your self-hosted Supabase URL |
| `SUPABASE_ANON_KEY` | ✅ | Anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Service role key for admin operations |
| `DATABASE_URL` | ❌ | Direct PostgreSQL connection for fallback |
| `SUPABASE_AUTH_JWT_SECRET` | ❌ | JWT secret for auth operations |

### Claude Desktop Configuration

Add to your Claude Desktop config file:

```json
{
  "mcp-servers": {
    "selfhosted-supabase": {
      "command": "npx",
      "args": [
        "@smithery/cli",
        "run",
        "@mistersandfr/selfhosted-supabase-mcp"
      ],
      "env": {
        "SUPABASE_URL": "https://your-instance.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "optional-service-key",
        "DATABASE_URL": "optional-postgres-url"
      }
    }
  }
}
```

## 🔒 Security Features

### SQL Injection Prevention
- Query validation and injection pattern detection
- Parameterized query support
- Table/column name validation
- Query complexity limits (100 points max)
- Safe string escaping

### Authentication Security  
- Password strength validation (8+ chars, uppercase, lowercase, number, special char)
- Secure token generation using crypto
- Safe logging without exposing sensitive data
- HMAC signature verification
- Timing-safe comparisons

### Rate Limiting & Resource Control
- 100 requests/minute default limit
- Max 10 concurrent requests
- Query complexity scoring
- Memory limits (256MB max)
- Execution time limits (30s max)
- Adaptive throttling based on system load

### Input Validation
- Comprehensive sanitization for all inputs
- File upload validation
- Protection against prototype pollution
- Object depth limits
- XSS prevention

## 🚀 Features

### 🆕 New in v2.3.0

#### Automatic Migration Management
The new `auto_migrate` tool revolutionizes database migration management:
- **Automatic Detection**: Scans for pending migrations in your `supabase/migrations` folder
- **Smart Application**: Applies migrations in the correct order with transaction support
- **Comprehensive Tracking**: Maintains a detailed history of all applied migrations
- **Error Recovery**: Automatic rollback on failures with detailed error reporting
- **No Manual Intervention**: Eliminates the need to manually execute SQL in Supabase console

**Use Case**: Perfect for CI/CD pipelines and automated deployments. No more "Please execute these SQL queries manually" messages!

### Available Tools

*   **Database Core Operations**
    *   `execute_sql`: Execute raw SQL (with injection protection).
    *   `list_tables`: List database tables and their columns.
    *   `list_extensions`: Show installed PostgreSQL extensions.
*   **Database Performance & Statistics**
    *   `get_database_connections`: Current connection status.
    *   `get_database_stats`: Comprehensive database statistics. 
*   **Schema & Migration Tools**
    *   `list_migrations`: Shows migration history from `supabase_migrations.schema_migrations`.
    *   `apply_migration`: Apply a new migration (Requires direct DB access).
    *   `create_migration`: Create new migration files with proper versioning.
    *   `push_migrations`: Automatically push and apply migrations to your instance.
    *   `validate_migration`: Pre-flight validation before applying migrations.
    *   `auto_migrate`: **NEW** - Automatically detect and apply all pending migrations with transaction support.
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
*   **Logging & Monitoring**
    *   `get_logs`: Retrieves logs from various Supabase services (postgres, auth, storage, realtime) with filtering and level control.
*   **Self-Hosted Operations** 
    *   `check_health`: Comprehensive health checks for all Supabase components (PostgreSQL, Auth, Storage, Realtime) with performance metrics.
    *   `backup_database`: Create database backups with various formats (SQL, custom, tar) and optional storage upload.
    *   `manage_docker`: Manage Docker containers for self-hosted Supabase (status, logs, restart, stop, start, stats).
    *   `analyze_performance`: Deep performance analysis including slow queries, missing indexes, lock contention, and cache statistics.

## 🐳 Docker & Self-Hosted Support

This version includes special optimizations for Docker and Coolify environments:

- **Connection retry logic** with exponential backoff
- **Transient error handling** for ECONNRESET issues
- **Connection pooling** with automatic cleanup
- **Health monitoring** for all Supabase components
- **Container management** tools for Docker environments

## 📚 Documentation

For detailed documentation, security guidelines, and best practices, visit our [Wiki](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki).

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [@HenkDz](https://github.com/HenkDz) - Original creator of selfhosted-supabase-mcp
- The MCP and Supabase communities
- All contributors and security researchers

## ⚠️ Disclaimer

This tool is designed for self-hosted Supabase instances. Always follow security best practices and never expose sensitive credentials.

---


**Made with ❤️ by [MisterSandFR](https://github.com/MisterSandFR)** | Based on original work by [@HenkDz](https://github.com/HenkDz)
