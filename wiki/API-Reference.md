# API Reference

## Available Tools

### Database Operations

#### execute_sql
Executes arbitrary SQL queries with injection prevention.

**Parameters:**
- `sql` (string, required): The SQL query to execute
- `read_only` (boolean, optional): Hint for read-only operations (default: false)

**Returns:** Array of result rows

**Example:**
```json
{
  "sql": "SELECT * FROM users LIMIT 10",
  "read_only": true
}
```

**Security:** 
- SQL injection prevention
- Query complexity analysis
- Rate limited
- Resource controlled

---

#### list_tables
Lists all tables in the database schemas.

**Parameters:**
- `schemas` (array, optional): Schemas to search (default: ["public"])
- `include_columns` (boolean, optional): Include column information (default: false)

**Returns:** Array of table information

---

#### list_extensions
Lists installed PostgreSQL extensions.

**Parameters:** None

**Returns:** Array of extension details

---

#### apply_migration
Applies a SQL migration script within a transaction.

**Parameters:**
- `version` (string, required): Migration version (e.g., "20240101120000")
- `name` (string, optional): Migration name
- `sql` (string, required): SQL DDL content

**Returns:** Success status with version

**Security:**
- Requires direct database connection
- Transaction-wrapped
- Rollback on error

---

### Authentication Management

#### create_auth_user
Creates a new user with secure password validation.

**Parameters:**
- `email` (string, required): Valid email address
- `password` (string, required): Password (min 8 chars with complexity)
- `role` (string, optional): User role (default: "authenticated")
- `app_metadata` (object, optional): Application metadata
- `user_metadata` (object, optional): User metadata

**Returns:** Created user object

**Security:**
- Strong password validation
- Email format validation
- Secure password hashing
- No plain text logging

---

#### update_auth_user
Updates user details securely.

**Parameters:**
- `user_id` (string, required): UUID of user to update
- `email` (string, optional): New email address
- `password` (string, optional): New password (validated)
- `role` (string, optional): New role
- `app_metadata` (object, optional): New app metadata
- `user_metadata` (object, optional): New user metadata

**Returns:** Updated user object

---

#### delete_auth_user
Deletes a user from auth.users.

**Parameters:**
- `user_id` (string, required): UUID of user to delete

**Returns:** Success confirmation

---

#### list_auth_users
Lists all authentication users.

**Parameters:**
- `limit` (number, optional): Maximum results (default: 100)
- `offset` (number, optional): Pagination offset

**Returns:** Array of user objects

---

#### get_auth_user
Retrieves details for a specific user.

**Parameters:**
- `user_id` (string, required): UUID of user

**Returns:** User object with details

---

### Project Configuration

#### get_project_url
Returns the configured Supabase URL.

**Parameters:** None

**Returns:** String URL

---

#### get_anon_key
Returns the configured anonymous key.

**Parameters:** None

**Returns:** String key

---

#### get_service_key
Returns the service role key if configured.

**Parameters:** None

**Returns:** String key or undefined

---

#### verify_jwt_secret
Verifies JWT secret configuration.

**Parameters:** None

**Returns:** Verification status and preview

---

### Database Statistics

#### get_database_connections
Shows active database connections.

**Parameters:**
- `database` (string, optional): Filter by database

**Returns:** Array of connection details from pg_stat_activity

---

#### get_database_stats
Retrieves comprehensive database statistics.

**Parameters:**
- `include_tables` (boolean, optional): Include table stats
- `include_indexes` (boolean, optional): Include index stats

**Returns:** Statistics object

---

### Development Tools

#### generate_typescript_types
Generates TypeScript types from database schema.

**Parameters:**
- `schemas` (array, optional): Schemas to include (default: ["public"])
- `output_format` (string, optional): Format type ("types" or "interfaces")

**Returns:** TypeScript definitions as string

---

#### rebuild_hooks
Attempts to restart pg_net worker for webhooks.

**Parameters:** None

**Returns:** Restart status

---

### Storage Operations

#### list_storage_buckets
Lists all storage buckets.

**Parameters:** None

**Returns:** Array of bucket objects

---

#### list_storage_objects
Lists objects within a bucket.

**Parameters:**
- `bucket_id` (string, required): Bucket identifier
- `prefix` (string, optional): Path prefix filter
- `limit` (number, optional): Maximum results

**Returns:** Array of storage objects

---

### Realtime

#### list_realtime_publications
Lists PostgreSQL publications for realtime.

**Parameters:** None

**Returns:** Array of publication details

---

## Error Responses

All tools may return error responses in the following format:

```typescript
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: string;
    hint?: string;
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `MCP_CLIENT_ERROR` | Client configuration issue |
| `MCP_CONFIG_ERROR` | Missing configuration |
| `MCP_POOL_ERROR` | Database pool error |
| `MCP_RPC_EXCEPTION` | RPC execution error |
| `MCP_RPC_FORMAT_ERROR` | Invalid RPC response |
| `MCP_MAX_RETRIES_EXCEEDED` | Connection retry limit reached |
| `PG_ERROR` | PostgreSQL error |
| `23505` | Unique constraint violation |
| `42883` | Undefined function |
| `PGRST202` | PostgREST function not found |

## Rate Limiting

### Headers

Response headers for rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200000
```

### Limits

Default limits per client:
- **Requests**: 100 per minute
- **Concurrent**: 10 maximum
- **Complexity**: 100 points per query

## Resource Limits

### Query Execution

- **Timeout**: 30 seconds default
- **Memory**: 256MB maximum
- **Result Size**: Limited by memory

### Connection Pool

- **Max Connections**: 10
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 10 seconds

## Security Features

### Input Validation

All inputs are validated for:
- SQL injection patterns
- XSS attempts
- Path traversal
- Prototype pollution
- Buffer overflow

### Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter  
- At least 1 number
- At least 1 special character

### Query Analysis

Queries are scored for complexity based on:
- Operation types (SELECT, JOIN, etc.)
- Nesting levels
- Aggregate functions
- Query length

## Usage Examples

### Basic Query

```javascript
const result = await mcp.call('execute_sql', {
  sql: 'SELECT id, email FROM auth.users LIMIT 10',
  read_only: true
});
```

### Create User

```javascript
const user = await mcp.call('create_auth_user', {
  email: 'user@example.com',
  password: 'SecureP@ss123',
  user_metadata: {
    full_name: 'John Doe'
  }
});
```

### Apply Migration

```javascript
const migration = await mcp.call('apply_migration', {
  version: '20240101120000',
  name: 'create_profiles_table',
  sql: `
    CREATE TABLE profiles (
      id UUID PRIMARY KEY,
      username VARCHAR(50) UNIQUE
    );
  `
});
```

### Get Statistics

```javascript
const stats = await mcp.call('get_database_stats', {
  include_tables: true,
  include_indexes: true
});
```

## Best Practices

1. **Use read_only flag** for SELECT queries
2. **Batch operations** when possible
3. **Handle errors gracefully** with try-catch
4. **Respect rate limits** with exponential backoff
5. **Validate inputs** before sending
6. **Use transactions** for multi-step operations
7. **Monitor resource usage** via logs
8. **Keep queries simple** to avoid complexity limits