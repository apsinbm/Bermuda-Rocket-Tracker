/**
 * Test the new twilight-aware visibility calculations
 */

// Test launches at different times of day
const testLaunches = [
    {
        id: "day-launch",
        name: "Falcon 9 | Day Launch Test", 
        net: "2025-08-10T16:00:00Z", // 1:00 PM ADT - full daylight
        mission: { name: "Day Test", orbit: { name: "LEO" } },
        pad: { name: "LC-39A", latitude: "28.6084", longitude: "-80.6041", location: { name: "KSC, FL" } },
        rocket: { name: "Falcon 9" }, status: { name: "Go" }
    },
    {
        id: "civil-twilight",
        name: "Falcon 9 | Civil Twilight Test", 
        net: "2025-08-10T23:30:00Z", // 8:30 PM ADT - civil twilight
        mission: { name: "Civil Test", orbit: { name: "LEO" } },
        pad: { name: "LC-39A", latitude: "28.6084", longitude: "-80.6041", location: { name: "KSC, FL" } },
        rocket: { name: "Falcon 9" }, status: { name: "Go" }
    },
    {
        id: "nautical-twilight",
        name: "Falcon 9 | Nautical Twilight Test", 
        net: "2025-08-10T00:30:00Z", // 9:30 PM ADT - nautical twilight
        mission: { name: "Nautical Test", orbit: { name: "GTO" } },
        pad: { name: "SLC-40", latitude: "28.5622", longitude: "-80.577", location: { name: "CCSFS, FL" } },
        rocket: { name: "Falcon 9" }, status: { name: "Go" }
    },
    {
        id: "astronomical-twilight",
        name: "Falcon 9 | Astronomical Twilight Test", 
        net: "2025-08-10T01:15:00Z", // 10:15 PM ADT - astronomical twilight
        mission: { name: "Astro Test", orbit: { name: "GTO" } },
        pad: { name: "SLC-40", latitude: "28.5622", longitude: "-80.577", location: { name: "CCSFS, FL" } },
        rocket: { name: "Falcon 9" }, status: { name: "Go" }
    },
    {
        id: "true-night",
        name: "Falcon 9 | True Night Test", 
        net: "2025-08-10T05:00:00Z", // 2:00 AM ADT - true night
        mission: { name: "Night Test", orbit: { name: "GTO" } },
        pad: { name: "SLC-40", latitude: "28.5622", longitude: "-80.577", location: { name: "CCSFS, FL" } },
        rocket: { name: "Falcon 9" }, status: { name: "Go" }
    }
];

console.log('=== TESTING TWILIGHT-AWARE VISIBILITY CALCULATIONS ===\n');

// Simulate the twilight calculation functions
function calculateSolarElevation(launchTime) {
    const date = new Date(launchTime);
    
    // Simplified solar elevation calculation for testing
    // This is a rough approximation - the actual calculation is more complex
    const month = date.getUTCMonth();
    const isDST = month >= 2 && month <= 10;
    const offsetHours = isDST ? 3 : 4;
    
    const localTime = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));
    const hours = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
    
    // Simple sinusoidal approximation of sun elevation throughout the day
    // Peak at noon (12:00), minimum at midnight (0:00/24:00)
    const hourAngle = (hours - 12) * 15; // degrees from solar noon
    const maxElevation = 80; // approximate max sun elevation in August in Florida
    const elevation = maxElevation * Math.cos(hourAngle * Math.PI / 180) - 10; // rough approximation
    
    return elevation;
}

function getTwilightLevel(solarElevation) {
    if (solarElevation > 0) return 'day';
    if (solarElevation > -6) return 'civil';
    if (solarElevation > -12) return 'nautical';  
    if (solarElevation > -18) return 'astronomical';
    return 'night';
}

function getTrajectoryDirection(launch) {
    const orbit = launch.mission.orbit?.name?.toLowerCase() || '';
    if (orbit.includes('gto')) return 'Southeast';
    return 'Northeast';
}

function getLikelihoodWithTwilight(twilightLevel, trajectory) {
    switch (twilightLevel) {
        case 'day':
        case 'civil':
            return 'none';
        case 'nautical':
            return trajectory === 'Southeast' ? 'low' : 'none';
        case 'astronomical':
            return trajectory === 'Southeast' ? 'medium' : 'low';
        case 'night':
            return trajectory === 'Southeast' ? 'high' : 'medium';
        default:
            return 'low';
    }
}

// Test each launch
testLaunches.forEach((launch, index) => {
    console.log(`${index + 1}. Testing: ${launch.name}`);
    console.log(`   Launch time: ${launch.net}`);
    
    // Calculate ADT time
    const launchDate = new Date(launch.net);
    const adtTime = new Date(launchDate.getTime() - (3 * 60 * 60 * 1000)); // UTC-3 for ADT
    const timeString = adtTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    console.log(`   ADT time: ${timeString}`);
    
    const solarElevation = calculateSolarElevation(launch.net);
    const twilightLevel = getTwilightLevel(solarElevation);
    const trajectory = getTrajectoryDirection(launch);
    const likelihood = getLikelihoodWithTwilight(twilightLevel, trajectory);
    
    console.log(`   Solar elevation: ${solarElevation.toFixed(1)}°`);
    console.log(`   Twilight level: ${twilightLevel}`);
    console.log(`   Trajectory: ${trajectory}`);
    console.log(`   Visibility: ${likelihood}`);
    
    // Create reason text
    let reason;
    switch (twilightLevel) {
        case 'day':
            reason = `☀️ Daytime launch - rockets invisible against bright blue sky`;
            break;
        case 'civil':
            reason = `🌅 Civil twilight - still too bright to see rockets`;
            break;
        case 'nautical':
            reason = `🌆 Nautical twilight - very bright rockets may be visible`;
            break;
        case 'astronomical':
            reason = `🌌 Astronomical twilight - good viewing conditions`;
            break;
        case 'night':
            reason = `🌙 True night - optimal viewing conditions`;
            break;
    }
    
    console.log(`   Reason: ${reason}`);
    console.log('   ✅ Calculation completed\n');
});

console.log('=== TWILIGHT CATEGORIES EXPLAINED ===');
console.log('☀️  Day: Sun above horizon - rockets invisible');
console.log('🌅 Civil: Sun 0° to -6° - still too bright');
console.log('🌆 Nautical: Sun -6° to -12° - getting dark, bright rockets may be visible');
console.log('🌌 Astronomical: Sun -12° to -18° - good viewing conditions');
console.log('🌙 Night: Sun below -18° - optimal rocket visibility');