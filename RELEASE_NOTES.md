# 🔒 Enhanced Security Edition v2.0.0

## 🌟 Major Security Release

This is a comprehensive security-enhanced fork of the original [selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp) by [@HenkDz](https://github.com/HenkDz).

## ✅ Security Fixes & Enhancements

### Fixed Issues
- **#5** - Coolify connection issues with ECONNRESET errors
- **#7** - SQL injection vulnerabilities  
- **#8** - Plain text password handling
- **#9** - Missing input validation and sanitization
- **#10** - Lack of rate limiting and resource controls

### New Security Features
- 🛡️ **SQL Injection Prevention**: Comprehensive query validation and sanitization
- 🔐 **Secure Authentication**: Strong password policies (8+ chars, complexity requirements)
- ✅ **Input Validation**: Complete sanitization across all endpoints
- ⚡ **Rate Limiting**: 100 requests/minute with adaptive throttling
- 📊 **Resource Controls**: Memory (256MB) and execution time (30s) limits
- 🔄 **Connection Resilience**: Automatic retry logic with exponential backoff
- 🐳 **Docker Optimized**: Enhanced pooling for containerized environments

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/moatus/ng-supabase-mcp.git
cd ng-supabase-mcp

# Install and build
npm install
npm run build

# Run with security features
node dist/index.js --url <your-url> --anon-key <your-key> --db-url <postgres-url>
```

## 📚 Documentation

Complete documentation available in the [Wiki](https://github.com/moatus/ng-supabase-mcp/wiki):
- [Security Guide](https://github.com/moatus/ng-supabase-mcp/wiki/Security-Guide)
- [Configuration Guide](https://github.com/moatus/ng-supabase-mcp/wiki/Configuration-Guide)
- [Troubleshooting](https://github.com/moatus/ng-supabase-mcp/wiki/Troubleshooting)
- [API Reference](https://github.com/moatus/ng-supabase-mcp/wiki/API-Reference)

## 🙏 Credits

- Original project by [@HenkDz](https://github.com/HenkDz)
- Enhanced security features by [@moatus](https://github.com/moatus)

## ⚠️ Breaking Changes

- Passwords now require minimum 8 characters with complexity
- Rate limiting is enabled by default
- Query complexity limits are enforced

## 🔧 Requirements

- Node.js 18.x or later
- PostgreSQL connection string (recommended for production)
- Supabase instance (self-hosted or cloud)

## 📈 What's Changed

### Added
- Comprehensive SQL injection prevention system
- Strong password validation (8+ chars, uppercase, lowercase, number, special)
- Input validation and sanitization utilities
- Rate limiting (100 req/min) and concurrency control (10 max)
- Query complexity analyzer
- Resource usage tracking and limits
- Connection retry logic with exponential backoff
- Docker/Coolify optimized connection pooling
- Secure logging without exposing sensitive data
- HMAC signature verification
- Timing-safe comparisons
- Wiki documentation

### Fixed
- ECONNRESET errors in Coolify deployments
- SQL injection vulnerabilities in all SQL tools
- Plain text password logging
- Missing input validation
- Undefined error in SQL response handling
- Connection pool exhaustion
- JWT authentication bypass using direct DB connection

### Changed
- Enhanced README with security documentation
- Improved error handling across all tools
- Better connection resilience for containerized environments
- Secure password handling in auth tools

### Security
- All SQL queries now validated for injection patterns
- Passwords require complexity (uppercase, lowercase, number, special char)
- Rate limiting prevents abuse
- Resource limits prevent DoS attacks
- Input sanitization prevents XSS
- Safe logging prevents credential exposure

---

**Full Changelog**: https://github.com/moatus/ng-supabase-mcp/compare/v1.0.0...v2.0.0