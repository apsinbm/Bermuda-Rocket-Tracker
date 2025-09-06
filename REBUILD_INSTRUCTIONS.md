# Bermuda Launch Tracker 2.0 - Complete Rebuild Instructions

## Project Overview
**Name**: `bermuda-launch-tracker-v2` or `atlantic-rocket-watch`
**Goal**: Clean, reliable web app that tracks rocket launches visible from Bermuda with automatic data updates and deployment

---

## Architecture Design (Keep It Simple!)

### 1. **Single Data Flow** (No More Overlapping Services)
```
API Sources → Data Service → Cache/DB → Components → UI
```

### 2. **Core Components**
- **DataService**: Single service handling all API calls and caching
- **VisibilityCalculator**: Pure functions for visibility calculations
- **LaunchCard**: Rich display component (this worked well!)
- **App**: Simple state management, no complex async processing

### 3. **Technology Stack**
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js Express API (for production deployment)
- **Database**: SQLite (simple, serverless) or PostgreSQL (production)
- **Deployment**: Vercel or Netlify with auto-deployment
- **API Sources**: SpaceX Launch Library + Flight Club (backup sources)

---

## What To Copy From Current App (The Good Parts)

### ✅ **Keep These Components Exactly**:
1. **LaunchCard.tsx** - Rich display with trajectory info (lines 102-108 tracking explanation)
2. **trackingExplanation.ts** - Beginner-friendly guidance (with timezone fix)
3. **TrajectoryVisualization.tsx** - Interactive map component 
4. **Dark mode toggle and responsive design**
5. **Visibility calculation formulas** (distance, bearing calculations)
6. **Bermuda coordinates and timezone logic**

### ✅ **Keep These Data Structures**:
```typescript
interface Launch {
  id: string;
  name: string;
  mission: { name: string; description: string; orbit: { name: string } };
  rocket: { name: string };
  pad: { name: string; latitude: string; longitude: string };
  net: string; // ISO date
  status: { name: string };
}

interface VisibilityData {
  likelihood: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  bearing?: number;
  trajectoryDirection?: string;
  estimatedTimeVisible?: string;
}
```

### ✅ **Specific Files to Copy**:
- `src/components/LaunchCard.tsx` (lines 1-199)
- `src/utils/trackingExplanation.ts` (with timezone fix applied)
- `src/components/TrajectoryVisualization.tsx` (interactive map)
- `src/utils/timeUtils.ts` (Bermuda timezone functions)
- `src/services/visibilityService.ts` (getBearingDirection function)
- CSS classes for dark mode and responsive design

---

## What To Avoid (The Problem Areas)

### ❌ **Don't Recreate These**:
1. **Multiple overlapping services** (launchDataService + enhancedVisibilityService + trajectoryService)
2. **Complex Promise.all() batch processing** that fails if one item fails
3. **Multiple caching layers** that get out of sync
4. **Complex server setup** with multiple ports
5. **Over-engineered fallback systems** that conflict with each other
6. **The enhanced visibility service** - it's too complex and fails frequently

### ❌ **Avoid These Patterns**:
```typescript
// DON'T DO: Batch processing that can fail entirely
const processed = await Promise.all(launches.map(processLaunch));

// DON'T DO: Multiple services for the same data
launchDataService + enhancedVisibilityService + trajectoryService

// DON'T DO: Complex async fallback chains
try { enhanced() } catch { try { fallback1() } catch { fallback2() } }
```

---

## Step-by-Step Build Instructions

### Phase 1: Project Setup
```bash
npx create-react-app atlantic-rocket-watch --template typescript
cd atlantic-rocket-watch
npm install tailwindcss axios date-fns sqlite3 @types/sqlite3
npx tailwindcss init -p
```

### Phase 2: Core Architecture

#### 2.1 Create Simple Data Service
```typescript
// src/services/DataService.ts
class DataService {
  private cache: Launch[] = [];
  private lastFetch = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  
  async getLaunches(): Promise<Launch[]> {
    // Simple: Check cache, fetch if stale, return data
    if (this.isCacheValid()) {
      return this.cache;
    }
    
    try {
      this.cache = await this.fetchFromAPI();
      this.lastFetch = Date.now();
    } catch (error) {
      console.error('API fetch failed:', error);
      // Return cached data even if stale, or empty array
      return this.cache.length > 0 ? this.cache : [];
    }
    
    return this.cache;
  }
  
  private async fetchFromAPI(): Promise<Launch[]> {
    const response = await fetch(
      'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=50&launch_service_provider__name=SpaceX&pad__location__name__icontains=florida'
    );
    const data = await response.json();
    return data.results.map(this.mapApiResponse);
  }
  
  calculateVisibility(launch: Launch): VisibilityData {
    // Pure function, no async, no external dependencies
    // Use Bermuda coordinates, orbital mechanics, time calculations
    const isNight = this.isNightInBermuda(launch.net);
    const trajectory = this.getTrajectoryDirection(launch);
    const bearing = this.calculateBearing(launch);
    
    return {
      likelihood: this.calculateLikelihood(launch, isNight, trajectory),
      reason: this.createReason(launch, isNight, trajectory),
      bearing,
      trajectoryDirection: trajectory,
      estimatedTimeVisible: this.getViewingTime(launch, isNight)
    };
  }
  
  private isNightInBermuda(launchTime: string): boolean {
    const launchDate = new Date(launchTime);
    const bermudaTime = new Date(launchDate.getTime() - (4 * 60 * 60 * 1000));
    const hour = bermudaTime.getUTCHours();
    return hour < 6 || hour >= 20;
  }
}
```

#### 2.2 Create Clean Component Structure
```
src/
  components/
    LaunchCard.tsx          (copy from current, it works!)
    LaunchList.tsx          (simple list wrapper)
    VisibilityStats.tsx     (the 4 stats boxes)
    Header.tsx              (title, dark mode toggle)
  services/
    DataService.ts          (single service)
    VisibilityCalculator.ts (pure functions)
  utils/
    timeUtils.ts           (copy timezone logic)
    trackingExplanation.ts (copy with fixes)
    constants.ts           (Bermuda coordinates, etc.)
  types/
    index.ts               (all TypeScript interfaces)
  App.tsx                  (simple, clean)
```

#### 2.3 Simple App.tsx Structure
```typescript
// src/App.tsx
function App() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadLaunches();
  }, []);
  
  const loadLaunches = async () => {
    try {
      const dataService = new DataService();
      const launchData = await dataService.getLaunches();
      
      // Process each launch individually - NO batch processing
      const processedLaunches = launchData.map(launch => ({
        ...launch,
        visibility: dataService.calculateVisibility(launch),
        bermudaTime: convertToBermudaTime(launch.net)
      }));
      
      setLaunches(processedLaunches);
    } catch (err) {
      setError('Failed to load launches');
    } finally {
      setLoading(false);
    }
  };
  
  // Simple, clean rendering
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      {loading ? <LoadingSpinner /> : <LaunchList launches={launches} />}
      {error && <ErrorMessage error={error} />}
    </div>
  );
}
```

### Phase 3: Database Integration (Optional Enhancement)
```typescript
// src/services/DatabaseService.ts
interface LaunchDB {
  id: string;
  data: string; // JSON stringified launch data
  fetched_at: number;
  launch_time: string;
  visibility_data: string; // JSON stringified visibility
}

class DatabaseService {
  private db: any; // SQLite connection
  
  async saveLaunches(launches: Launch[]): Promise<void> {
    // Save launches with expiry timestamps
    // Auto-cleanup old data
    // Rate limiting protection
  }
  
  async getCachedLaunches(): Promise<Launch[]> {
    // Return unexpired launches from database
  }
  
  async cleanup(): Promise<void> {
    // Remove launches older than 30 days
  }
}
```

### Phase 4: Deployment Setup

#### 4.1 Vercel Deployment
```json
// vercel.json
{
  "builds": [
    { "src": "package.json", "use": "@vercel/static-build" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

#### 4.2 Environment Variables
```env
# .env.production
REACT_APP_API_BASE_URL=https://ll.thespacedevs.com/2.2.0
REACT_APP_FLIGHT_CLUB_URL=https://flightclub.io
```

---

## Key Implementation Rules

### 1. **Error Handling Philosophy**
```typescript
// GOOD: Handle errors individually
const processedLaunches = launches.map(launch => {
  try {
    return {
      ...launch,
      visibility: dataService.calculateVisibility(launch)
    };
  } catch (error) {
    console.error(`Failed to process ${launch.name}:`, error);
    return {
      ...launch,
      visibility: createFallbackVisibility(launch)
    };
  }
});

// BAD: Batch processing that can fail completely
await Promise.all(launches.map(processLaunch)); // DON'T DO THIS
```

### 2. **Single Source of Truth**
- ONE service manages all data (DataService)
- ONE place for visibility calculations (VisibilityCalculator)
- ONE error handling pattern throughout
- NO overlapping responsibilities

### 3. **Timezone Consistency**
```typescript
// EVERYWHERE: Use this pattern for Bermuda time
const bermudaTime = new Date(launchDate.getTime() - (4 * 60 * 60 * 1000));
const hour = bermudaTime.getUTCHours();
const isNight = hour < 6 || hour >= 20;
```

### 4. **API Strategy**
- Primary: SpaceX Launch Library API
- Cache for 1 hour minimum to avoid rate limits
- Fallback to previous cached data if API fails
- NO complex retry logic or multiple API sources initially

---

## Critical Functions to Implement

### 1. **Visibility Calculator (Pure Functions)**
```typescript
// src/services/VisibilityCalculator.ts
export class VisibilityCalculator {
  private static readonly BERMUDA_LAT = 32.3078;
  private static readonly BERMUDA_LNG = -64.7505;
  
  static calculateVisibility(launch: Launch): VisibilityData {
    const isNight = this.isNightInBermuda(launch.net);
    const trajectory = this.getTrajectoryDirection(launch);
    const distance = this.calculateDistance(launch);
    
    return {
      likelihood: this.getLikelihood(isNight, trajectory, distance),
      reason: this.createReason(launch, isNight, trajectory),
      bearing: this.calculateBearing(launch),
      trajectoryDirection: trajectory,
      estimatedTimeVisible: this.getViewingTime(launch, isNight)
    };
  }
  
