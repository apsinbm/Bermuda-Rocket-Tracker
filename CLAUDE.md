# Bermuda Rocket Tracker - Project Documentation

## Overview
A React web application that tracks upcoming SpaceX rocket launches visible from Bermuda, providing real-time visibility calculations, trajectory visualizations, and launch notifications.

## Current Status (September 7, 2025)

### Latest Updates
4. **Flight Club API Integration**: ✅ **COMPLETED** (September 7, 2025)
   - **Added**: Secure API proxy infrastructure using Vercel serverless functions
   - **Created**: `/api/flightclub/missions.ts` - Mission discovery with caching and rate limiting
   - **Created**: `/api/flightclub/simulation/[missionId].ts` - Telemetry processing for Bermuda calculations
   - **Created**: `/src/services/flightClubApiService.ts` - Client-side service with viewing instructions
   - **Security**: API key protection, CORS handling, and production error handling
   - **Performance**: 15-minute caching for missions, 5-minute caching for simulation data

5. **Cross-Platform Mobile Optimization**: ✅ **COMPLETED** (September 7, 2025)
   - **Enhanced Responsive Design**: Mobile-first approach with comprehensive breakpoint system
   - **Touch Optimization**: 44px minimum touch targets, tap highlight removal, touch manipulation
   - **iOS/Android Support**: Safe area insets for notched devices, platform-specific optimizations  
   - **PWA Enhancements**: Mobile app capabilities, theme color support, orientation handling
   - **Performance**: Hardware acceleration, smooth scrolling, reduced motion support
   - **Accessibility**: Focus-visible support, keyboard navigation, screen reader compatibility

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

### Comprehensive Code Quality Audit (September 7, 2025)
**Major Achievement**: ✅ **COMPLETED** - Full codebase audit and optimization

**Issues Addressed:**
1. **Security Vulnerabilities**: Fixed 7/9 npm vulnerabilities (78% improvement)
   - Eliminated all high-severity issues
   - Updated nth-check, PostCSS, and other critical dependencies
   - Added npm overrides for secure dependency versions

2. **Debug Code Cleanup**: Removed 245+ console.log statements (100% production cleanup)
   - Systematic removal from 40+ service files
   - Preserved essential error logging (console.error)
   - Achieved clean production console output

3. **TypeScript Type Safety**: Fixed all 21 'any' types with proper interfaces
   - Created LaunchChanges, TrajectoryPoint, and ErrorInput interfaces
   - Fixed Jest test matcher types with proper generics
   - Enhanced error handling with proper type guards

4. **Service Architecture Consolidation**: Removed duplicate service variants
   - Deleted 5 unused service files (enhanced/Simple/legacy versions)
   - Consolidated from 36 to 31 service files
   - Fixed all import references to use single-source services

5. **File Organization**: Moved 21 test files from root to src/__tests__
   - Created proper test directory structure
   - Cleaned root directory for professional appearance
   - Maintained test functionality

6. **GitHub Actions**: Fixed health check workflow
   - Updated app title match ("Bermuda Rocket Launch Tracker")
   - Fixed bundle size check with proper curl commands
   - Eliminated recurring failure notification emails

7. **TODO/FIXME Cleanup**: Addressed all 7 outstanding comments
   - Removed outdated TODO in trajectoryService.ts
   - Updated future enhancement comments (OCR features)
   - Clean codebase ready for production

**Results:**
- Production build compiles successfully
- Clean console output in production
- Enhanced security posture
- Professional code organization
- Maintainable architecture

### Previous Fixes Applied
1. **API Endpoint Alignment**: Fixed launchDataService using wrong endpoint (location__ids=27,12 → SpaceX Florida filter)
2. **Cache Management**: Added automatic stale data clearing on startup
3. **Force Refresh**: Enhanced to properly clear all caches
4. **Production Build**: Removed debug logging for cleaner output

## Running the Application

### Development Mode
```bash
npm start
# Runs on http://localhost:3000
# Note: FlightClub 3D visualization will use demo mode (API endpoints not available)
```

### FlightClub Professional Features (3D Visualization)
For full FlightClub Professional features with real trajectory data:

1. **Set up API Key**:
   ```bash
   # Copy .env.example to .env
   cp .env.example .env
   
   # Edit .env and add your FlightClub API key:
   # FLIGHTCLUB_API_KEY=your_flight_club_api_key_here
   ```

2. **Use Vercel Development Server** (required for API endpoints):
   ```bash
   vercel dev
   # Runs with API endpoints on http://localhost:3000
   ```

3. **Alternative Development Setup**:
   ```bash
   # Install Vercel CLI globally if not already installed
   npm install -g vercel
   
   # Login to Vercel (if not already logged in)
   vercel login
   
   # Run development server with API support
   vercel dev
   ```

### Demo Mode vs Full Mode

