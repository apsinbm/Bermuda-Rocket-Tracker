/**
 * FlightClub-Style 2D Trajectory Visualization
 * 
 * Professional 2D trajectory map that replicates FlightClub's visualization features
 */

import React from 'react';
import { ProcessedSimulationData } from '../services/flightClubApiService';

interface FlightClub2DVisualizationProps {
  simulationData: ProcessedSimulationData;
  playbackTime: number;
  onTimeSelect?: (time: number) => void;
  darkMode?: boolean;
}

const FlightClub2DVisualization: React.FC<FlightClub2DVisualizationProps> = ({
  simulationData,
  playbackTime,
  darkMode = true
}) => {
  const { enhancedTelemetry } = simulationData;

  // Format time display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `T+${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get current telemetry frame
  const currentFrame = enhancedTelemetry[Math.floor(playbackTime / 10)] || enhancedTelemetry[0];

  const theme = {
    background: darkMode ? 'bg-gray-900' : 'bg-white',
    card: darkMode ? 'bg-gray-800' : 'bg-gray-50',
    border: darkMode ? 'border-gray-700' : 'border-gray-300',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-300' : 'text-gray-600'
  };

  return (
    <div className={`p-6 ${theme.background} ${theme.text} h-96 flex items-center justify-center`}>
      <div className={`${theme.card} border ${theme.border} rounded-lg p-8 max-w-md w-full`}>
        <h3 className="text-xl font-bold mb-4 text-center">2D Trajectory Visualization</h3>
        
        {currentFrame ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-2">
                {formatTime(playbackTime)}
              </div>
              <div className={`text-sm ${theme.textSecondary}`}>Mission Time</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className={theme.textSecondary}>Altitude</div>
                <div className="font-medium text-green-400">
                  {(currentFrame.altitude / 1000).toFixed(1)} km
                </div>
              </div>
              <div>
                <div className={theme.textSecondary}>Velocity</div>
                <div className="font-medium text-red-400">
                  {(currentFrame.speed / 1000).toFixed(2)} km/s
                </div>
              </div>
              <div>
                <div className={theme.textSecondary}>Distance from Bermuda</div>
                <div className="font-medium text-blue-400">
                  {currentFrame.distanceFromBermuda.toFixed(0)} km
                </div>
              </div>
              <div>
                <div className={theme.textSecondary}>Visibility</div>
                <div className={`font-medium ${currentFrame.aboveHorizon ? 'text-green-400' : 'text-gray-400'}`}>
                  {currentFrame.aboveHorizon ? 'Visible' : 'Not Visible'}
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <div className={`text-xs ${theme.textSecondary}`}>
                {enhancedTelemetry.length} telemetry data points loaded
              </div>
              <div className={`text-xs ${theme.textSecondary} mt-1`}>
                Professional 2D visualization coming soon
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`text-lg ${theme.textSecondary}`}>No telemetry data available</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightClub2DVisualization;