// Test script to debug Smithery module import
import createServer from './dist/index-smithery.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

console.log('Testing Smithery module import...');

try {
    // Test creating server with empty config
    const server = createServer({ config: {} });
    console.log('✅ Server created successfully');
    
    // Test the ListTools handler directly
    try {
        // Create a mock request
        const mockRequest = {
            method: 'tools/list',
            params: {}
        };
        
        // Try to call the list tools handler
        const toolsResponse = await server.callRequestHandler(ListToolsRequestSchema, mockRequest);
        
        if (toolsResponse && toolsResponse.tools) {
            console.log(`📊 Tools detected: ${toolsResponse.tools.length}`);
            
            // List first 10 tool names
            const toolNames = toolsResponse.tools.slice(0, 10).map(tool => tool.name);
            console.log('🔧 First 10 tools:', toolNames);
            
            if (toolsResponse.tools.length > 10) {
                console.log('   ... and', toolsResponse.tools.length - 10, 'more tools');
            }
        } else {
            console.log('❌ No tools in response');
        }
        
    } catch (handlerError) {
        console.error('❌ Error calling ListTools handler:', handlerError.message);
    }
    
} catch (error) {
    console.error('❌ Error creating server:', error.message);
    console.error('Stack:', error.stack);
}