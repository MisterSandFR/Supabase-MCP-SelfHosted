# Troubleshooting Guide

## Common Issues and Solutions

### Connection Issues

#### ECONNRESET Error
```
Error: read ECONNRESET
```

**Causes:**
- Network interruption
- Docker container networking issues
- Firewall blocking connections

**Solutions:**
1. The enhanced version includes automatic retry logic
2. Ensure DATABASE_URL is configured for direct connection
3. Check Docker network settings:
```bash
docker network ls
docker network inspect bridge
```
4. Verify firewall rules allow PostgreSQL port (5432)

#### ETIMEDOUT Error
```
Error: connect ETIMEDOUT
```

**Solutions:**
1. Increase connection timeout in configuration
2. Check if the database host is reachable:
```bash
ping your-db-host
telnet your-db-host 5432
```
3. Verify VPN connection if required

#### Connection Pool Errors
```
Error: pg Pool not available
```

**Solutions:**
1. Ensure DATABASE_URL is properly formatted
2. Check PostgreSQL is running:
```bash
systemctl status postgresql
# or
docker ps | grep postgres
```
3. Verify connection string:
```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

### Authentication Issues

#### Invalid Password Format
```
Error: Password validation failed
```

**Causes:**
- Password doesn't meet security requirements

**Solutions:**
Password must have:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*...)

#### JWT Token Issues
```
Error: JWT token is invalid
```

**Solutions:**
1. Verify JWT secret is correct:
```bash
echo $SUPABASE_AUTH_JWT_SECRET
```
2. Check token expiration
3. Ensure service role key has proper permissions

#### API Key Issues
```
Error: Invalid API key
```

**Solutions:**
1. Verify key format (should start with `eyJ`)
2. Check key hasn't been rotated
3. Ensure using correct key type (anon vs service role)

### SQL Execution Issues

#### SQL Injection Detected
```
Error: Potential SQL injection detected in query
```

**Causes:**
- Query contains suspicious patterns
- Unbalanced quotes
- Multiple statements detected

**Solutions:**
1. Review query for injection patterns
2. Use parameterized queries when possible
3. Escape special characters properly

#### Query Too Complex
```
Error: Query complexity (150) exceeds limit (100)
```

**Solutions:**
1. Simplify query structure
2. Break complex queries into smaller parts
3. Reduce number of JOINs
4. Optimize subqueries

#### Execute SQL Function Missing
```
Error: execute_sql RPC function not found
```

**Solutions:**
1. Provide both service key and database URL:
```bash
node dist/index.js \
  --service-key your-service-key \
  --db-url postgresql://...
```
2. Manually create the function:
```sql
CREATE OR REPLACE FUNCTION public.execute_sql(
  query text, 
  read_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t' INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_sql TO authenticated;
```

### Rate Limiting Issues

#### Rate Limit Exceeded
```
Error: Rate limit exceeded. Please retry after 45 seconds
```

**Solutions:**
1. Wait for the specified time
2. Reduce request frequency
3. Batch operations when possible
4. Configure higher limits if needed

#### Too Many Concurrent Requests
```
Error: Too many concurrent requests
```

**Solutions:**
1. Queue requests instead of parallel execution
2. Implement request throttling
3. Increase concurrency limit in configuration

### Resource Limit Issues

#### Memory Limit Exceeded
```
Error: Memory limit exceeded: 300MB > 256MB
```

**Solutions:**
1. Reduce result set size with LIMIT
2. Optimize query to return less data
3. Increase memory limit in configuration
4. Stream large results if possible

#### Execution Time Exceeded
```
Error: Execution time limit exceeded: 35000ms > 30000ms
```

**Solutions:**
1. Optimize slow queries
2. Add appropriate indexes
3. Increase timeout in configuration
4. Break operation into smaller chunks

### Docker/Container Issues

#### Cannot Connect from Container
```
Error: Cannot connect to host.docker.internal
```

**Solutions:**
1. Use proper Docker networking:
```yaml
services:
  mcp-server:
    network_mode: host  # For Linux
    # OR
    extra_hosts:
      - "host.docker.internal:host-gateway"  # For Mac/Windows
```

2. Use container names for inter-container communication:
```bash
DATABASE_URL=postgresql://postgres:pass@db-container:5432/postgres
```

#### Permission Denied in Container
```
Error: EACCES: permission denied
```

**Solutions:**
1. Check file permissions
2. Run container with appropriate user:
```dockerfile
USER node
```
3. Set correct ownership:
```bash
chown -R node:node /app
```

### Debugging Techniques

#### Enable Verbose Logging

Add debug statements to track execution:
```typescript
console.error('Debug:', { 
  url: options.url,
  hasServiceKey: !!options.serviceKey,
  hasDbUrl: !!options.dbUrl 
});
```

#### Test Individual Components

1. Test database connection:
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(console.log).catch(console.error);
"
```

2. Test Supabase client:
```bash
curl -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     $SUPABASE_URL/rest/v1/
```

#### Check Server Logs

Monitor logs in real-time:
```bash
# Follow server output
node dist/index.js 2>&1 | tee server.log

# Watch for errors
tail -f server.log | grep -E "ERROR|error|Error"

# Check rate limiting
grep "Rate limit" server.log

# Monitor SQL execution
grep "Executing SQL" server.log
```

### Platform-Specific Issues

#### Windows Path Issues
```
Error: Cannot find module 'C:Userspath...'
```

**Solutions:**
1. Use forward slashes in paths
2. Escape backslashes properly
3. Use `path.resolve()` for cross-platform paths

#### Linux Permission Issues
```
Error: EACCES: permission denied
```

**Solutions:**
```bash
# Fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Fix file permissions
chmod +x dist/index.js
```

#### macOS Security Issues
```
Error: macOS cannot verify the developer
```

**Solutions:**
1. Allow in System Preferences → Security & Privacy
2. Use `xattr -d com.apple.quarantine`
3. Sign the application properly

## Getting Help

### Diagnostic Information to Collect

When reporting issues, include:

1. **Environment Details:**
```bash
node --version
npm --version
cat package.json | grep version
```

2. **Configuration (sanitized):**
```bash
echo "URL: $SUPABASE_URL"
echo "Has anon key: $([ -n "$SUPABASE_ANON_KEY" ] && echo yes || echo no)"
echo "Has DB URL: $([ -n "$DATABASE_URL" ] && echo yes || echo no)"
```

3. **Error Messages:**
- Complete error stack trace
- Relevant log entries
- Network traces if applicable

4. **Steps to Reproduce:**
- Exact command used
- Input data (sanitized)
- Expected vs actual behavior

### Support Channels

- **GitHub Issues**: [Report bugs](https://github.com/moatus/ng-supabase-mcp/issues)
- **Discussions**: [Ask questions](https://github.com/moatus/ng-supabase-mcp/discussions)
- **Wiki**: [Documentation](https://github.com/moatus/ng-supabase-mcp/wiki)

### Emergency Recovery

If the server is completely broken:

1. **Reset to clean state:**
```bash
git stash
git pull origin main
npm ci
npm run build
```

2. **Use minimal configuration:**
```bash
node dist/index.js \
  --url http://localhost:8000 \
  --anon-key your-key
```

3. **Gradually add features:**
- Test basic connection
- Add database URL
- Add service key
- Enable specific tools