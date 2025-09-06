/**
 * Debug script to test launch processing pipeline
 * Mimics what App.tsx does to identify the exact failure point
 */

const { fetchSpaceXFloridaLaunches } = require('./src/services/launchService');
const { calculateEnhancedVisibility } = require('./src/services/enhancedVisibilityService');

async function debugLaunchProcessing() {
    console.log('=== DEBUGGING LAUNCH PROCESSING PIPELINE ===\n');
    
    try {
        // Step 1: Fetch launches
        console.log('Step 1: Fetching launches...');
        const launches = await fetchSpaceXFloridaLaunches(10);
        console.log(`✅ Fetched ${launches.length} launches`);
        launches.forEach((launch, i) => {
            console.log(`  ${i + 1}. ${launch.name} - ${launch.net}`);
        });
        
        if (launches.length === 0) {
            console.log('❌ No launches to process - stopping here');
            return;
        }
        
        // Step 2: Process first launch with enhanced visibility
        console.log('\nStep 2: Testing enhanced visibility on first launch...');
        const testLaunch = launches[0];
        console.log(`Processing: ${testLaunch.name}`);
        
        try {
            const visibility = await calculateEnhancedVisibility(testLaunch);
            console.log('✅ Enhanced visibility succeeded:');
            console.log(`  Likelihood: ${visibility.likelihood}`);
            console.log(`  Reason: ${visibility.reason}`);
            console.log(`  Bearing: ${visibility.bearing}`);
            console.log(`  Direction: ${visibility.trajectoryDirection}`);
        } catch (error) {
            console.log('❌ Enhanced visibility failed:');
            console.log(`  Error: ${error.message}`);
            console.log(`  This would trigger fallback in App.tsx`);
        }
        
        // Step 3: Test all launches
        console.log('\nStep 3: Testing all launches...');
        for (let i = 0; i < launches.length; i++) {
            const launch = launches[i];
            console.log(`\nProcessing ${i + 1}/${launches.length}: ${launch.name}`);
            
            try {
                const visibility = await calculateEnhancedVisibility(launch);
                console.log(`✅ Success: ${visibility.likelihood} visibility`);
            } catch (error) {
                console.log(`❌ Failed: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Pipeline failed at launch fetch:', error);
    }
}

// Make sure we handle ES modules vs CommonJS
if (require.main === module) {
    debugLaunchProcessing().catch(console.error);
}