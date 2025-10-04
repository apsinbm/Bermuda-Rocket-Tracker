/**
 * Stage Event Timeline Component
 * 
 * Professional timeline showing mission events like MECO, stage separation, etc.
 * Replicates FlightClub's event timeline interface
 */

import React, { useMemo, useState } from 'react';
import { ProcessedSimulationData, StageEvent, EnhancedTelemetryFrame } from '../services/flightClubApiService';

interface StageEventTimelineProps {
  simulationData: ProcessedSimulationData;
  playbackTime: number;
  onTimeSelect?: (time: number) => void;
  darkMode?: boolean;
}

interface EnhancedStageEvent extends StageEvent {
  id: string;
  telemetryData?: EnhancedTelemetryFrame;
  category: 'propulsion' | 'separation' | 'deployment' | 'navigation' | 'other';
  importance: 'critical' | 'major' | 'minor';
  description: string;
}

const StageEventTimeline: React.FC<StageEventTimelineProps> = ({
  simulationData,
  playbackTime,
  onTimeSelect,
  darkMode = true
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const { stageEvents, enhancedTelemetry } = simulationData;

  // Enhanced events with additional metadata
  const enhancedEvents = useMemo(() => {
    return stageEvents.map((event, index): EnhancedStageEvent => {
      // Find closest telemetry frame
      const telemetryFrame = enhancedTelemetry.find(
        frame => Math.abs(frame.time - event.time) < 5
      ) || enhancedTelemetry[Math.min(Math.floor(event.time / 10), enhancedTelemetry.length - 1)];

      // Categorize events
      let category: EnhancedStageEvent['category'] = 'other';
      let importance: EnhancedStageEvent['importance'] = 'minor';
      let description = '';

      const eventLower = event.event.toLowerCase();

      if (eventLower.includes('meco') || eventLower.includes('main engine cutoff')) {
        category = 'propulsion';
        importance = 'critical';
        description = 'Main Engine Cutoff - Primary propulsion ends';
      } else if (eventLower.includes('seco') || eventLower.includes('second engine cutoff')) {
        category = 'propulsion';
        importance = 'critical';
        description = 'Second Engine Cutoff - Upper stage propulsion ends';
      } else if (eventLower.includes('sep') || eventLower.includes('separation')) {
        category = 'separation';
        importance = 'critical';
        description = 'Stage Separation - Vehicle components separate';
      } else if (eventLower.includes('ignition') || eventLower.includes('startup')) {
        category = 'propulsion';
        importance = 'major';
        description = 'Engine Ignition - Propulsion system activates';
      } else if (eventLower.includes('deploy') || eventLower.includes('fairing')) {
        category = 'deployment';
        importance = 'major';
        description = 'Component Deployment - Payload or structural release';
      } else if (eventLower.includes('pitch') || eventLower.includes('roll') || eventLower.includes('yaw')) {
        category = 'navigation';
        importance = 'minor';
        description = 'Vehicle Attitude Change - Flight path adjustment';
      } else if (eventLower.includes('throttle')) {
        category = 'propulsion';
        importance = 'minor';
        description = 'Throttle Adjustment - Engine power modification';
      }

      return {
        ...event,
        id: `${event.time}-${index}`,
        telemetryData: telemetryFrame,
        category,
        importance,
        description
      } as EnhancedStageEvent;
    })
    .sort((a, b) => a.time - b.time)
    .filter(event => event.importance === 'critical' || event.importance === 'major'); // Show only critical and major events
  }, [stageEvents, enhancedTelemetry]);

  // Timeline scale
  const maxTime = useMemo(() => {
    if (!enhancedTelemetry.length) return 600;
    return Math.max(...enhancedTelemetry.map(frame => frame.time));
  }, [enhancedTelemetry]);

  // Theme configuration
  const theme = {
    background: darkMode ? 'bg-gray-900' : 'bg-white',
    card: darkMode ? 'bg-gray-800' : 'bg-gray-50',
    border: darkMode ? 'border-gray-700' : 'border-gray-300',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-300' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-500'
  };

  // Event category colors
  const getCategoryColor = (category: EnhancedStageEvent['category']) => {
    switch (category) {
      case 'propulsion': return '#ff6b6b';
      case 'separation': return '#ffd700';
      case 'deployment': return '#00ff88';
      case 'navigation': return '#4a90e2';
      default: return '#9ca3af';
    }
  };

  // Importance indicators
  const getImportanceIcon = (importance: EnhancedStageEvent['importance']) => {
    switch (importance) {
      case 'critical': return '🔥';
      case 'major': return '⭐';
      case 'minor': return '•';
      default: return '•';
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `T+${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle event click
  const handleEventClick = (event: EnhancedStageEvent) => {
    if (onTimeSelect) {
      onTimeSelect(event.time);
    }
    setExpandedEvent(expandedEvent === event.id ? null : event.id);
  };

  if (!enhancedEvents.length) {
    return (
      <div className={`p-8 text-center ${theme.card} ${theme.border} border rounded-lg`}>
        <div className={`text-lg font-medium ${theme.text} mb-2`}>No Stage Events</div>
        <div className={`text-sm ${theme.textMuted}`}>
          No mission events are available for this trajectory
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 p-6 ${theme.background} ${theme.text} rounded-lg`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Mission Timeline</h2>
        <div className={`text-sm ${theme.textSecondary}`}>
          {enhancedEvents.length} events • Click to jump to time
        </div>
      </div>

      {/* Timeline scale */}
      <div className="relative">
        <div className={`h-2 ${theme.card} rounded-full relative overflow-hidden`}>
          {/* Progress indicator */}
          <div 
            className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${(playbackTime / maxTime) * 100}%` }}
          />
          
          {/* Current time indicator */}
          <div 
            className="absolute top-0 w-1 h-full bg-red-500"
            style={{ left: `${(playbackTime / maxTime) * 100}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs mt-1">
          <span>T+0:00</span>
          <span className="font-medium">{formatTime(playbackTime)}</span>
          <span>{formatTime(maxTime)}</span>
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {enhancedEvents.map((event) => {
          const isActive = Math.abs(playbackTime - event.time) < 10;
          const isPassed = playbackTime > event.time;
          const isExpanded = expandedEvent === event.id;
          
          return (
            <div
              key={event.id}
              className={`
                p-4 rounded-lg border transition-all duration-200 cursor-pointer
                ${isActive 
                  ? 'bg-blue-900 border-blue-400 shadow-lg scale-105' 
                  : isPassed 
                    ? `${theme.card} ${theme.border} opacity-60`
                    : `${theme.card} ${theme.border} hover:border-gray-500`
                }
                ${hoveredEvent === event.id ? 'shadow-md' : ''}
              `}
              onClick={() => handleEventClick(event)}
              onMouseEnter={() => setHoveredEvent(event.id)}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getCategoryColor(event.category) }}
                  />
                  
                  <div className="text-lg">
                    {getImportanceIcon(event.importance)}
                  </div>
                  
                  <div>
                    <div className="font-semibold text-lg">{event.event}</div>
                    <div className={`text-sm ${theme.textSecondary}`}>
                      {formatTime(event.time)} • Stage {event.stageNumber}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-sm ${theme.textMuted} capitalize`}>
                    {event.category}
                  </div>
                  {event.telemetryData && (
                    <div className={`text-xs ${theme.textMuted}`}>
                      {(event.telemetryData.altitude / 1000).toFixed(1)} km
                    </div>
                  )}
                </div>
              </div>
              
              {/* Expanded details */}
              {isExpanded && (
                <div className={`mt-4 pt-4 border-t ${theme.border}`}>
                  <div className={`text-sm ${theme.textSecondary} mb-3`}>
                    {event.description}
                  </div>
                  
                  {event.telemetryData && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className={theme.textMuted}>Altitude</div>
                        <div className="font-medium">
                          {(event.telemetryData.altitude / 1000).toFixed(1)} km
                        </div>
                      </div>
                      <div>
                        <div className={theme.textMuted}>Velocity</div>
                        <div className="font-medium">
                          {(event.telemetryData.speed / 1000).toFixed(2)} km/s
                        </div>
                      </div>
                      <div>
                        <div className={theme.textMuted}>Distance from Bermuda</div>
                        <div className="font-medium">
                          {event.telemetryData.distanceFromBermuda.toFixed(0)} km
                        </div>
                      </div>
                      <div>
                        <div className={theme.textMuted}>Visibility</div>
                        <div className={`font-medium ${event.telemetryData.aboveHorizon ? 'text-green-400' : 'text-red-400'}`}>
                          {event.telemetryData.aboveHorizon ? 'Visible' : 'Not Visible'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className={`border-t ${theme.border} pt-4`}>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span className={theme.textSecondary}>Propulsion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className={theme.textSecondary}>Separation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className={theme.textSecondary}>Deployment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className={theme.textSecondary}>Navigation</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔥</span>
            <span className={theme.textSecondary}>Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <span>⭐</span>
            <span className={theme.textSecondary}>Major</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageEventTimeline;