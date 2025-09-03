# Configuration Guide

## Quick Start

### Minimal Configuration

```bash
# Required parameters only
node dist/index.js \
  --url http://localhost:8000 \
  --anon-key your-anon-key
```

### Recommended Production Configuration

```bash
# Full configuration for production
node dist/index.js \
  --url https://your-supabase.com \
  --anon-key your-anon-key \
  --service-key your-service-key \
  --db-url postgresql://user:pass@host:5432/db \
  --jwt-secret your-jwt-secret
```

## Configuration Options

### Required Parameters

| Parameter | CLI Flag | Environment Variable | Description |
|-----------|----------|---------------------|-------------|
| Supabase URL | `--url` | `SUPABASE_URL` | The HTTP(S) URL of your Supabase instance |
| Anonymous Key | `--anon-key` | `SUPABASE_ANON_KEY` | Public anonymous key for basic access |

### Optional Parameters

| Parameter | CLI Flag | Environment Variable | Description |
|-----------|----------|---------------------|-------------|
| Service Role Key | `--service-key` | `SUPABASE_SERVICE_ROLE_KEY` | Admin key for privileged operations |
| Database URL | `--db-url` | `DATABASE_URL` | Direct PostgreSQL connection string |
| JWT Secret | `--jwt-secret` | `SUPABASE_AUTH_JWT_SECRET` | JWT secret for token verification |
| Tools Config | `--tools-config` | - | Path to JSON file for tool whitelisting |
| Workspace Path | `--workspace-path` | - | Root path for file operations |

## Configuration Methods

### 1. Command Line Arguments

```bash
node dist/index.js \
  --url http://localhost:8000 \
  --anon-key eyJhbGc... \
  --db-url postgresql://postgres:password@localhost:5432/postgres
```

### 2. Environment Variables

```bash
# .env file
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_AUTH_JWT_SECRET=your-super-secret-jwt-token

# Run with env vars
node dist/index.js
```

### 3. Docker Environment

```yaml
# docker-compose.yml
version: '3.8'
services:
  supabase-mcp:
    image: supabase-mcp:latest
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    env_file:
      - .env
```

### 4. Tool Whitelisting

Create a `tools-config.json` file:

```json
{
  "enabledTools": [
    "execute_sql",
    "list_tables",
    "list_auth_users",
    "get_database_stats"
  ]
}
```

Use with:
```bash
node dist/index.js --tools-config ./tools-config.json
```

## Client-Specific Configuration

### Claude Desktop

Location: `.claude/mcp.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": [
        "/absolute/path/to/dist/index.js",
        "--url", "http://localhost:8000",
        "--anon-key", "your-key"
      ]
    }
  }
}
```

### Cursor

Location: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": [
        "./dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "http://localhost:8000",
        "SUPABASE_ANON_KEY": "your-key"
      }
    }
  }
}
```

### VS Code with Copilot

Location: `.vscode/mcp.json`

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "supabase-url",
      "description": "Supabase URL",
      "default": "http://localhost:8000"
    },
    {
      "type": "promptString",
      "id": "supabase-key",
      "description": "Supabase Key",
      "password": true
    }
  ],
  "servers": {
    "supabase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "SUPABASE_URL": "${input:supabase-url}",
        "SUPABASE_ANON_KEY": "${input:supabase-key}"
      }
    }
  }
}
```

## Connection Strings

### PostgreSQL Connection Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?[params]
```

Examples:

```bash
# Local development
postgresql://postgres:password@localhost:5432/postgres

# Docker container
postgresql://postgres:password@db:5432/postgres

# With SSL
postgresql://user:pass@host:5432/db?sslmode=require

# With connection pooling
postgresql://user:pass@host:6432/db?pool_mode=transaction
```

### Finding Your Keys

#### Supabase Dashboard
1. Go to Settings → API
2. Copy the `anon` public key
3. Copy the `service_role` secret key (keep secure!)

#### Local Supabase
```bash
# Get keys from local setup
supabase status

# Or check docker-compose.yml
grep ANON_KEY docker-compose.yml
grep SERVICE_ROLE_KEY docker-compose.yml
```

## Advanced Configuration

### Custom Rate Limits

Modify `src/index.ts`:

```typescript
const rateLimiter = new RateLimiter(
  200,    // requests
  60000   // per minute
);
```

### Resource Limits

Modify execution limits:

```typescript
result = await withResourceLimits(
  () => tool.execute(parsedArgs, context),
  { 
    maxExecutionTimeMs: 60000,  // 60 seconds
    maxMemoryMB: 512            // 512 MB
  }
);
```

### Connection Pool Settings

Modify `src/client/index.ts`:

```typescript
this.pgPool = new Pool({
  connectionString: this.options.databaseUrl,
  max: 20,                      // Max connections
  idleTimeoutMillis: 60000,     // Idle timeout
  connectionTimeoutMillis: 5000  // Connection timeout
});
```

## Troubleshooting Configuration

### Common Issues

#### 1. Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Check if PostgreSQL is running and accessible

#### 2. Invalid Key Format
```
Error: Invalid API key
```
**Solution**: Ensure keys are complete (including `eyJ...` prefix)

#### 3. Permission Denied
```
Error: permission denied for function execute_sql
```
**Solution**: Provide service role key and database URL

#### 4. Network Timeout
```
Error: connect ETIMEDOUT
```
**Solution**: Check firewall rules and network connectivity

### Verification Commands

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Test Supabase API
curl -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     $SUPABASE_URL/rest/v1/

# Check server logs
tail -f server.log | grep -E "ERROR|WARN"
```

## Security Recommendations

1. **Use Environment Variables**: Never hardcode credentials
2. **Rotate Keys Regularly**: Change keys periodically
3. **Use Read-Only Users**: When possible, use restricted database users
4. **Enable SSL**: Use SSL/TLS for all connections
5. **Limit Network Access**: Use firewalls and VPNs
6. **Monitor Access**: Enable audit logging

## Example Configurations

### Development Environment

```bash
# .env.development
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=dev-anon-key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

### Staging Environment

```bash
# .env.staging
SUPABASE_URL=https://staging.example.com
SUPABASE_ANON_KEY=staging-anon-key
DATABASE_URL=postgresql://staging_user:pass@staging-db:5432/staging
SUPABASE_SERVICE_ROLE_KEY=staging-service-key
```

### Production Environment

```bash
# .env.production
SUPABASE_URL=https://api.example.com
SUPABASE_ANON_KEY=prod-anon-key
DATABASE_URL=postgresql://prod_user:secure-pass@prod-db:5432/production?sslmode=require
SUPABASE_SERVICE_ROLE_KEY=prod-service-key
SUPABASE_AUTH_JWT_SECRET=ultra-secure-jwt-secret
```