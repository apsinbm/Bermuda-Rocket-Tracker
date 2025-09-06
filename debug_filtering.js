// Debug script to understand why launches aren't showing
// Paste this into the browser console

(function debugLaunches() {
    console.log('=== DEBUGGING LAUNCH FILTERING ===');
    
    // Check localStorage
    const dbData = localStorage.getItem('bermuda-rocket-launches-db');
    if (dbData) {
        const entries = JSON.parse(dbData);
        console.log('Database entries:', entries.length);
        
        const now = new Date();
        entries.forEach(entry => {
            const launchTime = new Date(entry.data.net);
            const isFuture = launchTime > now;
            console.log(`${entry.data.name}: ${entry.data.net} (${isFuture ? 'FUTURE' : 'PAST'})`);
        });
    } else {
        console.log('No database found');
    }
    
    // Check React state
    const reactRoot = document.getElementById('root');
    if (reactRoot && reactRoot._reactRootContainer) {
        console.log('React app is loaded');
    }
    
    // Test time parsing
    console.log('\n=== TIME PARSING TEST ===');
    const testDates = [
        '2025-08-07T14:01:00Z',
        '2025-08-10T12:16:00Z',
        '2025-08-11T00:07:00Z'
    ];
    
    testDates.forEach(dateStr => {
        const date = new Date(dateStr);
        const now = new Date();
        console.log(`${dateStr} -> ${date.toISOString()} (${date > now ? 'FUTURE' : 'PAST'})`);
    });
    
    console.log(`Current time: ${new Date().toISOString()}`);
})();