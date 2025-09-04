// Test the TypeScript version directly
import createServer from './src/index-smithery.js';

console.log('Testing TypeScript Smithery version...');

try {
    const server = createServer({ config: {} });
    console.log('✅ Server created successfully');
    
    // Try to access _capabilities
    if (server._capabilities) {
        console.log('🎯 Found _capabilities!');
        
        if (server._capabilities.tools) {
            const tools = server._capabilities.tools;
            console.log(`📊 Tools in capabilities: ${Object.keys(tools).length}`);
            
            // List all tool names
            const toolNames = Object.keys(tools);
            console.log('🔧 All tools:', toolNames);
            
        } else {
            console.log('❌ No tools in capabilities');
        }
    } else {
        console.log('❌ No _capabilities found');
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
}