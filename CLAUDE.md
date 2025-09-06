# Bermuda Rocket Tracker - Project Documentation

## Overview
A React web application that tracks upcoming SpaceX rocket launches visible from Bermuda, providing real-time visibility calculations, trajectory visualizations, and launch notifications.

## Current Status (September 6, 2025)

### Major Fixes Completed
1. **Launch Data Not Displaying**: ✅ **FIXED** (August 6, 2025)
   - **Root Cause**: App was not filtering out completed launches by status
   - **Solution**: Added status filtering to remove "Launch Successful", "Failure", "Cancelled" launches
   - **Result**: App now shows 16+ upcoming launches correctly

2. **Trajectory Visualization Animation**: ✅ **FIXED** (August 6, 2025)
   - **Root Cause**: Animation logic treated `currentTime` as array index instead of seconds
   - **Solution**: Changed `currentTime` to represent seconds, convert to array index with `Math.floor(currentTime / 10)`
   - **Result**: Animation now runs smoothly from 0 to full trajectory duration

3. **Trajectory Visualization Complete Overhaul**: ✅ **FIXED** (September 6, 2025)
   - **Issues Fixed**:
     - Dark theme inconsistency 
     - Missing modal close controls (X button, Escape key)
     - Incorrect Florida coastline showing Miami/Jacksonville in ocean
     - KOMPSAT-7A trajectory calculation error (Northeast vs Southeast)
     - Poor visibility indicators on trajectory path
     - Confusing data source display ("none" instead of "Simulated")
     - Zoom functionality making map unusable
   - **Solutions Applied**:
     - Enhanced SSO/retrograde orbit detection for proper Southeast trajectories
     - Fixed Florida coastline coordinates for accurate geography
     - Improved visibility indicators (every 3rd point, white borders, larger size)
     - Removed zoom controls for fixed comprehensive view
     - Added proper modal controls and dark theme integration
     - Enhanced data source clarity with "Simulated" badges

### Recent Fixes Applied
1. **API Endpoint Alignment**: Fixed launchDataService using wrong endpoint (location__ids=27,12 → SpaceX Florida filter)
2. **Cache Management**: Added automatic stale data clearing on startup
3. **Force Refresh**: Enhanced to properly clear all caches
4. **Production Build**: Removed debug logging for cleaner output

## Running the Application

### Development Mode
```bash
npm start
# Runs on http://localhost:3000
```

### Production Mode
```bash
npm run build
node all-interfaces-server.js
# Runs on http://172.20.10.2:8080
```

### Alternative Servers (if localhost issues)
```bash
# Simple Node.js server
node simple-server.js

# Python server
cd build && python3 -m http.server 8080

# Express server (requires npm install express)
node server.js
```

## Debug Tools

### Browser Debug Panel
- Located at bottom-right corner when app is running
- Shows current time, raw launches count, cached launches
- "Clear Cache & Reload" button for troubleshooting

### Debug HTML Page
Access at `http://[server]:8080/debug.html`
- Check localStorage database status
- Clear database manually
- Test API calls directly

### Console Debug Scripts
```javascript
// Clear all caches
localStorage.removeItem('bermuda-rocket-launches-db');
localStorage.removeItem('bermuda-rocket-db-metadata');
window.location.reload();
```

## Architecture & Key Services

### Data Flow
1. **launchDataService.ts**: Main service managing launch data
   - Database-first approach with API fallback
   - Smart refresh scheduling based on launch proximity
   - Auto-clears stale data on startup

2. **launchDatabase.ts**: LocalStorage-based caching
   - Stores launch data to avoid API rate limits
   - Filters past launches automatically
   - Phase-based update scheduling

3. **visibilityService.ts**: Calculates launch visibility from Bermuda
   - Uses real trajectory data when available
   - Falls back to orbital mechanics calculations
   - Considers time of day and trajectory direction

4. **trajectoryService.ts**: Fetches real trajectory data
   - Flight Club telemetry (primary)
   - Space Launch Schedule images (secondary)
   - Orbital mechanics calculations (fallback)

### API Configuration
- Primary: `https://ll.thespacedevs.com/2.2.0/launch/upcoming/`
- Filters: `launch_service_provider__name=SpaceX&pad__location__name__icontains=florida`
- Florida locations: Cape Canaveral, Kennedy Space Center, CAFS, KSC

### Key Components
- **LaunchCard**: Displays individual launch information
- **TrajectoryVisualization**: Interactive trajectory map (has animation bug)
- **NotificationSettings**: Configure launch reminders
- **DebugPanel**: Temporary debugging component

## Common Issues & Solutions

### No Launches Showing
1. Check debug panel for launch counts
2. Verify current time vs launch times (timezone issues)
3. Clear cache using debug panel button
4. Check browser console for errors

### API Rate Limiting
- App uses intelligent caching to minimize API calls
- Database stores launches with update schedules
- Force refresh clears cache if needed

### Network/Localhost Issues
- If localhost doesn't work, use IP address (127.0.0.1)
- Try network IP (172.20.10.2) if local IPs fail
- Check macOS firewall settings
- Verify no proxy interference

## Development Notes

### Environment Detection
- Uses `isBrowser()` checks to prevent server-side Canvas usage
- Graceful fallbacks for SSR compatibility

### Trajectory Calculation Hierarchy
1. Real telemetry data (Flight Club)
2. Space Launch Schedule trajectory images
3. Orbital mechanics (inclination → azimuth)
4. Mission type assumptions (legacy fallback)

### Update Schedule Phases
- 24h before: Daily updates
- 12h before: 12-hour updates
- 2h before: 2-hour updates
- 30m before: 30-minute updates
- 10m before: 10-minute updates

## Testing

### Manual Testing
1. Force refresh button in header
2. Debug panel "Clear Cache & Reload"
3. Monitor panel shows update urgency
4. Browser console for detailed logs

### API Testing
```bash
# Test SpaceX Florida launches
curl "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&launch_service_provider__name=SpaceX&pad__location__name__icontains=florida"

# Run debug script
node debug_api.js
```

## TODO List
1. Fix launch data filtering issue (16 launches loaded but none displayed)
2. Fix trajectory animation stuck at 10 seconds
3. Add mobile responsiveness and PWA features
4. Remove debug panel after issues resolved

## File Structure
```
src/
├── components/
│   ├── LaunchCard.tsx
│   ├── TrajectoryVisualization.tsx
│   ├── NotificationSettings.tsx
│   └── DebugPanel.tsx (temporary)
├── services/
│   ├── launchDataService.ts (main data orchestrator)
│   ├── launchDatabase.ts (localStorage cache)
│   ├── launchService.ts (API calls)
│   ├── visibilityService.ts (visibility calculations)
│   ├── trajectoryService.ts (trajectory data)
│   └── trajectoryMappingService.ts (orbital mechanics)
├── hooks/
│   └── useLaunchData.ts (React hook for data)
└── utils/
    ├── timeUtils.ts
    ├── coordinateUtils.ts
    └── environmentUtils.ts
```

## Deployment
Currently runs locally. For production deployment:
1. Set up proper environment variables
2. Configure CORS for API access
3. Use proper SSL certificates
4. Set up monitoring for API failures
5. Implement proper error boundaries

## Contact & Support
This project tracks SpaceX launches visible from Bermuda, calculating real-time visibility based on trajectory data and providing notifications for optimal viewing times.