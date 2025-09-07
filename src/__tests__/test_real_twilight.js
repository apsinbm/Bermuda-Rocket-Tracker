/**
 * Test the actual twilight calculations with the USSF-106 launch
 * This uses a proper solar position algorithm
 */

function toJulianDay(date) {
    const a = Math.floor((14 - date.getUTCMonth() - 1) / 12);
    const y = date.getUTCFullYear() + 4800 - a;
    const m = date.getUTCMonth() + 1 + 12 * a - 3;
    
    return date.getUTCDate() + Math.floor((153 * m + 2) / 5) + 365 * y + 
           Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045 +
           (date.getUTCHours() - 12) / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
}

function calculateSolarElevation(launchTime) {
    const date = new Date(launchTime);
    const BERMUDA_LAT = 32.3078;
    
    // Calculate Julian day number
    const jd = toJulianDay(date);
    
    // Calculate solar position
    const n = jd - 2451545.0; // days since J2000
    const L = (280.460 + 0.9856474 * n) % 360; // mean longitude of sun
    const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180; // mean anomaly
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180; // ecliptic longitude
    
    // Calculate sun's declination
    const delta = Math.asin(Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda));
    
    // Calculate local hour angle (accounting for Bermuda timezone)
    const month = date.getUTCMonth();
    const isDST = month >= 2 && month <= 10; // March through November
    const offsetHours = isDST ? 3 : 4; // UTC-3 for ADT, UTC-4 for AST
    
    const localTime = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));
    const hours = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
    const hourAngle = (15 * (hours - 12)) * Math.PI / 180;
    
    // Calculate solar elevation angle
    const phi = BERMUDA_LAT * Math.PI / 180; // Bermuda latitude in radians
    const elevation = Math.asin(
        Math.sin(phi) * Math.sin(delta) + 
        Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle)
    );
    
    return elevation * 180 / Math.PI; // convert to degrees
}

function getTwilightLevel(solarElevation) {
    if (solarElevation > 0) return 'day';
    if (solarElevation > -6) return 'civil';
    if (solarElevation > -12) return 'nautical';
    if (solarElevation > -18) return 'astronomical';
    return 'night';
}

const testCases = [
    {
        name: "USSF-106 (23:59 UTC = 8:59 PM ADT)",
        time: "2025-08-12T23:59:00Z",
        expectedTwilight: "night"
    },
    {
        name: "Project Kuiper (14:01 UTC = 11:01 AM ADT)",
        time: "2025-08-07T14:01:00Z", 
        expectedTwilight: "day"
    },
    {
        name: "Evening Twilight Test (23:00 UTC = 8:00 PM ADT)",
        time: "2025-08-10T23:00:00Z",
        expectedTwilight: "civil or nautical"
    },
    {
        name: "Dawn Twilight Test (10:00 UTC = 7:00 AM ADT)",
        time: "2025-08-10T10:00:00Z",
        expectedTwilight: "day or civil"
    }
];

console.log('=== TESTING REAL SOLAR ELEVATION CALCULATIONS ===\n');

testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   UTC: ${testCase.time}`);
    
    const date = new Date(testCase.time);
    const adtTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
    console.log(`   ADT: ${adtTime.toLocaleString('en-US')}`);
    
    const solarElevation = calculateSolarElevation(testCase.time);
    const twilightLevel = getTwilightLevel(solarElevation);
    
    console.log(`   Solar elevation: ${solarElevation.toFixed(2)}°`);
    console.log(`   Twilight level: ${twilightLevel}`);
    console.log(`   Expected: ${testCase.expectedTwilight}`);
    
    // Show what this means for visibility
    let visibilityNote;
    switch (twilightLevel) {
        case 'day':
            visibilityNote = '☀️ No rocket visibility - too bright';
            break;
        case 'civil':
            visibilityNote = '🌅 No rocket visibility - still too bright';
            break;
        case 'nautical':
            visibilityNote = '🌆 Possible visibility for very bright rockets';
            break;
        case 'astronomical':
            visibilityNote = '🌌 Good rocket visibility';
            break;
        case 'night':
            visibilityNote = '🌙 Optimal rocket visibility';
            break;
    }
    console.log(`   Visibility: ${visibilityNote}`);
    console.log('');
});

console.log('=== TWILIGHT DEFINITIONS ===');
console.log('☀️  Day: Sun above 0° - rockets invisible');
console.log('🌅 Civil: Sun 0° to -6° below horizon - still too bright');
console.log('🌆 Nautical: Sun -6° to -12° below horizon - very bright rockets may be visible');
console.log('🌌 Astronomical: Sun -12° to -18° below horizon - good viewing conditions');
console.log('🌙 Night: Sun below -18° - optimal rocket visibility');

console.log('\n=== KEY INSIGHT ===');
console.log('The USSF-106 launch at 8:59 PM ADT should now show the correct twilight level');
console.log('instead of just binary day/night, providing much more accurate visibility prediction!');