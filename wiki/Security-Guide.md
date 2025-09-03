# Security Guide

## Overview

This enhanced version of the Self-Hosted Supabase MCP Server includes comprehensive security improvements to protect against common vulnerabilities and attacks.

## Security Features

### 1. SQL Injection Prevention

The server implements multiple layers of SQL injection prevention:

- **Query Validation**: All SQL queries are validated against known injection patterns
- **Parameter Sanitization**: Input parameters are sanitized before use
- **Identifier Validation**: Table and column names are validated against PostgreSQL naming rules
- **Query Complexity Limits**: Complex queries are analyzed and limited to prevent resource exhaustion

#### Implementation Details

```typescript
// Example of SQL validation in action
import { validateSqlQuery } from './utils/sql-sanitizer';

// This will throw an error if injection is detected
validateSqlQuery(userProvidedSql);
```

### 2. Authentication Security

#### Password Requirements

All passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Secure Password Handling

- Passwords are validated before processing
- No plain text passwords in logs
- Secure hashing using bcrypt (via PostgreSQL's `crypt` function)
- Timing-safe comparisons to prevent timing attacks

### 3. Rate Limiting

The server implements adaptive rate limiting to prevent abuse:

- **Default Limit**: 100 requests per minute per client
- **Concurrent Requests**: Maximum 10 concurrent requests
- **Adaptive Throttling**: Automatically adjusts based on system load
- **Query Complexity**: Each query is scored for complexity

#### Rate Limit Headers

The server returns rate limit information in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

### 4. Input Validation

All inputs are validated and sanitized:

- **String Sanitization**: Removes dangerous characters and patterns
- **Object Depth Limits**: Prevents deeply nested object attacks
- **File Upload Validation**: Checks file types, sizes, and names
- **XSS Prevention**: HTML entities are escaped
- **Prototype Pollution Protection**: Special properties are filtered

### 5. Resource Controls

To prevent resource exhaustion:

- **Memory Limit**: 256MB maximum per request
- **Execution Time**: 30 seconds maximum per query
- **Query Complexity**: 100 points maximum complexity score
- **Connection Pool**: Limited to 10 concurrent database connections

## Security Best Practices

### 1. Environment Configuration

```bash
# Use environment variables for sensitive data
export SUPABASE_URL=https://your-instance.com
export SUPABASE_ANON_KEY=your-anon-key
export DATABASE_URL=postgresql://user:pass@host:5432/db
export SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Never commit .env files
echo ".env" >> .gitignore
```

### 2. Network Security

- **Use HTTPS**: Always use HTTPS in production
- **Firewall Rules**: Restrict database access to trusted IPs
- **VPN/Private Networks**: Use private networks for database connections
- **SSL/TLS**: Enable SSL for PostgreSQL connections

### 3. Access Control

- **Principle of Least Privilege**: Grant minimum necessary permissions
- **Role-Based Access**: Use different keys for different access levels
- **Audit Logging**: Monitor all database operations
- **Regular Key Rotation**: Rotate keys periodically

### 4. Monitoring

Monitor for suspicious activity:

```bash
# Check rate limit violations
grep "Rate limit exceeded" server.log

# Monitor failed authentication attempts
grep "Authentication failed" server.log

# Track SQL injection attempts
grep "SQL injection detected" server.log
```

### 5. Updates and Patches

- Keep all dependencies updated
- Monitor security advisories
- Apply patches promptly
- Regular security audits

## Common Attack Vectors and Mitigations

### SQL Injection
**Attack**: Malicious SQL in user input
**Mitigation**: Query validation, parameterized queries, input sanitization

### Password Attacks
**Attack**: Weak passwords, brute force
**Mitigation**: Strong password policies, rate limiting, account lockout

### Resource Exhaustion
**Attack**: Complex queries, infinite loops
**Mitigation**: Query complexity limits, execution timeouts, memory limits

### Cross-Site Scripting (XSS)
**Attack**: Malicious scripts in data
**Mitigation**: Input sanitization, output encoding, Content-Security-Policy

### Denial of Service (DoS)
**Attack**: Overwhelming the server
**Mitigation**: Rate limiting, connection limits, resource controls

## Security Checklist

- [ ] Environment variables configured for all secrets
- [ ] DATABASE_URL configured for direct connection
- [ ] Rate limiting enabled
- [ ] Strong passwords enforced
- [ ] Network firewall configured
- [ ] SSL/TLS enabled
- [ ] Monitoring configured
- [ ] Audit logging enabled
- [ ] Regular backups scheduled
- [ ] Security updates applied

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** create a public GitHub issue
2. Email security details to the maintainer
3. Include steps to reproduce
4. Allow time for a fix before public disclosure

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)