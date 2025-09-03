# 🔒 Self-Hosted Supabase MCP - Enhanced Security Edition

[![Security: Enhanced](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Security-Guide)
[![Version: 2.0.0](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/releases)

**The most secure and production-ready MCP server for self-hosted Supabase instances.**

## ✨ What Makes This Different?

This is an **enhanced security fork** of the original project by [@HenkDz](https://github.com/HenkDz), specifically designed for production environments with:

### 🛡️ Enterprise-Grade Security
- **SQL Injection Prevention** - Every query is validated and sanitized
- **Strong Authentication** - Passwords require 8+ chars with complexity
- **Rate Limiting** - 100 requests/minute with adaptive throttling
- **Resource Controls** - Memory (256MB) and execution time (30s) limits

### 🚀 Production Features
- **Connection Resilience** - Automatic retry with exponential backoff
- **Docker/Coolify Optimized** - Enhanced pooling for containers
- **Direct DB Connection** - Bypass JWT issues with PostgreSQL direct access
- **Comprehensive Logging** - Without exposing sensitive data

## 📦 Quick Installation

```bash
npx -y @smithery/cli install @MisterSandFR/selfhosted-supabase-mcp-secure --client claude
```

## ⚙️ Configuration

When prompted, provide:

1. **Supabase URL** (required) - Your instance URL
2. **Anonymous Key** (required) - Public anon key
3. **Database URL** (recommended) - Direct PostgreSQL connection
4. **Service Role Key** (optional) - For admin operations

### Example Configuration

```json
{
  "supabaseUrl": "http://localhost:8000",
  "supabaseAnonKey": "eyJhbGc...",
  "databaseUrl": "postgresql://postgres:password@localhost:5432/postgres",
  "supabaseServiceRoleKey": "eyJhbGc..."
}
```

## 🔧 Available Tools

### Database Operations
- `execute_sql` - Run SQL with injection prevention
- `list_tables` - View database structure
- `apply_migration` - Safe migration execution
- `get_database_stats` - Performance metrics

### Authentication Management
- `create_auth_user` - Create users with strong passwords
- `update_auth_user` - Secure user updates
- `list_auth_users` - User management
- `delete_auth_user` - Safe user deletion

### Development Tools
- `generate_typescript_types` - Auto-generate types
- `list_storage_buckets` - Storage management
- `verify_jwt_secret` - JWT verification

## 🐳 Docker/Coolify Support

Specifically optimized for containerized environments with:
- Connection pooling with keep-alive
- Automatic reconnection on network issues
- Enhanced timeout configurations
- Docker-friendly connection parameters

## 📊 Security Features in Action

### SQL Injection Prevention
```sql
-- This will be blocked:
SELECT * FROM users; DROP TABLE users;--

-- This will be validated and sanitized:
SELECT * FROM users WHERE email = 'user@example.com'
```

### Password Validation
```javascript
// Requires: 8+ chars, uppercase, lowercase, number, special char
"SecureP@ss123" ✅
"password" ❌
```

### Rate Limiting
- 100 requests per minute per client
- 10 maximum concurrent requests
- Automatic throttling under load

## 🔗 Resources

- [GitHub Repository](https://github.com/MisterSandFR/selfhosted-supabase-mcp)
- [Security Guide](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Security-Guide)
- [Configuration Guide](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Configuration-Guide)
- [Troubleshooting](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Troubleshooting)
- [API Reference](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/API-Reference)

## 🏆 Why Choose This Version?

| Feature | Original | Enhanced Security Edition |
|---------|----------|--------------------------|
| SQL Injection Protection | ❌ | ✅ Comprehensive validation |
| Password Security | Basic | ✅ Strong policy enforced |
| Rate Limiting | ❌ | ✅ 100 req/min + adaptive |
| Connection Retry | ❌ | ✅ Exponential backoff |
| Docker Optimization | Basic | ✅ Full container support |
| Resource Limits | ❌ | ✅ Memory & time limits |
| Secure Logging | ❌ | ✅ No credential exposure |
| Production Ready | ⚠️ | ✅ Battle-tested |

## 🤝 Credits

- Original project by [@HenkDz](https://github.com/HenkDz/selfhosted-supabase-mcp)
- Enhanced security features by [@MisterSandFR](https://github.com/MisterSandFR)

## 📄 License

MIT - See [LICENSE](https://github.com/MisterSandFR/selfhosted-supabase-mcp/blob/main/LICENSE)

## 🚨 Security Notice

This tool provides direct database access. Always:
- Use strong, unique passwords
- Configure DATABASE_URL for production
- Enable rate limiting
- Monitor logs for suspicious activity
- Keep dependencies updated

---

**Ready for Production** | **Fully Documented** | **Actively Maintained**