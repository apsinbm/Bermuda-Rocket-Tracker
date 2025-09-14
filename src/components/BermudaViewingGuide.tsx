/**
 * Bermuda-Specific Viewing Guide Component
 * 
 * Provides detailed viewing instructions and optimal observation guidance
 * for rocket launches as seen from Bermuda
 */

import React, { useMemo, useState } from 'react';
import { ProcessedSimulationData, EnhancedTelemetryFrame, FlightClubApiService } from '../services/flightClubApiService';
import { LaunchWithVisibility } from '../types';

interface BermudaViewingGuideProps {
  launch: LaunchWithVisibility;
  simulationData: ProcessedSimulationData | null;
  darkMode?: boolean;
}

interface ViewingPhase {
  phase: string;
  startTime: number;
  endTime: number;
  direction: string;
  elevation: number;
  distance: number;
  instructions: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  visibility: 'excellent' | 'good' | 'fair' | 'poor';
}

const BermudaViewingGuide: React.FC<BermudaViewingGuideProps> = ({
  launch,
  simulationData,
  darkMode = true
}) => {
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [showAdvancedTips, setShowAdvancedTips] = useState(false);

  // Helper functions (defined before useMemo to avoid temporal dead zone)
  const generatePhaseInstructions = (phase: Partial<ViewingPhase>): string => {
    const direction = phase.direction || 'unknown';
    const elevation = Math.round(phase.elevation || 0);
    
    if (elevation < 5) {
      return `Look very low on the horizon towards ${direction}. This will be challenging to spot due to low elevation.`;
    } else if (elevation < 15) {
      return `Look low towards ${direction}, about ${elevation}° above the horizon. Use landmarks to gauge the correct height.`;
    } else if (elevation < 45) {
      return `Look towards ${direction} at a moderate ${elevation}° elevation. This should be clearly visible.`;
    } else {
      return `Look high towards ${direction} at ${elevation}° elevation. This will be excellent viewing.`;
    }
  };

  const calculateDifficulty = (phase: Partial<ViewingPhase>): 'easy' | 'moderate' | 'challenging' => {
    const elevation = phase.elevation || 0;
    const distance = phase.distance || 1000;
    
    if (elevation > 30 && distance < 800) return 'easy';
    if (elevation > 15 && distance < 1200) return 'moderate';
    return 'challenging';
  };

  const calculateVisibility = (phase: Partial<ViewingPhase>): 'excellent' | 'good' | 'fair' | 'poor' => {
    const elevation = phase.elevation || 0;
    const distance = phase.distance || 1000;
    
    if (elevation > 45 && distance < 600) return 'excellent';
    if (elevation > 25 && distance < 900) return 'good';
    if (elevation > 10 && distance < 1500) return 'fair';
    return 'poor';
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `T+${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate viewing phases and instructions
  const viewingAnalysis = useMemo(() => {
    if (!simulationData?.enhancedTelemetry.length) {
      return {
        isVisible: false,
        phases: [],
        optimalTime: null,
        weatherConsiderations: [],
        equipmentRecommendations: [],
        photographyTips: []
      };
    }

    const { enhancedTelemetry, visibilitySummary } = simulationData;
    const visibleFrames = enhancedTelemetry.filter(frame => frame.aboveHorizon);
    
    if (!visibleFrames.length) {
      return {
        isVisible: false,
        phases: [],
        optimalTime: null,
        weatherConsiderations: [],
        equipmentRecommendations: [],
        photographyTips: []
      };
    }

    // Create viewing phases
    const phases: ViewingPhase[] = [];
    let currentPhase: Partial<ViewingPhase> | null = null;
    
    visibleFrames.forEach((frame, index) => {
      const isFirstFrame = index === 0;
      const isLastFrame = index === visibleFrames.length - 1;
      const nextFrame = visibleFrames[index + 1];
      
      // Determine if this is start of new phase
      const isNewPhase = isFirstFrame || 
        (currentPhase && Math.abs(frame.bearingFromBermuda - (currentPhase.direction as any)) > 15);
      
      if (isNewPhase || isLastFrame) {
        // Finish previous phase
        if (currentPhase && !isFirstFrame) {
          phases.push({
            ...currentPhase,
            endTime: visibleFrames[index - 1].time,
            instructions: generatePhaseInstructions(currentPhase as ViewingPhase),
            difficulty: calculateDifficulty(currentPhase as ViewingPhase),
            visibility: calculateVisibility(currentPhase as ViewingPhase)
          } as ViewingPhase);
        }
        
        // Start new phase
        currentPhase = {
          phase: `Phase ${phases.length + 1}`,
          startTime: frame.time,
          direction: FlightClubApiService.bearingToCompass(frame.bearingFromBermuda),
          elevation: frame.elevationAngle,
          distance: frame.distanceFromBermuda
        };
      }
      
      // Handle last frame
      if (isLastFrame && currentPhase) {
        phases.push({
          ...currentPhase,
          endTime: frame.time,
          instructions: generatePhaseInstructions(currentPhase as ViewingPhase),
          difficulty: calculateDifficulty(currentPhase as ViewingPhase),
          visibility: calculateVisibility(currentPhase as ViewingPhase)
        } as ViewingPhase);
      }
    });

    // Generate recommendations
    const weatherConsiderations = [
      "Clear skies essential - check cloud coverage forecast",
      "Low humidity reduces atmospheric distortion",
      "Calm winds improve telescope stability",
      "Check for aircraft traffic in viewing direction"
    ];

    const maxElevation = Math.max(...visibleFrames.map(f => f.elevationAngle));
    const minDistance = Math.min(...visibleFrames.map(f => f.distanceFromBermuda));
    
    const equipmentRecommendations = [];
    if (maxElevation < 10) {
      equipmentRecommendations.push("Binoculars recommended for low elevation viewing");
    }
    if (minDistance > 1000) {
      equipmentRecommendations.push("Telescope beneficial for distant trajectory");
    }
    if (visibilitySummary.totalDuration < 60) {
      equipmentRecommendations.push("Camera with fast shutter for brief visibility");
    }
    equipmentRecommendations.push("Red flashlight to preserve night vision");
    equipmentRecommendations.push("Compass or star chart app for direction finding");

    const photographyTips = [
      "Use manual camera settings - disable auto-focus",
      "ISO 800-3200 for rocket exhaust visibility",
      "Continuous shooting mode for trajectory capture",
      "Tripod essential for sharp long-exposure shots",
      "Include Bermuda landmarks for context"
    ];

    return {
      isVisible: true,
      phases,
      optimalTime: visibilitySummary.peakVisibility,
      weatherConsiderations,
      equipmentRecommendations,
      photographyTips
    };
  }, [simulationData, generatePhaseInstructions, calculateDifficulty, calculateVisibility]);

  // Theme configuration
  const theme = {
    background: darkMode ? 'bg-gray-900' : 'bg-white',
    card: darkMode ? 'bg-gray-800' : 'bg-gray-50',
    border: darkMode ? 'border-gray-700' : 'border-gray-300',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-300' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-500'
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400';
      case 'moderate': return 'text-yellow-400';
      case 'challenging': return 'text-red-400';
      default: return theme.textSecondary;
    }
  };

  // Get visibility color
  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return theme.textSecondary;
    }
  };

  if (!viewingAnalysis.isVisible) {
    return (
      <div className={`space-y-6 p-6 ${theme.background} ${theme.text} rounded-lg`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">🏝️ Bermuda Viewing Guide</h2>
          <div className={`p-8 ${theme.card} border ${theme.border} rounded-lg border-2 border-dashed`}>
            <div className="text-6xl mb-4">🌙</div>
            <div className="text-xl font-semibold text-red-400 mb-2">Launch Not Visible from Bermuda</div>
            <div className={`${theme.textSecondary} mb-4`}>
              This rocket launch trajectory will not be visible from Bermuda due to:
            </div>
            <div className={`text-sm ${theme.textMuted} space-y-1`}>
              <div>• Trajectory path beyond Earth's curvature from Bermuda's perspective</div>
              <div>• Launch occurs below the horizon line</div>
              <div>• Flight path direction away from Bermuda's view</div>
            </div>
            <div className={`mt-6 text-xs ${theme.textMuted}`}>
              You can still enjoy watching the live stream and tracking the mission progress!
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 p-6 ${theme.background} ${theme.text} rounded-lg`}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">🏝️ Bermuda Viewing Guide</h2>
        <div className={`${theme.textSecondary} text-lg`}>
          {launch.name} • Optimal viewing instructions for Bermuda observers
        </div>
      </div>

      {/* Quick summary */}
      <div className={`${theme.card} border ${theme.border} rounded-lg p-6`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className={`text-2xl font-bold text-green-400 mb-1`}>
              {viewingAnalysis.phases.length > 0 ? '✅' : '❌'}
            </div>
            <div className="text-sm font-medium">Visibility</div>
            <div className={`text-xs ${theme.textMuted}`}>
              {viewingAnalysis.phases.length} phases
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold text-blue-400 mb-1`}>
              {simulationData ? Math.round(simulationData.visibilitySummary.totalDuration) : 0}s
            </div>
            <div className="text-sm font-medium">Duration</div>
            <div className={`text-xs ${theme.textMuted}`}>Total visible</div>
          </div>
          <div>
            <div className={`text-2xl font-bold text-yellow-400 mb-1`}>
              {viewingAnalysis.optimalTime ? formatTime(viewingAnalysis.optimalTime) : 'N/A'}
            </div>
            <div className="text-sm font-medium">Peak Time</div>
            <div className={`text-xs ${theme.textMuted}`}>Optimal viewing</div>
          </div>
          <div>
            <div className={`text-2xl font-bold text-purple-400 mb-1`}>
              {simulationData ? Math.round(simulationData.visibilitySummary.closestApproach.distance) : 0}km
            </div>
            <div className="text-sm font-medium">Distance</div>
            <div className={`text-xs ${theme.textMuted}`}>Closest approach</div>
          </div>
        </div>
      </div>

      {/* Viewing phases */}
      {viewingAnalysis.phases.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">📍 Viewing Phases</h3>
          <div className="space-y-3">
            {viewingAnalysis.phases.map((phase, index) => (
              <div
                key={index}
                className={`
                  ${theme.card} border ${theme.border} rounded-lg p-4 cursor-pointer transition-all duration-200
                  ${selectedPhase === index ? 'ring-2 ring-blue-400 bg-blue-900' : 'hover:border-gray-500'}
                `}
                onClick={() => setSelectedPhase(selectedPhase === index ? null : index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {index === 0 ? '🚀' : index === viewingAnalysis.phases.length - 1 ? '🌟' : '👁️'}
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{phase.phase}</div>
                      <div className={`text-sm ${theme.textSecondary}`}>
                        {formatTime(phase.startTime)} - {formatTime(phase.endTime)} • {phase.direction}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getDifficultyColor(phase.difficulty)} capitalize`}>
                      {phase.difficulty}
                    </div>
                    <div className={`text-sm ${getVisibilityColor(phase.visibility)} capitalize`}>
                      {phase.visibility}
                    </div>
                  </div>
                </div>

                {selectedPhase === index && (
                  <div className={`mt-4 pt-4 border-t ${theme.border}`}>
                    <div className={`text-sm ${theme.textSecondary} mb-4`}>
                      {phase.instructions}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className={theme.textMuted}>Elevation</div>
                        <div className="font-medium">{Math.round(phase.elevation)}°</div>
                      </div>
                      <div>
                        <div className={theme.textMuted}>Distance</div>
                        <div className="font-medium">{Math.round(phase.distance)} km</div>
                      </div>
                      <div>
                        <div className={theme.textMuted}>Duration</div>
                        <div className="font-medium">{Math.round(phase.endTime - phase.startTime)}s</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment recommendations */}
      <div className={`${theme.card} border ${theme.border} rounded-lg p-4`}>
        <h3 className="text-lg font-semibold mb-3">🔭 Equipment Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {viewingAnalysis.equipmentRecommendations.map((rec, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="text-blue-400 mt-1">•</div>
              <div className={theme.textSecondary}>{rec}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weather considerations */}
      <div className={`${theme.card} border ${theme.border} rounded-lg p-4`}>
        <h3 className="text-lg font-semibold mb-3">🌤️ Weather Considerations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {viewingAnalysis.weatherConsiderations.map((consideration, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="text-yellow-400 mt-1">•</div>
              <div className={theme.textSecondary}>{consideration}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced tips */}
      <div className={`${theme.card} border ${theme.border} rounded-lg p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">📸 Photography Tips</h3>
          <button
            onClick={() => setShowAdvancedTips(!showAdvancedTips)}
            className={`text-sm px-3 py-1 rounded ${theme.card} border ${theme.border} hover:bg-gray-600 transition-colors`}
          >
            {showAdvancedTips ? 'Hide' : 'Show'} Advanced
          </button>
        </div>
        
        {showAdvancedTips && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {viewingAnalysis.photographyTips.map((tip, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="text-green-400 mt-1">•</div>
                <div className={theme.textSecondary}>{tip}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety notice */}
      <div className={`bg-orange-900 border border-orange-600 rounded-lg p-4 text-orange-200`}>
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-lg">⚠️</span>
          <span className="font-semibold">Safety Reminder</span>
        </div>
        <div className="text-sm">
          Never use optical equipment to look directly at the sun or bright objects. 
          Be aware of your surroundings when observing at night. 
          Share your location with others when heading to remote viewing spots.
        </div>
      </div>
    </div>
  );
};

export default BermudaViewingGuide;