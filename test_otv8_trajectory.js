/**
 * OTV-8 Trajectory Direction Test Script
 * Tests the critical trajectory direction consistency for OTV-8 (X-37B) USSF-36
 */

console.log('=== OTV-8 TRAJECTORY DIRECTION TEST ===');
console.log('Testing fix for trajectory direction mismatch');
console.log('Expected: OTV-8 should show Northeast consistently across all views');

// Test the core trajectory service logic
async function testTrajectoryService() {
  const { getTrajectoryData } = require('./src/services/trajectoryService');
  
  // Mock OTV-8 launch data
  const otvLaunch = {
    id: '2d5f2335-c3c2-4306-9dde-8ec37f348ccf',
    name: 'Falcon 9 Block 5 | OTV-8 (X-37B) (USSF-36)',
    mission: {
      name: 'OTV-8 (X-37B) (USSF-36)',
      orbit: { name: 'Low Earth Orbit' }
    },
    rocket: { name: 'Falcon 9 Block 5' },
    pad: {
      name: 'Launch Complex 39A',
      location: {
        name: 'Kennedy Space Center, FL, USA'
      }
    },
    net: '2025-08-21T00:00:00Z'
  };
  
  console.log('\n--- Testing Trajectory Service ---');
  console.log(`Mission: ${otvLaunch.mission.name}`);
  
  try {
    // Get trajectory data
    const trajectoryData = await getTrajectoryData(otvLaunch);
    
    console.log(`Source: ${trajectoryData.source}`);
    console.log(`Points: ${trajectoryData.points.length}`);
    console.log(`Trajectory Direction: ${trajectoryData.trajectoryDirection}`);
    console.log(`Confidence: ${trajectoryData.confidence}`);
    
    // Test the X-37B override
    if (trajectoryData.trajectoryDirection === 'Northeast') {
      console.log('✅ PASS: OTV-8 trajectory direction correctly set to Northeast');
      return true;
    } else {
      console.log(`❌ FAIL: OTV-8 trajectory direction is ${trajectoryData.trajectoryDirection}, expected Northeast`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ ERROR testing trajectory service:', error.message);
    return false;
  }
}

// Test the enhanced visibility service
async function testEnhancedVisibility() {
  const { calculateEnhancedVisibility } = require('./src/services/enhancedVisibilityService');
  
  const otvLaunch = {
    id: '2d5f2335-c3c2-4306-9dde-8ec37f348ccf',
    name: 'Falcon 9 Block 5 | OTV-8 (X-37B) (USSF-36)',
    mission: {
      name: 'OTV-8 (X-37B) (USSF-36)',
      orbit: { name: 'Low Earth Orbit' }
    },
    rocket: { name: 'Falcon 9 Block 5' },
    pad: {
      name: 'Launch Complex 39A',
      location: {
        name: 'Kennedy Space Center, FL, USA'
      },
      latitude: '28.608389',
      longitude: '-80.604333'
    },
    net: '2025-08-21T00:00:00Z'
  };
  
  console.log('\n--- Testing Enhanced Visibility Service ---');
  
  try {
    const visibility = await calculateEnhancedVisibility(otvLaunch);
    
    console.log(`Likelihood: ${visibility.likelihood}`);
    console.log(`Reason: ${visibility.reason}`);
    console.log(`Trajectory Direction: ${visibility.trajectoryDirection}`);
    
    // Check if trajectory direction is correct
    if (visibility.trajectoryDirection === 'Northeast') {
      console.log('✅ PASS: Enhanced visibility service returns Northeast trajectory');
      return true;
    } else {
      console.log(`❌ FAIL: Enhanced visibility shows ${visibility.trajectoryDirection}, expected Northeast`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ ERROR testing enhanced visibility:', error.message);
    return false;
  }
}

// Test visibility service
async function testVisibilityService() {
  const { getTrajectoryInfo } = require('./src/services/visibilityService');
  
  console.log('\n--- Testing Visibility Service ---');
  
  const trajectoryInfo = getTrajectoryInfo(
    'Launch Complex 39A',
    'Low Earth Orbit',
    'OTV-8 (X-37B) (USSF-36)'
  );
  
  console.log(`Direction: ${trajectoryInfo.direction}`);
  console.log(`Visibility: ${trajectoryInfo.visibility}`);
  console.log(`Bearing: ${trajectoryInfo.bearing}`);
  
  if (trajectoryInfo.direction === 'Northeast') {
    console.log('✅ PASS: Visibility service returns Northeast for X-37B');
    return true;
  } else {
    console.log(`❌ FAIL: Visibility service returns ${trajectoryInfo.direction}, expected Northeast`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('\n🧪 Starting trajectory direction consistency tests...\n');
  
  const results = [];
  
  // Test 1: Trajectory Service
  const test1 = await testTrajectoryService();
  results.push({ name: 'Trajectory Service', passed: test1 });
  
  // Test 2: Enhanced Visibility Service
  const test2 = await testEnhancedVisibility();
  results.push({ name: 'Enhanced Visibility Service', passed: test2 });
  
  // Test 3: Basic Visibility Service
  const test3 = await testVisibilityService();
  results.push({ name: 'Visibility Service', passed: test3 });
  
  // Summary
  console.log('\n=== TEST RESULTS SUMMARY ===');
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.name}`);
  });
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! OTV-8 trajectory direction fix is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. The trajectory direction fix needs attention.');
  }
}

// Run the tests
runTests().catch(console.error);