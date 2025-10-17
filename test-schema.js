// Test script to verify schema loading
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('Testing GenVR schema loading...');

try {
  // Try to read the JSON files directly
  const schemasPath = join(process.cwd(), 'node_modules', 'genvr-mcp-server-lite', 'dist', 'schemas-cache.json');
  const modelsPath = join(process.cwd(), 'node_modules', 'genvr-mcp-server-lite', 'dist', 'curated-models.json');
  
  console.log('Reading schemas from:', schemasPath);
  const schemasCache = JSON.parse(readFileSync(schemasPath, 'utf8'));
  
  console.log('Reading models from:', modelsPath);
  const curatedModels = JSON.parse(readFileSync(modelsPath, 'utf8'));
  
  console.log('✅ Successfully loaded schemas:', Object.keys(schemasCache).length, 'schemas');
  console.log('✅ Successfully loaded models:', curatedModels.curatedModels.length, 'models');
  
  // Test a few schemas
  const sampleKeys = Object.keys(schemasCache).slice(0, 3);
  console.log('\nSample schemas:');
  sampleKeys.forEach(key => {
    const schema = schemasCache[key];
    console.log(`- ${key}:`, schema.properties ? Object.keys(schema.properties) : 'No properties');
  });
  
  // Test model keys
  const modelKeys = curatedModels.curatedModels.map(model => `${model.category}/${model.subcategory}`);
  console.log('\nSample model keys:', modelKeys.slice(0, 5));
  
} catch (error) {
  console.error('❌ Error loading schemas:', error.message);
}
