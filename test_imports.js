// Simple test to check if all imports work
const path = require('path');
const fs = require('fs');

// Change to the project directory
process.chdir('/Users/pato/bermuda-rocket-tracker');

console.log('Testing critical imports...');

// Check if main files exist
const criticalFiles = [
  'src/App.tsx',
  'src/services/notificationService.ts',
  'src/services/enhancedVisibilityService.ts',
  'src/services/trajectoryService.ts',
  'src/services/imageAnalysisService.ts',
  'src/hooks/useLaunchData.ts'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

console.log('\nChecking package.json dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = Object.keys(packageJson.dependencies || {});
const devDeps = Object.keys(packageJson.devDependencies || {});

console.log('Dependencies:', deps.join(', '));
console.log('DevDependencies:', devDeps.slice(0, 5).join(', '), '...');

console.log('\nTesting simple node startup...');