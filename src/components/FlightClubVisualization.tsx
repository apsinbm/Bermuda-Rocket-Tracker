/**
 * FlightClub-Style Comprehensive Visualization Component
 * 
 * Replicates FlightClub.io's professional visualization interface
 * Integrates 2D trajectory map, telemetry graphs, and 3D scene
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { LaunchWithVisibility } from '../types';
import { detectPlatform } from '../utils/platformUtils';
import { FlightClubApiService, ProcessedSimulationData, FlightClubMission } from '../services/flightClubApiService';
import FlightClub2DVisualization from './FlightClub2DVisualization';
import TelemetryGraphs from './TelemetryGraphs';
import Trajectory3DScene from './Trajectory3DScene';
import StageEventTimeline from './StageEventTimeline';
import BermudaViewingGuide from './BermudaViewingGuide';
import LiveViewingGuide from './LiveViewingGuide';

interface FlightClubVisualizationProps {
  launch: LaunchWithVisibility;
  darkMode?: boolean;
}

type ViewMode = '2d' | '3d' | 'analytics' | 'timeline' | 'guide' | 'combined';
type View3DMode = 'overview' | 'bermuda-pov' | 'side-profile' | 'top-down';

const FlightClubVisualization: React.FC<FlightClubVisualizationProps> = ({
  launch,
  darkMode = true
}) => {
  // Detect platform capabilities for mobile optimization
  const platform = useMemo(() => detectPlatform(), []);
  
  // Optimized Canvas configuration for mobile/desktop
  const canvasConfig = useMemo(() => ({
    camera: { 
      position: [0, 200, -300] as [number, number, number], 
      fov: platform.isMobile ? 70 : 60 // Wider FOV on mobile for better visibility
    },
    gl: { 
      antialias: platform.supportsWebGL2 && !platform.isMobile, // Disable AA on mobile for performance
      alpha: false,
      powerPreference: platform.isMobile ? 'default' : 'high-performance',
      pixelRatio: platform.isMobile ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio
    },
    performance: { 
      min: platform.isMobile ? 0.3 : 0.5, // Lower performance threshold on mobile
      debounce: platform.isMobile ? 200 : 100
    },
    style: {
      touchAction: platform.supportsTouch ? 'none' : 'auto', // Prevent touch conflicts
    } as React.CSSProperties
  }), [platform]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [view3DMode, setView3DMode] = useState<View3DMode>('overview');
  const [simulationData, setSimulationData] = useState<ProcessedSimulationData | null>(null);
  const [flightClubMission, setFlightClubMission] = useState<FlightClubMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [highlightedStage, setHighlightedStage] = useState<number | null>(null);
  
  // State management
  const [showLiveGuide, setShowLiveGuide] = useState(false);
  const [scene3DReady, setScene3DReady] = useState(false);

  // Handle mission selection (now used for auto-selection)
  const handleMissionSelect = async (missionId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the mission details from the API
      const missionsResponse = await FlightClubApiService.getMissions();
      const selectedMission = missionsResponse.missions.find(m => m.id === missionId);
      if (!selectedMission) {
        throw new Error('Selected mission not found');
      }
      
      console.log(`[FlightClub] Auto-selected mission: ${selectedMission.id} - ${selectedMission.description}`);
      setFlightClubMission(selectedMission);
      
      // Get simulation data using the selected mission
      const missionIdToUse = selectedMission.flightClubSimId || selectedMission.id;
      console.log(`[FlightClub] Using ${selectedMission.flightClubSimId ? 'flightClubSimId' : 'fallback id'}: ${missionIdToUse} for mission: ${selectedMission.description}`);
      
      const simData = await FlightClubApiService.getSimulationData(missionIdToUse, launch.id);
      setSimulationData(simData);
      
      console.log(`[FlightClub] Loaded ${simData.enhancedTelemetry.length} telemetry frames from manually selected mission`);
      
      // Reset playback to show first frame immediately
      setPlaybackTime(0);
      setIsPlaying(false);
      
    } catch (error) {
      console.error('[FlightClub] Failed to load manually selected mission:', error);
      setError(error instanceof Error ? error.message : 'Failed to load selected mission');
    } finally {
      setLoading(false);
    }
  };

  // Reset 3D scene ready state when loading new data
  useEffect(() => {
    setScene3DReady(false);
  }, [loading]);

  // Load FlightClub data
  useEffect(() => {
    const loadFlightClubData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(`[FlightClub] Loading data for launch: ${launch.name}`);
        
        // Check if running in development mode without Vercel dev
        const isDevelopmentMode = process.env.NODE_ENV === 'development';
        const isUsingReactDevServer = window.location.port === '3000' && !window.location.pathname.startsWith('/api');
        
        console.log(`[FlightClub] Environment check: dev=${isDevelopmentMode}, port=${window.location.port}, pathname=${window.location.pathname}`);
        
        if (isDevelopmentMode && isUsingReactDevServer) {
          // Try to detect if API endpoints are available
          try {
            console.log('[FlightClub] Testing API endpoint availability...');
            const testResponse = await fetch('/api/flightclub/missions', { method: 'HEAD' });
            if (!testResponse.ok) {
              throw new Error(`API endpoint returned ${testResponse.status}`);
            }
            console.log('[FlightClub] ✓ API endpoints are available');
          } catch (apiError) {
            const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
            console.warn(`[FlightClub] ✗ API endpoints not available (${errorMessage}), enabling demo mode`);
            console.log('[FlightClub] To use real data, run "vercel dev" instead of "npm start"');
            FlightClubApiService.enableDemoMode(true);
            
            // Show warning but continue with demo mode
            setError('development-mode-warning');
            // Don't return here, continue to load demo data
          }
        }
        
        // Find matching FlightClub mission
        const mission = await FlightClubApiService.findMissionForLaunch(launch.id, launch.name);
        
        if (!mission) {
          console.log(`[FlightClub] No automatic match found for "${launch.name}", auto-selecting first available SpaceX mission`);
          
          // Load available missions and auto-select the first suitable one
          const missionsResponse = await FlightClubApiService.getMissions();
          const suitableMissions = missionsResponse.missions.filter(m => {
            const company = m.company.description.toLowerCase();
            const description = m.description.toLowerCase();
            return company.includes('spacex') || 
                   description.includes('starlink') || 
                   description.includes('falcon') ||
                   description.includes('crew') ||
                   m.display;
          });
          
          if (suitableMissions.length > 0) {
            // Auto-select the first suitable mission
            await handleMissionSelect(suitableMissions[0].id);
            return;
          } else {
            // Fallback to first available mission
            if (missionsResponse.missions.length > 0) {
              await handleMissionSelect(missionsResponse.missions[0].id);
              return;
            }
          }
        }

        if (mission) {
          setFlightClubMission(mission);
          console.log(`[FlightClub] Found mission: ${mission.id} - ${mission.description}`);

          // Get simulation data - prefer flightClubSimId over regular id
          const missionIdToUse = mission.flightClubSimId || mission.id;
          console.log(`[FlightClub] Using ${mission.flightClubSimId ? 'flightClubSimId' : 'fallback id'}: ${missionIdToUse} for mission: ${mission.description}`);
        
          const simData = await FlightClubApiService.getSimulationData(missionIdToUse, launch.id);
          setSimulationData(simData);
          
          console.log(`[FlightClub] Loaded ${simData.enhancedTelemetry.length} telemetry frames`);
          
          // Reset playback to show first frame immediately
          setPlaybackTime(0);
          setIsPlaying(false);
          
          // If we successfully loaded data, clear the development warning
          if (error === 'development-mode-warning') {
            setError(null);
          }
        }

      } catch (error) {
        console.error('[FlightClub] Failed to load data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load FlightClub data');
      } finally {
        setLoading(false);
      }
    };

    loadFlightClubData();
  }, [launch.id, launch.name]);

  // Playback control with race condition prevention
  const maxTime = useMemo(() => {
    if (!simulationData?.enhancedTelemetry.length) return 0;
    return Math.max(...simulationData.enhancedTelemetry.map(frame => frame.time));
  }, [simulationData]);

  // Ensure playback starts at 0 when new data is loaded
  useEffect(() => {
    if (simulationData?.enhancedTelemetry && simulationData.enhancedTelemetry.length > 0 && playbackTime === 0) {
      // Force a re-render to show the first frame immediately
      setPlaybackTime(0.001);
      setTimeout(() => setPlaybackTime(0), 10);
    }
  }, [simulationData]);

  useEffect(() => {
    // Only allow playback if we have valid data and scene is ready
    if (!isPlaying || !maxTime || !simulationData?.enhancedTelemetry?.length) return;

    const interval = setInterval(() => {
      setPlaybackTime(prev => {
        const next = prev + playbackSpeed;
        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxTime, simulationData]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `T+${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle time selection from graphs with data validation
  const handleTimeSelect = (time: number) => {
    if (!simulationData?.enhancedTelemetry?.length) return;
    
    const clampedTime = Math.max(0, Math.min(time, maxTime));
    setPlaybackTime(clampedTime);
    setIsPlaying(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600'} rounded-lg`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-lg font-medium">Loading FlightClub Data...</div>
          <div className="text-sm opacity-75">Fetching trajectory and telemetry data</div>
        </div>
      </div>
    );
  }

  if (error && error !== 'development-mode-warning') {
    return (
      <div className={`p-8 text-center ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600'} rounded-lg border-2 border-dashed ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
        <div className="text-lg font-medium text-red-400 mb-2">⚠️ FlightClub Data Unavailable</div>
        <div className="text-sm opacity-75 mb-4">{error}</div>
        <div className="text-xs opacity-50">
          This launch may not have detailed trajectory data available in the FlightClub database yet.
          Basic visibility calculations are still shown in the main launch card.
        </div>
      </div>
    );
  }


  // Development mode warning (but still show data)
  const showDevWarning = error === 'development-mode-warning';
  const isDemo = simulationData?.warning?.includes('Demo mode') || simulationData?.warning?.includes('simulated');

  if (!simulationData) {
    return (
      <div className={`p-8 text-center ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600'} rounded-lg`}>
        <div className="text-lg font-medium mb-2">No Simulation Data</div>
        <div className="text-sm opacity-75">Unable to load trajectory simulation for this launch</div>
      </div>
    );
  }

  const themeClasses = {
    background: darkMode ? 'bg-gray-900' : 'bg-white',
    card: darkMode ? 'bg-gray-800' : 'bg-gray-50',
    border: darkMode ? 'border-gray-700' : 'border-gray-300',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-300' : 'text-gray-600',
    button: darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300',
    buttonActive: darkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'
  };

  return (
    <div className={`space-y-6 p-6 ${themeClasses.background} ${themeClasses.text} rounded-lg`}>
      
      {/* Header with mission info and controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">Flight Trajectory Analysis</h2>
          <div className={`text-sm ${themeClasses.textSecondary}`}>
            {flightClubMission?.description} • {simulationData.enhancedTelemetry.length} telemetry points
          </div>
        </div>
        
        {/* View mode selector */}
        <div className="flex flex-wrap gap-2">
          {[
            { mode: '2d' as ViewMode, label: '2D Map', icon: '🗺️' },
            { mode: '3d' as ViewMode, label: '3D View', icon: '🌍' },
            { mode: 'analytics' as ViewMode, label: 'Analytics', icon: '📊' },
            { mode: 'timeline' as ViewMode, label: 'Timeline', icon: '⏱️' },
            { mode: 'guide' as ViewMode, label: 'Viewing Guide', icon: '🏝️' },
            { mode: 'combined' as ViewMode, label: 'Combined', icon: '📋' }
          ].map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === mode 
                  ? `${themeClasses.buttonActive} text-white` 
                  : `${themeClasses.button} ${themeClasses.text}`
              }`}
            >
              <span className="mr-2">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Playback controls */}
      <div className={`flex flex-col sm:flex-row items-center gap-4 p-4 ${themeClasses.card} border ${themeClasses.border} rounded-lg`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!simulationData?.enhancedTelemetry?.length) return;
              setIsPlaying(!isPlaying);
            }}
            disabled={!simulationData?.enhancedTelemetry?.length}
            className={`px-4 py-2 rounded ${
              !simulationData?.enhancedTelemetry?.length
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : `${themeClasses.buttonActive} text-white`
            } font-medium transition-colors`}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button
            onClick={() => {
              if (!simulationData?.enhancedTelemetry?.length) return;
              setPlaybackTime(0);
              setIsPlaying(false);
            }}
            disabled={!simulationData?.enhancedTelemetry?.length}
            className={`px-3 py-2 rounded ${
              !simulationData?.enhancedTelemetry?.length
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : `${themeClasses.button} ${themeClasses.text}`
            } transition-colors`}
          >
            ⏮️ Reset
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="range"
            min="0"
            max={maxTime}
            value={playbackTime}
            onChange={(e) => setPlaybackTime(Number(e.target.value))}
            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
          />
          <div className="flex justify-between text-xs mt-1">
            <span>T+0:00</span>
            <span className="font-medium">{formatTime(playbackTime)}</span>
            <span>{formatTime(maxTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className={`text-sm ${themeClasses.textSecondary}`}>Speed:</label>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className={`px-2 py-1 rounded text-sm ${themeClasses.card} ${themeClasses.text} border ${themeClasses.border}`}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      {/* Main visualization area */}
      <div className="space-y-6">
        {/* Combined view */}
        {viewMode === 'combined' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 2D Map */}
            <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
              <div className="p-4 border-b border-gray-600">
                <h3 className="font-semibold">2D Trajectory Map</h3>
              </div>
              <FlightClub2DVisualization
                simulationData={simulationData}
                playbackTime={playbackTime}
                onTimeSelect={handleTimeSelect}
                darkMode={darkMode}
              />
            </div>

            {/* 3D View */}
            <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
              <div className="p-4 border-b border-gray-600 flex justify-between items-center">
                <h3 className="font-semibold">3D Visualization</h3>
                <select
                  value={view3DMode}
                  onChange={(e) => setView3DMode(e.target.value as View3DMode)}
                  className={`px-2 py-1 rounded text-sm ${themeClasses.card} ${themeClasses.text} border ${themeClasses.border}`}
                >
                  <option value="overview">Overview</option>
                  <option value="bermuda-pov">Bermuda POV</option>
                  <option value="side-profile">Side Profile</option>
                  <option value="top-down">Top Down</option>
                </select>
              </div>
              <div className="h-96 relative">
                {simulationData ? (
                  <>
                    {/* Loading overlay for 3D scene */}
                    {!scene3DReady && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                        <div className="text-center text-white">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                          <div className="text-sm">Initializing 3D Scene...</div>
                          <div className="text-xs opacity-75 mt-1">Loading textures and models</div>
                        </div>
                      </div>
                    )}
                    
                    <Canvas 
                      camera={canvasConfig.camera}
                      gl={canvasConfig.gl}
                      performance={canvasConfig.performance}
                      style={canvasConfig.style}
                      onCreated={(state) => {
                        // Canvas is created, set up faster ready detection
                        const checkReady = () => {
                          if (simulationData?.enhancedTelemetry?.length > 0) {
                            setScene3DReady(true);
                          } else {
                            // If no data, still show the scene (Earth only)
                            setTimeout(() => setScene3DReady(true), 800);
                          }
                        };
                        
                        // Check immediately and after a short delay
                        setTimeout(checkReady, 500);
                        setTimeout(checkReady, 1200);
                      }}
                    >
                      <Trajectory3DScene
                        simulationData={simulationData}
                        viewMode={view3DMode}
                        playbackTime={playbackTime}
                        highlightedStage={highlightedStage}
                        showDataOverlay={true}
                        platform={platform}
                      />
                    </Canvas>
                  </>
                ) : (
                  <div className={`flex items-center justify-center h-full ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'} rounded-lg`}>
                    <div className="text-center">
                      <div className="text-lg font-medium mb-2">🌍 3D Visualization</div>
                      <div className="text-sm opacity-75">Loading trajectory data...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Single view modes */}
        {viewMode === '2d' && (
          <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
            <FlightClub2DVisualization
              simulationData={simulationData}
              playbackTime={playbackTime}
              onTimeSelect={handleTimeSelect}
              darkMode={darkMode}
            />
          </div>
        )}

        {viewMode === '3d' && (
          <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
            <div className="p-4 border-b border-gray-600 flex justify-between items-center">
              <h3 className="font-semibold text-lg">3D Trajectory Visualization</h3>
              <select
                value={view3DMode}
                onChange={(e) => setView3DMode(e.target.value as View3DMode)}
                className={`px-3 py-2 rounded ${themeClasses.card} ${themeClasses.text} border ${themeClasses.border}`}
              >
                <option value="overview">Overview</option>
                <option value="bermuda-pov">Bermuda Point of View</option>
                <option value="side-profile">Side Profile</option>
                <option value="top-down">Top Down</option>
              </select>
            </div>
            <div className="h-[600px] relative">
              {simulationData ? (
                <>
                  {/* Loading overlay for 3D scene */}
                  {!scene3DReady && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                      <div className="text-center text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                        <div className="text-lg font-medium">Initializing 3D Scene...</div>
                        <div className="text-sm opacity-75 mt-2">Loading Earth textures and trajectory data</div>
                        <div className="text-xs opacity-50 mt-1">This may take a few moments</div>
                      </div>
                    </div>
                  )}
                  
                  <Canvas 
                    camera={canvasConfig.camera}
                    gl={canvasConfig.gl}
                    performance={canvasConfig.performance}
                    style={canvasConfig.style}
                    onCreated={(state) => {
                      // Canvas is created, set up ready detection
                      const checkReady = () => {
                        if (simulationData?.enhancedTelemetry?.length > 0) {
                          setScene3DReady(true);
                        } else {
                          // If no data, still show the scene (Earth only)
                          setTimeout(() => setScene3DReady(true), 1000);
                        }
                      };
                      
                      // Check after initialization delays
                      setTimeout(checkReady, 800);
                      setTimeout(checkReady, 1500);
                    }}
                  >
                    <Trajectory3DScene
                      simulationData={simulationData}
                      viewMode={view3DMode}
                      playbackTime={playbackTime}
                      highlightedStage={highlightedStage}
                      showDataOverlay={true}
                      platform={platform}
                    />
                  </Canvas>
                </>
              ) : (
                <div className={`flex items-center justify-center h-full ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'} rounded-lg`}>
                  <div className="text-center">
                    <div className="text-lg font-medium mb-2">🌍 3D Visualization</div>
                    <div className="text-sm opacity-75">Loading trajectory data...</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
            <StageEventTimeline
              simulationData={simulationData}
              playbackTime={playbackTime}
              onTimeSelect={handleTimeSelect}
              darkMode={darkMode}
            />
          </div>
        )}

        {viewMode === 'guide' && (
          <div className="space-y-6">
            <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
              <BermudaViewingGuide
                launch={launch}
                simulationData={simulationData}
                darkMode={darkMode}
              />
            </div>
            
            {/* Live Viewing Guide toggle button */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowLiveGuide(!showLiveGuide)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  showLiveGuide 
                    ? `${themeClasses.button} ${themeClasses.text}` 
                    : `${themeClasses.buttonActive} text-white`
                }`}
              >
                {showLiveGuide ? '📋 Hide Live Viewing Guide' : '🚀 Show Live Viewing Guide'}
              </button>
            </div>
            
            {/* Live Viewing Guide */}
            {showLiveGuide && (
              <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
                <LiveViewingGuide
                  launch={launch}
                  onClose={() => setShowLiveGuide(false)}
                />
              </div>
            )}
          </div>
        )}

        {(viewMode === 'analytics' || viewMode === 'combined') && (
          <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
            <TelemetryGraphs
              simulationData={simulationData}
              playbackTime={playbackTime}
              onTimeSelect={handleTimeSelect}
              darkMode={darkMode}
            />
          </div>
        )}

        {/* Include timeline and viewing guide in combined view */}
        {viewMode === 'combined' && (
          <>
            <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
              <StageEventTimeline
                simulationData={simulationData}
                playbackTime={playbackTime}
                onTimeSelect={handleTimeSelect}
                darkMode={darkMode}
              />
            </div>
            <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg overflow-hidden`}>
              <BermudaViewingGuide
                launch={launch}
                simulationData={simulationData}
                darkMode={darkMode}
              />
            </div>
          </>
        )}
      </div>

      {/* Mission summary */}
      <div className={`${themeClasses.card} border ${themeClasses.border} rounded-lg p-4`}>
        <h3 className="font-semibold mb-3">Mission Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className={themeClasses.textSecondary}>Visibility</div>
            <div className="font-medium">
              {simulationData.visibilitySummary.visibleFrameCount > 0 ? '✅ Visible' : '❌ Not Visible'}
            </div>
          </div>
          <div>
            <div className={themeClasses.textSecondary}>Duration</div>
            <div className="font-medium">{Math.round(simulationData.visibilitySummary.totalDuration)} seconds</div>
          </div>
          <div>
            <div className={themeClasses.textSecondary}>Closest Approach</div>
            <div className="font-medium">{Math.round(simulationData.visibilitySummary.closestApproach.distance)} km</div>
          </div>
          <div>
            <div className={themeClasses.textSecondary}>Peak Time</div>
            <div className="font-medium">
              {simulationData.visibilitySummary.peakVisibility 
                ? formatTime(simulationData.visibilitySummary.peakVisibility)
                : 'N/A'
              }
            </div>
          </div>
        </div>

        {simulationData.warning && (
          <div className="mt-3 p-3 bg-yellow-900 text-yellow-200 rounded text-sm border border-yellow-700">
            ⚠️ {simulationData.warning}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightClubVisualization;