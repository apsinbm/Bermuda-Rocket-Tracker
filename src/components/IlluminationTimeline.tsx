/**
 * Illumination Timeline Component
 * 
 * Interactive visual timeline showing when rocket plume will be illuminated by sunlight.
 * Displays Earth's shadow, rocket altitude, and illumination zones over time.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LaunchWithVisibility } from '../types';
import { PlumeIlluminationPrediction } from '../services/plumeIlluminationService';

interface IlluminationTimelineProps {
  launch: LaunchWithVisibility;
  prediction: PlumeIlluminationPrediction;
}

interface TimelinePoint {
  time: number; // seconds from launch
  altitude: number; // km
  shadowHeight: number; // km
  isIlluminated: boolean;
  intensity?: 'faint' | 'moderate' | 'bright' | 'brilliant';
}

const IlluminationTimeline: React.FC<IlluminationTimelineProps> = ({ launch, prediction }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef<number>();

  // Generate timeline data points
  const generateTimelineData = useCallback((): TimelinePoint[] => {
    const points: TimelinePoint[] = [];
    const launchTime = new Date(launch.net);
    const maxTime = 600; // 10 minutes
    
    for (let t = 0; t <= maxTime; t += 5) {
      // Simplified altitude model
      let altitude = 0;
      if (t <= 120) {
        altitude = (t / 120) * (t / 120) * 100; // Quadratic climb to 100km at 2 minutes
      } else {
        altitude = 100 + Math.sqrt(t - 120) * 10; // Slower climb after
      }

      // Estimate shadow height (simplified - would use real solar calculations)
      const minutesFromLaunch = t / 60;
      const shadowHeight = 80 + Math.sin(minutesFromLaunch * 0.1) * 20; // Varies 60-100km

      const isIlluminated = altitude > shadowHeight;
      
      // Find intensity from prediction periods
      let intensity: TimelinePoint['intensity'] = undefined;
      if (isIlluminated && prediction.illuminationPeriods.length > 0) {
        const currentTime = new Date(launchTime.getTime() + t * 1000);
        for (const period of prediction.illuminationPeriods) {
          if (currentTime >= period.startTime && currentTime <= period.endTime) {
            intensity = period.plumeVisibility.intensity;
            break;
          }
        }
      }

      points.push({
        time: t,
        altitude,
        shadowHeight,
        isIlluminated,
        intensity
      });
    }

    return points;
  }, [launch, prediction]);

  const timelineData = generateTimelineData();

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          setDimensions({
            width: Math.min(rect.width - 32, 1200),
            height: Math.min(400, window.innerHeight * 0.4)
          });
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    const padding = { top: 40, right: 60, bottom: 60, left: 60 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    // Calculate scales
    const maxAltitude = 200; // km
    const maxTime = 600; // seconds

    const xScale = (time: number) => padding.left + (time / maxTime) * chartWidth;
    const yScale = (altitude: number) => padding.top + chartHeight - (altitude / maxAltitude) * chartHeight;

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (time)
    for (let t = 0; t <= maxTime; t += 60) {
      const x = xScale(t);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
      
      // Time labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`T+${t/60}min`, x, padding.top + chartHeight + 20);
    }
    
    // Horizontal grid lines (altitude)
    for (let alt = 0; alt <= maxAltitude; alt += 50) {
      const y = yScale(alt);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      
      // Altitude labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${alt}km`, padding.left - 10, y + 4);
    }

    // Draw Earth's shadow zone
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < timelineData.length; i++) {
      const x = xScale(timelineData[i].time);
      const y = yScale(timelineData[i].shadowHeight);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(xScale(maxTime), yScale(0));
    ctx.lineTo(xScale(0), yScale(0));
    ctx.closePath();
    ctx.fill();

    // Label shadow zone
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("EARTH'S SHADOW", dimensions.width / 2, yScale(40));

    // Draw illumination zones
    for (const period of prediction.illuminationPeriods) {
      const startTime = (period.startTime.getTime() - new Date(launch.net).getTime()) / 1000;
      const endTime = (period.endTime.getTime() - new Date(launch.net).getTime()) / 1000;
      
      if (startTime < maxTime && endTime > 0) {
        const x1 = xScale(Math.max(0, startTime));
        const x2 = xScale(Math.min(maxTime, endTime));
        
        // Get intensity color
        let color = 'rgba(255, 255, 0, 0.2)';
        if (period.plumeVisibility.intensity === 'brilliant') {
          color = 'rgba(255, 215, 0, 0.4)';
        } else if (period.plumeVisibility.intensity === 'bright') {
          color = 'rgba(255, 255, 0, 0.3)';
        } else if (period.plumeVisibility.intensity === 'moderate') {
          color = 'rgba(255, 255, 100, 0.25)';
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(x1, padding.top, x2 - x1, chartHeight);
        
        // Label illumination zone
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(period.plumeVisibility.intensity.toUpperCase(), (x1 + x2) / 2, padding.top + 20);
      }
    }

    // Draw rocket trajectory
    ctx.beginPath();
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    
    for (let i = 0; i < timelineData.length; i++) {
      const x = xScale(timelineData[i].time);
      const y = yScale(timelineData[i].altitude);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw illuminated points
    for (let i = 0; i < timelineData.length; i++) {
      if (timelineData[i].isIlluminated) {
        const x = xScale(timelineData[i].time);
        const y = yScale(timelineData[i].altitude);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = timelineData[i].intensity === 'brilliant' ? '#ffd700' :
                       timelineData[i].intensity === 'bright' ? '#ffff00' :
                       timelineData[i].intensity === 'moderate' ? '#ffff99' : '#ffffcc';
        ctx.fill();
      }
    }

    // Draw animation marker if animating
    if (isAnimating && animationTime <= maxTime) {
      const markerX = xScale(animationTime);
      
      // Vertical line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(markerX, padding.top);
      ctx.lineTo(markerX, padding.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Find rocket position at this time
      const pointIndex = Math.floor(animationTime / 5);
      if (pointIndex < timelineData.length) {
        const point = timelineData[pointIndex];
        const rocketY = yScale(point.altitude);
        
        // Rocket marker
        ctx.beginPath();
        ctx.arc(markerX, rocketY, 8, 0, Math.PI * 2);
        ctx.fillStyle = point.isIlluminated ? '#ffd700' : '#ff6b6b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Rocket icon
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚀', markerX, rocketY - 15);
      }
    }

    // Axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 14px sans-serif';
    
    // Y-axis label
    ctx.save();
    ctx.translate(20, dimensions.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('ALTITUDE (km)', 0, 0);
    ctx.restore();
    
    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('TIME SINCE LAUNCH', dimensions.width / 2, dimensions.height - 10);
    
    // Title
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('PLUME ILLUMINATION TIMELINE', dimensions.width / 2, 25);

    // Legend
    const legendX = dimensions.width - 150;
    const legendY = 50;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(legendX - 10, legendY - 10, 140, 100);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(legendX, legendY, 20, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Rocket Altitude', legendX + 25, legendY + 4);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(legendX, legendY + 20, 20, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText("Earth's Shadow", legendX + 25, legendY + 28);
    
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(legendX + 10, legendY + 45, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Illuminated', legendX + 25, legendY + 49);
    
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillRect(legendX, legendY + 60, 20, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Illumination Zone', legendX + 25, legendY + 68);

  }, [dimensions, timelineData, prediction, launch, isAnimating, animationTime]);

  // Handle mouse interaction
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setMousePosition({ x, y });

    // Find closest data point
    const padding = { left: 60, right: 60 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    
    if (x >= padding.left && x <= dimensions.width - padding.right) {
      const time = ((x - padding.left) / chartWidth) * 600;
      const pointIndex = Math.round(time / 5);
      
      if (pointIndex >= 0 && pointIndex < timelineData.length) {
        setHoveredPoint(timelineData[pointIndex]);
      }
    } else {
      setHoveredPoint(null);
    }
  }, [dimensions, timelineData]);

  // Animation controls
  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    setAnimationTime(0);
    
    const animate = () => {
      setAnimationTime(prev => {
        const next = prev + 2; // 2 seconds per frame
        if (next > 600) {
          setIsAnimating(false);
          return 0;
        }
        return next;
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  }, []);

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🚀 Interactive Timeline
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={isAnimating ? stopAnimation : startAnimation}
            className={`px-4 py-2 rounded-lg text-white transition-colors ${
              isAnimating 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isAnimating ? '⏸️ Stop' : '▶️ Animate'}
          </button>
          {isAnimating && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              T+{Math.floor(animationTime / 60)}:{(animationTime % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative bg-gray-900 rounded-lg p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        />
        
        {/* Hover tooltip */}
        {hoveredPoint && (
          <div 
            className="absolute bg-black bg-opacity-90 text-white text-xs rounded-lg p-2 pointer-events-none z-10"
            style={{
              left: `${mousePosition.x + 10}px`,
              top: `${mousePosition.y - 60}px`
            }}
          >
            <div className="space-y-1">
              <div><strong>T+{Math.floor(hoveredPoint.time / 60)}:{(hoveredPoint.time % 60).toString().padStart(2, '0')}</strong></div>
              <div>Altitude: {Math.round(hoveredPoint.altitude)}km</div>
              <div>Shadow: {Math.round(hoveredPoint.shadowHeight)}km</div>
              {hoveredPoint.isIlluminated && (
                <div className="text-yellow-400">
                  ✨ Illuminated
                  {hoveredPoint.intensity && ` - ${hoveredPoint.intensity}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          📊 Understanding the Timeline
        </h4>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p>• The <span className="text-red-500 font-medium">red line</span> shows the rocket's altitude over time</p>
          <p>• The <span className="font-medium">gray zone</span> represents Earth's shadow - rockets below this are in darkness</p>
          <p>• <span className="text-yellow-400 font-medium">Yellow highlights</span> show when the plume will be illuminated by sunlight</p>
          <p>• <span className="font-medium">Bright dots</span> indicate visible plume illumination periods</p>
        </div>
      </div>
    </div>
  );
};

export default IlluminationTimeline;