| Feature | `npm start` (Demo Mode) | `vercel dev` (Full Mode) |
|---------|-------------------------|--------------------------|
| Basic app functionality | ✅ | ✅ |
| Launch visibility calculations | ✅ | ✅ |
| FlightClub Professional tab | ✅ Demo data | ✅ Real data |
| 3D trajectory visualization | ✅ Simulated | ✅ Real telemetry |
| Mission matching | ✅ Demo mission | ✅ Real matching |
| API endpoints | ❌ | ✅ |

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

5. **flightClubApiService.ts**: Secure Flight Club telemetry integration
   - Vercel serverless proxy for API key protection
   - Real-time telemetry processing with Bermuda calculations
   - Distance, bearing, elevation for each telemetry frame
   - Comprehensive viewing instructions generation

### API Configuration
- Primary: `https://ll.thespacedevs.com/2.2.0/launch/upcoming/`
- Filters: `launch_service_provider__name=SpaceX&pad__location__name__icontains=florida`
- Florida locations: Cape Canaveral, Kennedy Space Center, CAFS, KSC
- **Flight Club**: `/api/flightclub/*` - Secure proxy for telemetry data (requires `FLIGHTCLUB_API_KEY`)

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

**FIXED (October 4, 2025)**: Resolved async visibility calculation timeouts that caused launches not to display. Added:
- 10-second timeout on visibility calculations with fallback data
- 5-second timeout on solar data API calls
- Promise.allSettled for parallel processing with graceful failures
- Better error handling showing launches even when calculations timeout

### API Rate Limiting
- App uses intelligent caching to minimize API calls
- Database stores launches with update schedules
- Force refresh clears cache if needed

### Network/Localhost Issues
- If localhost doesn't work, use IP address (127.0.0.1)
- Try network IP (172.20.10.2) if local IPs fail
- Check macOS firewall settings
- Verify no proxy interference

### FlightClub 3D Visualization Issues

#### "FlightClub Data Unavailable" Error
This error typically occurs due to:
1. **Missing API Key**: Ensure `.env` file has `FLIGHTCLUB_API_KEY` set
2. **Wrong Development Server**: Use `vercel dev` instead of `npm start` for API access
3. **No Mission Match**: Launch not available in FlightClub database
4. **API Quota Exceeded**: FlightClub API has usage limits

#### Troubleshooting Steps
1. **Check Development Mode**:
   ```bash
   # If you see "Demo Mode Active" in FlightClub tab, try:
   vercel dev
   ```

2. **Verify API Key**:
   ```bash
   # Check if .env file exists and has the key
   cat .env | grep FLIGHTCLUB_API_KEY
   ```

3. **Enable Demo Mode** (for testing without API):
   ```javascript
   // In browser console:
   import('./services/flightClubApiService').then(module => 
     module.FlightClubApiService.enableDemoMode(true)
   );
   ```

4. **Check Browser Console**:
   - Look for `[FlightClub]` prefixed messages
   - Mission matching attempts are logged
   - API errors will be displayed

#### Expected Behavior
- **With `npm start`**: Shows demo data with warning message
- **With `vercel dev` + API key**: Shows real FlightClub data
- **No mission found**: Falls back to basic visibility calculations

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

### Environment Variables
Create `.env` file with:
```bash
# Required for Flight Club API integration
# SECURITY: Get this from your team's secure key management system
FLIGHTCLUB_API_KEY=your_flight_club_api_key_here

# Required for production rate limiting (get free instance at upstash.com)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token_here
```

**Weather API:** App now uses Open-Meteo (https://open-meteo.com) - **completely free with no API key or registration required**. Real-time weather data is fetched automatically for Bermuda.

**SECURITY NOTE**: Never commit actual API keys to version control. Use environment-specific configuration management.

### Local Development
```bash
npm start
# Runs on http://localhost:3000
```

### Production Deployment (Vercel)
1. **Set up environment variables in Vercel dashboard:**
   - `FLIGHTCLUB_API_KEY` = `[secure_key_from_team_vault]`
   - `UPSTASH_REDIS_REST_URL` = `[redis_instance_url]`
   - `UPSTASH_REDIS_REST_TOKEN` = `[redis_auth_token]`
   - `REACT_APP_OPENWEATHER_API_KEY` = `[weather_api_key]` (optional)
   
2. **Deploy to Vercel:**
   ```bash
   npm run build
   vercel --prod
   ```

3. **Verify API endpoints:**
   - `/api/flightclub/missions` - Mission discovery (with rate limiting)
   - `/api/flightclub/simulation/[missionId]` - Telemetry data (with input validation)

4. **Security Features:**
   - Edge Middleware with distributed rate limiting
   - Origin validation and CORS protection
   - Input validation for all API endpoints
   - Security headers (CSP, HSTS, etc.)
   - No hardcoded API keys in client code

### Additional Production Steps
1. Configure CORS for API access
2. Use proper SSL certificates  
3. Set up monitoring for API failures
4. Implement proper error boundaries

## Contact & Support
This project tracks SpaceX launches visible from Bermuda, calculating real-time visibility based on trajectory data and providing notifications for optimal viewing times.