  private static isNightInBermuda(launchTime: string): boolean {
    const launchDate = new Date(launchTime);
    const bermudaTime = new Date(launchDate.getTime() - (4 * 60 * 60 * 1000));
    const hour = bermudaTime.getUTCHours();
    return hour < 6 || hour >= 20;
  }
  
  private static getTrajectoryDirection(launch: Launch): string {
    const orbit = launch.mission.orbit?.name?.toLowerCase() || '';
    const mission = launch.mission.name?.toLowerCase() || '';
    
    if (orbit.includes('gto') || orbit.includes('geostationary')) return 'Southeast';
    if (orbit.includes('starlink') || mission.includes('starlink')) return 'Northeast';
    if (orbit.includes('iss') || mission.includes('dragon')) return 'Northeast';
    return 'Northeast'; // Default
  }
}
```

### 2. **Rich Tracking Explanation**
```typescript
// src/utils/trackingExplanation.ts (Copy from current app with fixes)
export function getTrackingExplanation(launch: LaunchWithVisibility): string {
  const isNight = isNightTime(launch.net);
  const direction = launch.visibility.trajectoryDirection;
  
  if (isNight) {
    return `🌙 Night launch - look for a bright moving star climbing slowly across the sky. The rocket will travel ${direction?.toLowerCase()} from Florida. Start watching about 6 minutes after liftoff.`;
  } else {
    return `☀️ Daytime launch - very difficult to spot against the bright blue sky. If visible at all, it may appear as a faint contrail or bright speck moving across the sky.`;
  }
}

function isNightTime(launchTime: string): boolean {
  const launchDate = new Date(launchTime);
  const bermudaTime = new Date(launchDate.getTime() - (4 * 60 * 60 * 1000));
  const hour = bermudaTime.getUTCHours();
  return hour < 6 || hour >= 20;
}
```

---

## Production Deployment Plan

### 1. **Frontend Deployment**
- Deploy React app to Vercel or Netlify
- Custom domain: `bermuda-rockets.com` or `atlantic-launches.com`
- Auto-deploy on git push to main branch
- Environment variables for API keys

### 2. **Backend API** (Phase 2 Enhancement)
```javascript
// Optional Express.js server for enhanced features
const express = require('express');
const sqlite3 = require('sqlite3');

const app = express();

app.get('/api/launches', async (req, res) => {
  // Serve cached launch data
  // Handle CORS
  // Rate limiting
});

app.post('/api/refresh', async (req, res) => {
  // Trigger data refresh
  // Admin endpoint
});
```

### 3. **Database Setup**
- Start with in-memory caching
- Phase 2: Add SQLite for persistence
- Phase 3: PostgreSQL for production scale
- Tables: `launches`, `visibility_cache`, `api_logs`

### 4. **Monitoring & Analytics**
- Vercel Analytics for usage tracking
- Error logging with Sentry (optional)
- Performance monitoring
- API usage tracking to avoid rate limits

---

## Testing Strategy

### 1. **Unit Tests**
```typescript
// Test visibility calculations
describe('VisibilityCalculator', () => {
  test('night launches should have high visibility', () => {
    const nightLaunch = createMockLaunch('2024-08-07T02:00:00Z');
    const result = VisibilityCalculator.calculateVisibility(nightLaunch);
    expect(result.likelihood).toBe('high');
    expect(result.reason).toContain('🌙');
  });
});
```

### 2. **Integration Tests**
- Test API fetching
- Test data processing
- Test error handling
- Test timezone calculations

---

## Success Criteria

### Immediate Goals (Phase 1)
✅ App loads instantly with data
✅ Shows 6+ upcoming launches with rich tracking info
✅ Night launches display: "🌙 Night launch - look for bright moving star..."
✅ Day launches display: "☀️ Daytime launch - very difficult to spot..."
✅ Proper visibility statistics (not 0-0-0)
✅ Trajectory directions and bearings display correctly
✅ Works on mobile and desktop
✅ No server connection issues

### Production Goals (Phase 2)
✅ Deploys automatically to public URL
✅ Updates data automatically without rate limiting
✅ Database persistence for offline capability
✅ Custom domain with SSL
✅ Performance monitoring
✅ Error tracking and recovery

---

## Migration Notes

### From Current App
- Copy `LaunchCard.tsx` exactly - it works perfectly
- Copy `trackingExplanation.ts` with timezone fix
- Copy Tailwind CSS classes and dark mode setup
- Copy coordinate calculations and distance formulas
- **DO NOT** copy the complex service architecture

### New Architecture Benefits
- Single data source eliminates sync issues
- Individual error handling prevents cascade failures
- Pure functions make testing easy
- Simple deployment path
- Maintainable codebase

---

**This rebuild will create a clean, fast, and reliable rocket tracking application that delivers all the features users expect without the architectural complexity that caused the current issues.**