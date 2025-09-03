/**
 * Apify Actor entry point for Self-Hosted Supabase MCP Server
 */

import { Actor } from 'apify';
import { startStandaloneServer } from './server.js';

// Main function for Apify Actor
Actor.main(async () => {
    // Get input from Apify
    const input = await Actor.getInput();
    
    if (!input) {
        throw new Error('No input provided');
    }

    const {
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
        databaseUrl,
        supabaseAuthJwtSecret,
        enableRateLimiting = true,
        maxConcurrentRequests = 10
    } = input;

    // Validate required fields
    if (!supabaseUrl) {
        throw new Error('supabaseUrl is required');
    }
    if (!supabaseAnonKey) {
        throw new Error('supabaseAnonKey is required');
    }

    console.log('Starting Self-Hosted Supabase MCP Server on Apify...');
    console.log(`Supabase URL: ${supabaseUrl}`);
    console.log(`Rate limiting: ${enableRateLimiting ? 'Enabled' : 'Disabled'}`);
    console.log(`Max concurrent requests: ${maxConcurrentRequests}`);

    try {
        // Start the MCP server
        await startStandaloneServer({
            url: supabaseUrl,
            anonKey: supabaseAnonKey,
            serviceKey: supabaseServiceRoleKey,
            dbUrl: databaseUrl,
            jwtSecret: supabaseAuthJwtSecret,
            workspacePath: process.cwd(),
            enableRateLimiting,
            maxConcurrentRequests
        });

        // Log successful start
        await Actor.pushData({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'MCP Server started successfully',
            config: {
                supabaseUrl,
                hasServiceKey: !!supabaseServiceRoleKey,
                hasDbUrl: !!databaseUrl,
                hasJwtSecret: !!supabaseAuthJwtSecret,
                enableRateLimiting,
                maxConcurrentRequests
            }
        });

        console.log('MCP Server is running and ready to accept connections');
        
        // Keep the actor running
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Failed to start MCP server:', error);
        
        // Log error to dataset
        await Actor.pushData({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Failed to start MCP server',
            error: error.message,
            stack: error.stack
        });
        
        throw error;
    }
});