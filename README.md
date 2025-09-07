# 🚀 Bermuda Rocket Tracker

A modern web application that tracks upcoming rocket launches from Florida (Cape Canaveral and Kennedy Space Center) and determines their visibility from Bermuda.

🌐 **Live Application:** https://bermuda-rocket-tracker.vercel.app

*Last updated: September 7, 2025 - Comprehensive audit fixes and code quality improvements*
*Status: Production-ready with enhanced security and clean architecture*

## Features

- **Real-time Launch Data**: Fetches upcoming launches from The Space Devs Launch Library API
- **Visibility Predictions**: Analyzes launch trajectory, time of day, and location to determine visibility from Bermuda
- **Real Weather Integration**: Uses OpenWeatherMap API for accurate Bermuda weather conditions and launch impact assessment
- **Interactive Sky Maps**: Shows rocket trajectory with constellation references and compass orientation
- **Advanced Trajectory Visualization**: Interactive map showing rocket path, visibility indicators, and accurate Florida/Bermuda geography with dark theme integration
- **Weather-Aware Notifications**: Advanced notification system considering weather conditions
- **Analytics Dashboard**: Comprehensive launch statistics and visibility trends
- **Dark Mode**: Toggle between light and dark themes
- **Mobile Responsive**: Clean design that works on all devices
- **Auto-refresh**: Updates launch data every 30 minutes
- **Time Zone Conversion**: Shows launch times in Bermuda time (AST/ADT)
- **Launch Details**: Displays rocket type, mission name, launch pad, and target orbit
- **Live Streams**: Direct links to official launch streams when available

## Configuration

### Weather Data Setup

To enable real weather data from OpenWeatherMap:

1. Sign up for a free API key at [OpenWeatherMap](https://openweathermap.org/api)
2. Create a `.env.local` file in the project root:
```bash
REACT_APP_OPENWEATHER_API_KEY=your_api_key_here
```
3. Restart the development server

**Note:** Without an API key, the app will use realistic simulated weather data as a fallback.

## Visibility Determination Logic

The app determines visibility based on several factors:

### Launch Location
- Only tracks launches from Florida launch pads (Cape Canaveral, Kennedy Space Center)
- Calculates distance and bearing from Bermuda coordinates (32.3078°N, 64.7505°W)

### Trajectory Analysis
- **High Visibility**: GTO/GEO launches (typically southeast trajectory) during night time
- **Medium Visibility**: LEO launches or daytime GTO launches
- **Low Visibility**: Limited trajectory visibility or poor timing
- **Not Visible**: Launches not visible from Bermuda's location

### Time of Day
- **Night launches** (after 8 PM or before 6 AM local time) have better visibility
- **Daylight launches** are harder to see due to sunlight

### Compass Direction
- Shows the bearing (compass direction) to look toward from Bermuda
- Most Florida launches head northeast to southeast (45° to 120° azimuth)

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS for responsive design
- **API**: The Space Devs Launch Library 2.2.0
- **Build Tool**: Create React App

## Recent Improvements (September 2025)

### ✅ Comprehensive Code Quality Audit
- **Security Enhanced**: Fixed 7/9 npm vulnerabilities (eliminated all high-severity issues)
- **Debug Cleanup**: Removed 245+ console.log statements for clean production output
- **Type Safety**: Fixed all TypeScript 'any' types with proper interfaces
- **Architecture**: Consolidated duplicate services (36→31 files for cleaner structure)
- **Organization**: Moved test files to proper directory structure

### ✅ Performance & Reliability
- **GitHub Actions**: Fixed health check monitoring (stops failure emails)
- **Dependencies**: Updated critical packages (web-vitals, testing-library)
- **Build Process**: Production builds compile cleanly with improved bundle size
- **Error Handling**: Enhanced TypeScript error management

### ✅ Code Maintainability
- **TODO Cleanup**: Addressed all TODO/FIXME comments
- **Import Consistency**: Fixed all service import references
- **File Structure**: Professional organization with src/__tests__ directory
- **Documentation**: Updated with current project status

## Getting Started

### Prerequisites
- Node.js 16 or higher
- npm

### Installation & Running

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Project Structure

```
src/
├── components/
│   └── LaunchCard.tsx          # Individual launch display component
├── services/
│   ├── launchService.ts        # API calls to fetch launch data
│   └── visibilityService.ts    # Visibility calculation logic
├── utils/
│   └── timeUtils.ts           # Time zone conversion utilities
├── types.ts                   # TypeScript type definitions
├── App.tsx                    # Main application component
└── index.css                  # Tailwind CSS imports
```

## API Data Source

Launch data is provided by [The Space Devs](https://thespacedevs.com/) Launch Library API, which aggregates information from various space agencies and companies.

## Recent Enhancements Completed

- [x] **Interactive trajectory map** - Advanced visualization with real trajectory data and visibility indicators
- [x] **More detailed trajectory calculations** - Enhanced orbital mechanics with SSO/retrograde orbit support
- [x] **Weather integration** - Real weather data integration with OpenWeatherMap API

## Future Enhancements

- [ ] Push notifications for visible launches
- [ ] Email reminders
- [ ] Historical launch archive
- [ ] Mobile app version (React Native)
- [ ] Integration with additional launch data sources
- [ ] Real-time trajectory tracking during launches

## Data Attribution

Launch data provided by The Space Devs Launch Library API. Visibility calculations are estimates based on basic orbital mechanics and should be used for informational purposes only.
