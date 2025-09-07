-- OAuth2 Complete Implementation Example
-- This demonstrates how the enhanced MCP Supabase tools can now handle complex schemas

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create OAuth2 core tables
CREATE TABLE oauth2_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    grants TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
    is_confidential BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE oauth2_authorization_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(255) UNIQUE NOT NULL,
    client_id UUID REFERENCES oauth2_clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(20) CHECK (code_challenge_method IN ('plain', 'S256')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE oauth2_access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(500) UNIQUE NOT NULL,
    client_id UUID REFERENCES oauth2_clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE oauth2_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(500) UNIQUE NOT NULL,
    access_token_id UUID REFERENCES oauth2_access_tokens(id) ON DELETE CASCADE,
    client_id UUID REFERENCES oauth2_clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_oauth2_clients_client_id ON oauth2_clients(client_id);
CREATE INDEX idx_oauth2_authorization_codes_code ON oauth2_authorization_codes(code);
CREATE INDEX idx_oauth2_authorization_codes_client_user ON oauth2_authorization_codes(client_id, user_id);
CREATE INDEX idx_oauth2_authorization_codes_expires ON oauth2_authorization_codes(expires_at);
CREATE INDEX idx_oauth2_access_tokens_token ON oauth2_access_tokens(token);
CREATE INDEX idx_oauth2_access_tokens_client_user ON oauth2_access_tokens(client_id, user_id);
CREATE INDEX idx_oauth2_access_tokens_expires ON oauth2_access_tokens(expires_at);
CREATE INDEX idx_oauth2_refresh_tokens_token ON oauth2_refresh_tokens(token);
CREATE INDEX idx_oauth2_refresh_tokens_access_token ON oauth2_refresh_tokens(access_token_id);

-- Create RLS policies for security
ALTER TABLE oauth2_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth2_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth2_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth2_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- OAuth2 clients can only be managed by service role
CREATE POLICY oauth2_clients_service_only ON oauth2_clients
    FOR ALL USING (auth.role() = 'service_role');

-- Authorization codes: users can only see their own
CREATE POLICY oauth2_auth_codes_user_access ON oauth2_authorization_codes
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Access tokens: users can only see their own
CREATE POLICY oauth2_access_tokens_user_access ON oauth2_access_tokens
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Refresh tokens: users can only see their own
CREATE POLICY oauth2_refresh_tokens_user_access ON oauth2_refresh_tokens
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- OAuth2 utility functions
CREATE OR REPLACE FUNCTION generate_oauth2_client_secret()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_authorization_code()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_access_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(64), 'base64url');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_refresh_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(64), 'base64url');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create OAuth2 client
CREATE OR REPLACE FUNCTION create_oauth2_client(
    p_name TEXT,
    p_redirect_uris TEXT[],
    p_grants TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token'],
    p_scopes TEXT[] DEFAULT ARRAY['read', 'write'],
    p_is_confidential BOOLEAN DEFAULT true
)
RETURNS TABLE(
    client_id TEXT,
    client_secret TEXT
) AS $$
DECLARE
    v_client_id TEXT;
    v_client_secret TEXT;
BEGIN
    v_client_id := 'client_' || encode(gen_random_bytes(16), 'base64url');
    v_client_secret := generate_oauth2_client_secret();
    
    INSERT INTO oauth2_clients (client_id, client_secret, name, redirect_uris, grants, scopes, is_confidential)
    VALUES (v_client_id, crypt(v_client_secret, gen_salt('bf')), p_name, p_redirect_uris, p_grants, p_scopes, p_is_confidential);
    
    RETURN QUERY SELECT v_client_id, v_client_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate OAuth2 client
