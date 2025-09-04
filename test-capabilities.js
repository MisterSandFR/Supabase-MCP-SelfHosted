// Test to access server capabilities
import createServer from './dist/index-smithery.js';

console.log('Testing server capabilities access...');

try {
    const server = createServer({ config: {} });
    console.log('✅ Server created successfully');
    
    // Try to access _capabilities
    if (server._capabilities) {
        console.log('🎯 Found _capabilities!');
        
        if (server._capabilities.tools) {
            const tools = server._capabilities.tools;
            console.log(`📊 Tools in capabilities: ${Object.keys(tools).length}`);
            
            // List first 10 tool names
            const toolNames = Object.keys(tools).slice(0, 10);
            console.log('🔧 First 10 tools:', toolNames);
            
            if (Object.keys(tools).length > 10) {
                console.log(`   ... and ${Object.keys(tools).length - 10} more tools`);
            }
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