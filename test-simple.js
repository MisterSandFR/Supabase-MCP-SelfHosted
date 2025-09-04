// Simple test to count tools directly
import createServer from './dist/index-smithery.js';

console.log('Simple test - counting tools directly...');

try {
    // Get the function source to understand what's happening
    const serverFunc = createServer.toString();
    
    // Look for the availableTools object creation
    const availableToolsMatch = serverFunc.match(/availableTools\s*=\s*\{[\s\S]*?\}\s*;/);
    
    if (availableToolsMatch) {
        // Count the number of tool entries
        const toolEntries = availableToolsMatch[0].match(/\[.*\.name\]:/g);
        console.log(`🔍 Found ${toolEntries?.length || 0} tool entries in availableTools`);
    }
    
    // Also try to create the server and check the object keys
    const server = createServer({ config: {} });
    console.log('✅ Server created successfully');
    
    // Try to access the internal state somehow
    console.log('🔧 Server properties:', Object.keys(server));
    
} catch (error) {
    console.error('❌ Error:', error.message);
}