/**
 * Telemetry Graphs Component
 * 
 * Professional telemetry analytics replicating FlightClub's data panel style
 * Shows altitude, speed, distance, and other key metrics over time
 */

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { ProcessedSimulationData, EnhancedTelemetryFrame, StageEvent } from '../services/flightClubApiService';
import { getTelemetryFrame } from '../utils/telemetryUtils';

interface TelemetryGraphsProps {
  simulationData: ProcessedSimulationData;
  playbackTime: number;
  onTimeSelect?: (time: number) => void;
  darkMode?: boolean;
  maxDisplayTime?: number;
}

interface GraphDataset {
  name: string;
  data: { x: number; y: number }[];
  color: string;
  unit: string;
  scale?: 'linear' | 'log';
  yAxisLabel: string;
  valueFromFrame: (frame: EnhancedTelemetryFrame) => number;
}

const TelemetryGraphs: React.FC<TelemetryGraphsProps> = ({
  simulationData,
  playbackTime,
  onTimeSelect,
  darkMode = true,
  maxDisplayTime
}) => {
  const altitudeCanvasRef = useRef<HTMLCanvasElement>(null);
  const speedCanvasRef = useRef<HTMLCanvasElement>(null);
  const distanceCanvasRef = useRef<HTMLCanvasElement>(null);
  const elevationCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [hoveredGraph, setHoveredGraph] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: string } | null>(null);

  const { enhancedTelemetry, stageEvents } = simulationData;

  const telemetryFrames = useMemo(() => {
    if (!enhancedTelemetry.length) {
      return [] as EnhancedTelemetryFrame[];
    }

    if (typeof maxDisplayTime === 'number' && maxDisplayTime >= 0) {
      const cutoff = maxDisplayTime + 1; // small buffer for interpolation
      return enhancedTelemetry.filter(frame => frame.time <= cutoff);
    }

    return enhancedTelemetry;
  }, [enhancedTelemetry, maxDisplayTime]);

  const visibleStageEvents = useMemo(() => {
    if (!stageEvents.length) {
      return [] as StageEvent[];
    }

    if (typeof maxDisplayTime === 'number' && maxDisplayTime >= 0) {
      const cutoff = maxDisplayTime + 1;
      return stageEvents.filter(event => event.time <= cutoff);
    }

    return stageEvents;
  }, [stageEvents, maxDisplayTime]);

  // Theme configuration
  const theme = useMemo(() => ({
    background: darkMode ? '#1a1a1a' : '#ffffff',
    gridColor: darkMode ? '#333333' : '#e0e0e0',
    textColor: darkMode ? '#ffffff' : '#333333',
    axisColor: darkMode ? '#666666' : '#666666',
    playbackLineColor: '#ff6b6b',
    stageEventColor: '#ffd700',
    visibilityColor: '#00ff88'
  }), [darkMode]);

  // Process telemetry data into graph datasets
  const datasets = useMemo(() => {
    if (!telemetryFrames.length) return {} as Record<string, GraphDataset>;

    const altitudeData = telemetryFrames.map(frame => ({
      x: frame.time,
      y: frame.altitude / 1000 // Convert to km
    }));

    const speedData = telemetryFrames.map(frame => ({
      x: frame.time,
      y: frame.speed / 1000 // Convert to km/s
    }));

    const distanceData = telemetryFrames.map(frame => ({
      x: frame.time,
      y: frame.distanceFromBermuda
    }));

    const elevationData = telemetryFrames.map(frame => ({
      x: frame.time,
      y: frame.elevationAngle
    }));

    return {
      altitude: {
        name: 'Altitude',
        data: altitudeData,
        color: '#00ff88',
        unit: 'km',
        yAxisLabel: 'Altitude (km)',
        scale: 'linear' as const,
        valueFromFrame: (frame: EnhancedTelemetryFrame) => frame.altitude / 1000
      },
      speed: {
        name: 'Velocity',
        data: speedData,
        color: '#ff6b6b',
        unit: 'km/s',
        yAxisLabel: 'Speed (km/s)',
        scale: 'linear' as const,
        valueFromFrame: (frame: EnhancedTelemetryFrame) => frame.speed / 1000
      },
      distance: {
        name: 'Distance from Bermuda',
        data: distanceData,
        color: '#4a90e2',
        unit: 'km',
        yAxisLabel: 'Distance (km)',
        scale: 'linear' as const,
        valueFromFrame: (frame: EnhancedTelemetryFrame) => frame.distanceFromBermuda
      },
      elevation: {
        name: 'Elevation Angle',
        data: elevationData,
        color: '#ffd700',
        unit: '°',
        yAxisLabel: 'Elevation (degrees)',
        scale: 'linear' as const,
        valueFromFrame: (frame: EnhancedTelemetryFrame) => frame.elevationAngle
      }
    };
  }, [telemetryFrames]);

  // Draw individual graph
  const drawGraph = useCallback((
    canvas: HTMLCanvasElement,
    dataset: GraphDataset,
    graphId: string
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !dataset.data.length) return;

    const { width, height } = canvas;
    const padding = { top: 30, right: 40, bottom: 50, left: 80 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    // Calculate data ranges
    const maxTime = Math.max(...dataset.data.map(d => d.x));
    const minTime = Math.min(...dataset.data.map(d => d.x));
    const timeRange = Math.max(maxTime - minTime, 1);
    const maxValue = Math.max(...dataset.data.map(d => d.y));
    const minValue = Math.min(...dataset.data.map(d => d.y));
    const valueRange = Math.max(maxValue - minValue, 1);

    // Helper functions
    const timeToX = (time: number) => padding.left + (time - minTime) / timeRange * graphWidth;
    const valueToY = (value: number) => padding.top + graphHeight - (value - minValue) / valueRange * graphHeight;

    // Draw grid
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Vertical grid lines (time)
    for (let i = 0; i <= 10; i++) {
      const time = minTime + (maxTime - minTime) * (i / 10);
      const x = timeToX(time);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Horizontal grid lines (values)
    for (let i = 0; i <= 8; i++) {
      const value = minValue + valueRange * (i / 8);
      const y = valueToY(value);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw axes
    ctx.strokeStyle = theme.axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = theme.textColor;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';

    // X-axis label
    ctx.fillText('Time (T+ seconds)', width / 2, height - 10);

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(dataset.yAxisLabel, 0, 0);
    ctx.restore();

    // Draw tick labels
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    
    // X-axis ticks
    for (let i = 0; i <= 10; i++) {
      const time = minTime + (maxTime - minTime) * (i / 10);
      const x = timeToX(time);
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(time).toString(), x, height - padding.bottom + 20);
    }

    // Y-axis ticks
    for (let i = 0; i <= 8; i++) {
      const value = minValue + valueRange * (i / 8);
      const y = valueToY(value);
      ctx.textAlign = 'right';
      const formattedValue = value < 1000 ? value.toFixed(1) : (value / 1000).toFixed(1) + 'k';
      ctx.fillText(formattedValue, padding.left - 10, y + 4);
    }

    // Draw stage event markers
    visibleStageEvents.forEach(event => {
      const x = timeToX(event.time);
      if (x >= padding.left && x <= width - padding.right) {
        ctx.strokeStyle = theme.stageEventColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Stage event label
        ctx.fillStyle = theme.stageEventColor;
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x, padding.top - 10);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(event.event, 0, 0);
        ctx.restore();
      }
    });

    // Draw data line
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    dataset.data.forEach((point, index) => {
      const x = timeToX(point.x);
      const y = valueToY(point.y);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();

    // Draw visibility zones for elevation graph
    if (graphId === 'elevation' && dataset.data.length > 0) {
      ctx.fillStyle = theme.visibilityColor + '20'; // 20% opacity
      ctx.beginPath();
      
      let inVisibleZone = false;
      let visibleStartX = 0;
      
      dataset.data.forEach((point, index) => {
        const x = timeToX(point.x);
        const y = valueToY(point.y);
        
        if (point.y > 0 && !inVisibleZone) {
          // Start of visible zone
          inVisibleZone = true;
          visibleStartX = x;
          ctx.moveTo(x, height - padding.bottom);
          ctx.lineTo(x, y);
        } else if (point.y > 0 && inVisibleZone) {
          // Continue visible zone
          ctx.lineTo(x, y);
        } else if (point.y <= 0 && inVisibleZone) {
          // End of visible zone
          inVisibleZone = false;
          ctx.lineTo(x, height - padding.bottom);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
        }
        
        // Handle end of data while in visible zone
        if (index === dataset.data.length - 1 && inVisibleZone) {
          ctx.lineTo(x, height - padding.bottom);
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    // Draw current playback time indicator
    const playbackX = timeToX(Math.min(Math.max(playbackTime, minTime), maxTime));
    if (playbackX >= padding.left && playbackX <= width - padding.right) {
      ctx.strokeStyle = theme.playbackLineColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(playbackX, padding.top);
      ctx.lineTo(playbackX, height - padding.bottom);
      ctx.stroke();

      // Current value indicator
      const currentFrame = getTelemetryFrame(telemetryFrames, playbackTime);
      const fallbackPoint = dataset.data.length ? dataset.data[0] : null;
      if (currentFrame || fallbackPoint) {
        const valueSource = currentFrame ? dataset.valueFromFrame(currentFrame) : fallbackPoint!.y;
        const currentY = valueToY(valueSource);
        ctx.fillStyle = theme.playbackLineColor;
        ctx.beginPath();
        ctx.arc(playbackX, currentY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Current value label
        ctx.fillStyle = theme.background;
        ctx.strokeStyle = theme.playbackLineColor;
        ctx.lineWidth = 2;
        const label = `${valueSource.toFixed(1)} ${dataset.unit}`;
        const labelWidth = ctx.measureText(label).width + 10;
        const labelX = playbackX > width / 2 ? playbackX - labelWidth - 10 : playbackX + 10;
        const labelY = currentY - 20;
        
        ctx.fillRect(labelX, labelY - 15, labelWidth, 20);
        ctx.strokeRect(labelX, labelY - 15, labelWidth, 20);
        
        ctx.fillStyle = theme.textColor;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, labelX + labelWidth / 2, labelY - 2);
      }
    }

    // Draw title
    ctx.fillStyle = theme.textColor;
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dataset.name, width / 2, 20);

  }, [theme, playbackTime, visibleStageEvents, telemetryFrames]);

  // Canvas click handler for time selection
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>, dataset: GraphDataset) => {
    if (!onTimeSelect || !dataset.data.length) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    const padding = { left: 80, right: 40 };
    const graphWidth = canvas.width - padding.left - padding.right;
    const maxTime = Math.max(...dataset.data.map(d => d.x));
    const minTime = Math.min(...dataset.data.map(d => d.x));
    
    if (x >= padding.left && x <= canvas.width - padding.right) {
      const relativeX = x - padding.left;
      const time = minTime + (relativeX / graphWidth) * (maxTime - minTime);
      onTimeSelect(Math.max(0, Math.min(time, maxTime)));
    }
  }, [onTimeSelect]);

  // Redraw graphs when data or playback time changes
  useEffect(() => {
    if (altitudeCanvasRef.current && datasets.altitude) {
      drawGraph(altitudeCanvasRef.current, datasets.altitude, 'altitude');
    }
  }, [drawGraph, datasets.altitude]);

  useEffect(() => {
    if (speedCanvasRef.current && datasets.speed) {
      drawGraph(speedCanvasRef.current, datasets.speed, 'speed');
    }
  }, [drawGraph, datasets.speed]);

  useEffect(() => {
    if (distanceCanvasRef.current && datasets.distance) {
      drawGraph(distanceCanvasRef.current, datasets.distance, 'distance');
    }
  }, [drawGraph, datasets.distance]);

  useEffect(() => {
    if (elevationCanvasRef.current && datasets.elevation) {
      drawGraph(elevationCanvasRef.current, datasets.elevation, 'elevation');
    }
  }, [drawGraph, datasets.elevation]);

  if (!telemetryFrames.length) {
    return (
      <div className={`p-8 text-center ${darkMode ? 'text-white bg-gray-900' : 'text-gray-600 bg-gray-50'} rounded-lg`}>
        <div className="text-lg font-medium mb-2">No Telemetry Data Available</div>
        <div className="text-sm opacity-75">
          Telemetry graphs will appear when simulation data is loaded
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 p-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} rounded-lg`}>
      <div className="text-center">
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
          FlightClub Telemetry Analytics
        </h2>
        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {telemetryFrames.length} telemetry data points • Click graphs to seek playback time
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Altitude Graph */}
        <div className="space-y-2">
          <canvas
            ref={altitudeCanvasRef}
            width={600}
            height={300}
            className="w-full h-auto border border-gray-300 dark:border-gray-600 rounded cursor-crosshair hover:border-green-400 transition-colors"
            onClick={(e) => datasets.altitude && handleCanvasClick(e, datasets.altitude)}
            onMouseEnter={() => setHoveredGraph('altitude')}
            onMouseLeave={() => setHoveredGraph(null)}
          />
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
            Maximum altitude: {datasets.altitude ? Math.max(...datasets.altitude.data.map(d => d.y)).toFixed(1) : '0'} km
          </div>
        </div>

        {/* Speed Graph */}
        <div className="space-y-2">
          <canvas
            ref={speedCanvasRef}
            width={600}
            height={300}
            className="w-full h-auto border border-gray-300 dark:border-gray-600 rounded cursor-crosshair hover:border-red-400 transition-colors"
            onClick={(e) => datasets.speed && handleCanvasClick(e, datasets.speed)}
            onMouseEnter={() => setHoveredGraph('speed')}
            onMouseLeave={() => setHoveredGraph(null)}
          />
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
            Maximum velocity: {datasets.speed ? Math.max(...datasets.speed.data.map(d => d.y)).toFixed(2) : '0'} km/s
          </div>
        </div>

        {/* Distance from Bermuda Graph */}
        <div className="space-y-2">
          <canvas
            ref={distanceCanvasRef}
            width={600}
            height={300}
            className="w-full h-auto border border-gray-300 dark:border-gray-600 rounded cursor-crosshair hover:border-blue-400 transition-colors"
            onClick={(e) => datasets.distance && handleCanvasClick(e, datasets.distance)}
            onMouseEnter={() => setHoveredGraph('distance')}
            onMouseLeave={() => setHoveredGraph(null)}
          />
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
            Closest approach: {datasets.distance ? Math.min(...datasets.distance.data.map(d => d.y)).toFixed(1) : '0'} km from Bermuda
          </div>
        </div>

        {/* Elevation Angle Graph (Visibility) */}
        <div className="space-y-2">
          <canvas
            ref={elevationCanvasRef}
            width={600}
            height={300}
            className="w-full h-auto border border-gray-300 dark:border-gray-600 rounded cursor-crosshair hover:border-yellow-400 transition-colors"
            onClick={(e) => datasets.elevation && handleCanvasClick(e, datasets.elevation)}
            onMouseEnter={() => setHoveredGraph('elevation')}
            onMouseLeave={() => setHoveredGraph(null)}
          />
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
            {datasets.elevation && datasets.elevation.data.length > 0 
              ? `Visible period with peak elevation: ${Math.max(...datasets.elevation.data.map(d => d.y)).toFixed(1)}°`
              : 'Launch not visible from Bermuda'
            }
          </div>
        </div>
      </div>

      {/* Legend and Controls */}
      <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'} pt-4`}>
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-400"></div>
            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Current Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-yellow-400 opacity-60" style={{ borderStyle: 'dashed' }}></div>
            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Stage Events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-green-400 opacity-20"></div>
            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Visible from Bermuda</span>
          </div>
        </div>
        
        {hoveredGraph && (
          <div className={`text-center mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Click on the {hoveredGraph} graph to jump to that time in the trajectory playback
          </div>
        )}
      </div>
    </div>
  );
};

export default TelemetryGraphs;
