# Self-Hosted Supabase MCP Server - Enhanced Security Edition

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
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
*   **Logging & Monitoring**
    *   `get_logs`: Retrieves logs from various Supabase services (postgres, auth, storage, realtime) with filtering and level control.
*   **Self-Hosted Operations** (New)
    *   `check_health`: Comprehensive health checks for all Supabase components (PostgreSQL, Auth, Storage, Realtime) with performance metrics.
    *   `backup_database`: Create database backups with various formats (SQL, custom, tar) and optional storage upload.
    *   `manage_docker`: Manage Docker containers for self-hosted Supabase (status, logs, restart, stop, start, stats).
    *   `analyze_performance`: Deep performance analysis including slow queries, missing indexes, lock contention, and cache statistics.
    *   `validate_migration`: Pre-flight validation of migration files to detect potential issues before applying. 
