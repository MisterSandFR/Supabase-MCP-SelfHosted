// Test script to check which tools fail to load
import fs from 'fs';
import path from 'path';

async function testToolLoading() {
    const toolsDir = './src/tools';
    const toolFiles = fs.readdirSync(toolsDir)
        .filter(file => file.endsWith('.ts') && 
                       file !== 'types.ts' && 
                       file !== 'utils.ts')
        .sort();

    console.log(`Found ${toolFiles.length} tool files:`);
    
    const results = {
        success: [],
        failed: []
    };

    for (const file of toolFiles) {
        const toolName = file.replace('.ts', '');
        try {
            const module = await import(`./src/tools/${file.replace('.ts', '.js')}`);
            const toolObject = Object.values(module).find(
                exp => exp && typeof exp === 'object' && 'name' in exp && 'execute' in exp
            );
            
            if (toolObject) {
                results.success.push({ file, name: toolObject.name });
                console.log(`✅ ${file} -> ${toolObject.name}`);
            } else {
                results.failed.push({ file, error: 'No valid tool object found' });
                console.log(`❌ ${file} -> No valid tool object`);
            }
        } catch (error) {
            results.failed.push({ file, error: error.message });
            console.log(`❌ ${file} -> ${error.message}`);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully loaded: ${results.success.length}`);
    console.log(`❌ Failed to load: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
        console.log(`\n🔍 Failed tools:`);
        results.failed.forEach(({ file, error }) => {
            console.log(`  - ${file}: ${error}`);
        });
    }

    return results;
}

testToolLoading().catch(console.error);
