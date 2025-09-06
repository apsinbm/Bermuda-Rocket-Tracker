// Debug script to test launch loading directly
// Run this in browser console

async function debugLaunches() {
    console.log('=== DEBUGGING LAUNCH LOADING ===');
    
    try {
        // Test the launch service directly
        const API_BASE = 'https://ll.thespacedevs.com/2.2.0';
        const params = new URLSearchParams({
            limit: '10',
            launch_service_provider__name: 'SpaceX',
            pad__location__name__icontains: 'florida'
        });
        
        console.log('1. Testing API call...');
        const response = await fetch(`${API_BASE}/launch/upcoming/?${params}`);
        const data = await response.json();
        
        console.log(`2. API returned ${data.results.length} total launches`);
        
        // Filter for Florida launches
        const floridaLaunches = data.results.filter(launch => {
            const locationName = launch.pad.location.name.toLowerCase();
            return (
                locationName.includes('cape canaveral') ||
                locationName.includes('kennedy') ||
                locationName.includes('cafs') ||
                locationName.includes('ksc')
            );
        });
        
        console.log(`3. Found ${floridaLaunches.length} Florida launches:`);
        floridaLaunches.forEach(launch => {
            console.log(`   - ${launch.name} at ${launch.net}`);
        });
        
        // Test date filtering
        const now = new Date();
        const upcoming = floridaLaunches.filter(launch => new Date(launch.net) > now);
        console.log(`4. Found ${upcoming.length} upcoming Florida launches (after ${now.toISOString()})`);
        
        return upcoming;
        
    } catch (error) {
        console.error('Debug error:', error);
    }
}

// Run the debug
debugLaunches();