CREATE OR REPLACE FUNCTION validate_oauth2_client(
    p_client_id TEXT,
    p_client_secret TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_client RECORD;
BEGIN
    SELECT * INTO v_client 
    FROM oauth2_clients 
    WHERE client_id = p_client_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- If client is confidential, check secret
    IF v_client.is_confidential AND p_client_secret IS NOT NULL THEN
        RETURN v_client.client_secret = crypt(p_client_secret, v_client.client_secret);
    ELSIF v_client.is_confidential AND p_client_secret IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create authorization code
CREATE OR REPLACE FUNCTION create_authorization_code(
    p_client_id TEXT,
    p_user_id UUID,
    p_redirect_uri TEXT,
    p_scopes TEXT[],
    p_code_challenge TEXT DEFAULT NULL,
    p_code_challenge_method TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_client_uuid UUID;
BEGIN
    -- Get client UUID
    SELECT id INTO v_client_uuid FROM oauth2_clients WHERE client_id = p_client_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid client_id';
    END IF;
    
    v_code := generate_authorization_code();
    
    INSERT INTO oauth2_authorization_codes (
        code, client_id, user_id, redirect_uri, scopes, 
        code_challenge, code_challenge_method, expires_at
    )
    VALUES (
        v_code, v_client_uuid, p_user_id, p_redirect_uri, p_scopes,
        p_code_challenge, p_code_challenge_method, NOW() + INTERVAL '10 minutes'
    );
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to exchange authorization code for tokens
CREATE OR REPLACE FUNCTION exchange_authorization_code(
    p_code TEXT,
    p_client_id TEXT,
    p_redirect_uri TEXT,
    p_code_verifier TEXT DEFAULT NULL
)
RETURNS TABLE(
    access_token TEXT,
    refresh_token TEXT,
    expires_in INTEGER,
    token_type TEXT,
    scope TEXT
) AS $$
DECLARE
    v_auth_code RECORD;
    v_access_token TEXT;
    v_refresh_token TEXT;
    v_access_token_id UUID;
    v_client_uuid UUID;
BEGIN
    -- Get client UUID
    SELECT id INTO v_client_uuid FROM oauth2_clients WHERE client_id = p_client_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid client_id';
    END IF;
    
    -- Get and validate authorization code
    SELECT ac.*, c.client_id as client_id_check
    INTO v_auth_code
    FROM oauth2_authorization_codes ac
    JOIN oauth2_clients c ON ac.client_id = c.id
    WHERE ac.code = p_code
      AND c.client_id = p_client_id
      AND ac.redirect_uri = p_redirect_uri
      AND ac.expires_at > NOW()
      AND ac.used_at IS NULL;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired authorization code';
    END IF;
    
    -- Validate PKCE if present
    IF v_auth_code.code_challenge IS NOT NULL THEN
        IF p_code_verifier IS NULL THEN
            RAISE EXCEPTION 'Code verifier required';
        END IF;
        
        IF v_auth_code.code_challenge_method = 'S256' THEN
            IF v_auth_code.code_challenge != encode(digest(p_code_verifier, 'sha256'), 'base64url') THEN
                RAISE EXCEPTION 'Invalid code verifier';
            END IF;
        ELSIF v_auth_code.code_challenge_method = 'plain' THEN
            IF v_auth_code.code_challenge != p_code_verifier THEN
                RAISE EXCEPTION 'Invalid code verifier';
            END IF;
        END IF;
    END IF;
    
    -- Mark authorization code as used
    UPDATE oauth2_authorization_codes 
    SET used_at = NOW() 
    WHERE code = p_code;
    
    -- Generate tokens
    v_access_token := generate_access_token();
    v_refresh_token := generate_refresh_token();
    
    -- Create access token
    INSERT INTO oauth2_access_tokens (token, client_id, user_id, scopes, expires_at)
    VALUES (v_access_token, v_client_uuid, v_auth_code.user_id, v_auth_code.scopes, NOW() + INTERVAL '1 hour')
    RETURNING id INTO v_access_token_id;
    
    -- Create refresh token
    INSERT INTO oauth2_refresh_tokens (token, access_token_id, client_id, user_id, expires_at)
    VALUES (v_refresh_token, v_access_token_id, v_client_uuid, v_auth_code.user_id, NOW() + INTERVAL '30 days');
    
    RETURN QUERY SELECT 
        v_access_token,
        v_refresh_token,
        3600 as expires_in,
        'Bearer' as token_type,
        array_to_string(v_auth_code.scopes, ' ') as scope;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh access token
CREATE OR REPLACE FUNCTION refresh_access_token(
    p_refresh_token TEXT,
    p_client_id TEXT
)
RETURNS TABLE(
    access_token TEXT,
    refresh_token TEXT,
    expires_in INTEGER,
    token_type TEXT,
    scope TEXT
) AS $$
DECLARE
    v_refresh_record RECORD;
    v_new_access_token TEXT;
    v_new_refresh_token TEXT;
    v_new_access_token_id UUID;
    v_client_uuid UUID;
BEGIN
    -- Get client UUID
    SELECT id INTO v_client_uuid FROM oauth2_clients WHERE client_id = p_client_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid client_id';
    END IF;
    
    -- Get refresh token details
    SELECT rt.*, at.scopes
    INTO v_refresh_record
    FROM oauth2_refresh_tokens rt
    JOIN oauth2_access_tokens at ON rt.access_token_id = at.id
    JOIN oauth2_clients c ON rt.client_id = c.id
    WHERE rt.token = p_refresh_token
      AND c.client_id = p_client_id
      AND rt.expires_at > NOW()
      AND rt.revoked_at IS NULL;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired refresh token';
    END IF;
    
    -- Revoke old tokens
    UPDATE oauth2_access_tokens 
    SET revoked_at = NOW() 
    WHERE id = v_refresh_record.access_token_id;
    
    UPDATE oauth2_refresh_tokens 
    SET revoked_at = NOW() 
    WHERE token = p_refresh_token;
    
    -- Generate new tokens
    v_new_access_token := generate_access_token();
    v_new_refresh_token := generate_refresh_token();
    
    -- Create new access token
    INSERT INTO oauth2_access_tokens (token, client_id, user_id, scopes, expires_at)
    VALUES (v_new_access_token, v_client_uuid, v_refresh_record.user_id, v_refresh_record.scopes, NOW() + INTERVAL '1 hour')
    RETURNING id INTO v_new_access_token_id;
    
    -- Create new refresh token
    INSERT INTO oauth2_refresh_tokens (token, access_token_id, client_id, user_id, expires_at)
    VALUES (v_new_refresh_token, v_new_access_token_id, v_client_uuid, v_refresh_record.user_id, NOW() + INTERVAL '30 days');
    
    RETURN QUERY SELECT 
        v_new_access_token,
        v_new_refresh_token,
        3600 as expires_in,
        'Bearer' as token_type,
        array_to_string(v_refresh_record.scopes, ' ') as scope;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate access token
CREATE OR REPLACE FUNCTION validate_access_token(p_token TEXT)
RETURNS TABLE(
    user_id UUID,
    client_id TEXT,
    scopes TEXT[],
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT at.user_id, c.client_id, at.scopes, at.expires_at
    FROM oauth2_access_tokens at
    JOIN oauth2_clients c ON at.client_id = c.id
    WHERE at.token = p_token
      AND at.expires_at > NOW()
      AND at.revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth2_tokens()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    -- Delete expired authorization codes
    DELETE FROM oauth2_authorization_codes WHERE expires_at < NOW();
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Delete expired access tokens
    DELETE FROM oauth2_access_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS v_deleted_count = v_deleted_count + ROW_COUNT;
    
    -- Delete expired refresh tokens
    DELETE FROM oauth2_refresh_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS v_deleted_count = v_deleted_count + ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to cleanup expired tokens (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-oauth2-tokens', '0 2 * * *', 'SELECT cleanup_expired_oauth2_tokens();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON oauth2_clients TO service_role;
GRANT ALL ON oauth2_authorization_codes TO service_role;
GRANT ALL ON oauth2_access_tokens TO service_role;
GRANT ALL ON oauth2_refresh_tokens TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_oauth2_client TO service_role;
GRANT EXECUTE ON FUNCTION validate_oauth2_client TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION create_authorization_code TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION exchange_authorization_code TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION refresh_access_token TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION validate_access_token TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth2_tokens TO service_role;

-- Example usage:
-- 1. Create OAuth2 client
-- SELECT * FROM create_oauth2_client('My App', ARRAY['https://myapp.com/callback']);

-- 2. Create authorization code (after user authorization)
-- SELECT create_authorization_code('client_xxx', 'user-uuid', 'https://myapp.com/callback', ARRAY['read', 'write']);

-- 3. Exchange code for tokens
-- SELECT * FROM exchange_authorization_code('code_xxx', 'client_xxx', 'https://myapp.com/callback');

-- 4. Validate access token
-- SELECT * FROM validate_access_token('token_xxx');

-- 5. Refresh tokens
-- SELECT * FROM refresh_access_token('refresh_token_xxx', 'client_xxx');
