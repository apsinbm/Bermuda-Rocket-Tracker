/**
 * Sky Tracker Component
 * Interactive sky position indicator with device orientation support
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LaunchWithVisibility } from '../types';

interface SkyTrackerProps {
  launch: LaunchWithVisibility;
  currentPhase?: any; // From LiveCountdown
  showCompass?: boolean;
  showStars?: boolean;
  size?: number;
}

interface SkyPosition {
  azimuth: number; // 0-360 degrees (0 = North)
  elevation: number; // 0-90 degrees (0 = horizon, 90 = zenith)
  distance?: number; // km from Bermuda (if known)
  visible: boolean;
}

interface DeviceOrientation {
  alpha: number; // compass heading
  beta: number; // front-to-back tilt
  gamma: number; // left-to-right tilt
}

const SkyTracker: React.FC<SkyTrackerProps> = ({
  launch,
  currentPhase,
  showCompass = true,
  showStars = false,
  size = 300
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientation | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [rocketPosition, setRocketPosition] = useState<SkyPosition | null>(null);

  // Request device orientation permission (iOS 13+)
  const requestOrientationPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionGranted(permission === 'granted');
      } catch (error) {
        console.warn('[SkyTracker] Orientation permission denied:', error);
        setPermissionGranted(false);
      }
    } else {
      // Android or older iOS
      setPermissionGranted(true);
    }
  }, []);

  // Calculate rocket position in sky
  const calculateRocketPosition = useCallback((): SkyPosition => {
    // Get bearing and elevation from launch visibility data
    const bearing = launch.visibility.bearing || 225; // Default southwest
    
    // Calculate elevation based on launch phase and time
    let elevation = 0;
    let visible = false;
    
    if (currentPhase) {
      const timeFromLaunch = currentPhase.timeFromLaunch || -1000;
      
      if (timeFromLaunch >= 0 && timeFromLaunch <= 720) { // 0-12 minutes post-launch
        visible = true;
        
        // Simulate rocket trajectory elevation
        if (timeFromLaunch < 60) {
          // First minute: rise from horizon
          elevation = Math.min(15, timeFromLaunch / 4);
        } else if (timeFromLaunch < 300) {
          // 1-5 minutes: climb to peak
          elevation = 15 + ((timeFromLaunch - 60) / 240) * 35;
        } else if (timeFromLaunch < 540) {
          // 5-9 minutes: peak visibility
          elevation = 50 + Math.sin((timeFromLaunch - 300) / 240 * Math.PI) * 15;
        } else {
          // 9-12 minutes: fade away
          elevation = Math.max(10, 65 - ((timeFromLaunch - 540) / 180) * 55);
        }
      } else if (timeFromLaunch >= -300 && timeFromLaunch < 0) {
        // Pre-launch: show expected position at horizon
        elevation = 0;
        visible = false;
      }
    }
    
    return {
      azimuth: bearing,
      elevation: Math.max(0, Math.min(90, elevation)),
      visible
    };
  }, [launch.visibility.bearing, currentPhase]);

  // Update rocket position
  useEffect(() => {
    const newPosition = calculateRocketPosition();
    setRocketPosition(newPosition);
  }, [calculateRocketPosition]);

  // Device orientation listener
  useEffect(() => {
    if (!permissionGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        setDeviceOrientation({
          alpha: event.alpha, // compass
          beta: event.beta,   // tilt forward/back
          gamma: event.gamma  // tilt left/right
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [permissionGranted]);

  // Draw sky map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rocketPosition) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 20;

    // Clear canvas
    ctx.fillStyle = '#0f172a'; // Very dark blue for night sky
    ctx.fillRect(0, 0, size, size);

    // Draw concentric circles for elevation
    const elevationCircles = [90, 60, 30, 0]; // degrees
    elevationCircles.forEach((elev, index) => {
      const circleRadius = radius * (1 - elev / 90);
      ctx.strokeStyle = index === elevationCircles.length - 1 ? '#475569' : '#334155'; // Horizon line darker
      ctx.lineWidth = index === elevationCircles.length - 1 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Elevation labels
      if (elev > 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${elev}°`, centerX, centerY - circleRadius + 12);
      }
    });

    // Draw cardinal directions
    const directions = [
      { label: 'N', angle: 0, color: '#ef4444' },   // Red for North
      { label: 'E', angle: 90, color: '#f97316' },  // Orange for East
      { label: 'S', angle: 180, color: '#eab308' }, // Yellow for South
      { label: 'W', angle: 270, color: '#22c55e' }  // Green for West
    ];

    directions.forEach(({ label, angle, color }) => {
      const rad = (angle - 90) * Math.PI / 180; // Adjust for canvas orientation
      const x = centerX + Math.cos(rad) * (radius + 10);
      const y = centerY + Math.sin(rad) * (radius + 10);

      ctx.fillStyle = color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
    });

    // Draw device orientation indicator (if available)
    if (deviceOrientation && showCompass) {
      const deviceRad = (deviceOrientation.alpha - 90) * Math.PI / 180;
      const indicatorRadius = radius - 15;
      
      ctx.strokeStyle = '#06b6d4'; // Cyan for device indicator
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(deviceRad) * indicatorRadius,
        centerY + Math.sin(deviceRad) * indicatorRadius
      );
      ctx.stroke();

      // Device direction label
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('📱', centerX + Math.cos(deviceRad) * (indicatorRadius + 15), centerY + Math.sin(deviceRad) * (indicatorRadius + 15));
    }

    // Draw stars (simplified)
    if (showStars) {
      const stars = [
        { name: 'Polaris', az: 0, el: 32.3 },
        { name: 'Vega', az: 280, el: 60 },
        { name: 'Altair', az: 250, el: 45 },
        { name: 'Arcturus', az: 225, el: 50 }
      ];

      stars.forEach(star => {
        const starRad = (star.az - 90) * Math.PI / 180;
        const starRadius = radius * (1 - star.el / 90);
        const x = centerX + Math.cos(starRad) * starRadius;
        const y = centerY + Math.sin(starRad) * starRadius;

        ctx.fillStyle = '#fbbf24'; // Yellow stars
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw rocket position
    const rocketRad = (rocketPosition.azimuth - 90) * Math.PI / 180;
    const rocketRadius = radius * (1 - rocketPosition.elevation / 90);
    const rocketX = centerX + Math.cos(rocketRad) * rocketRadius;
    const rocketY = centerY + Math.sin(rocketRad) * rocketRadius;

    // Rocket indicator
    ctx.fillStyle = rocketPosition.visible ? '#22c55e' : '#ef4444'; // Green if visible, red if not
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Draw pulsing circle for rocket
    const pulseRadius = 8 + Math.sin(Date.now() / 200) * 3;
    ctx.beginPath();
    ctx.arc(rocketX, rocketY, pulseRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Rocket icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', rocketX, rocketY);

    // Draw visibility cone (if rocket is visible)
    if (rocketPosition.visible) {
      ctx.strokeStyle = '#22c55e33'; // Semi-transparent green
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      const coneSpread = 15; // degrees
      for (let offset = -coneSpread; offset <= coneSpread; offset += 5) {
        const coneRad = ((rocketPosition.azimuth + offset) - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + Math.cos(coneRad) * radius,
          centerY + Math.sin(coneRad) * radius
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Position info text
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Az: ${rocketPosition.azimuth.toFixed(0)}°`, 10, size - 40);
    ctx.fillText(`El: ${rocketPosition.elevation.toFixed(0)}°`, 10, size - 25);
    ctx.fillText(rocketPosition.visible ? '✅ Visible' : '❌ Not visible', 10, size - 10);

  }, [size, rocketPosition, deviceOrientation, showCompass, showStars]);

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Sky Map Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="border border-gray-600 rounded-full bg-gradient-radial from-blue-900 to-black"
          style={{ 
            background: 'radial-gradient(circle, #1e40af 0%, #0f172a 100%)'
          }}
        />
        
        {/* Center dot for reference */}
        <div 
          className="absolute bg-white rounded-full border border-gray-400"
          style={{
            width: '6px',
            height: '6px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        {!permissionGranted && (
          <button
            onClick={requestOrientationPermission}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            📱 Enable Compass
          </button>
        )}
        
        <button
          onClick={() => showStars}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            showStars 
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          ⭐ Stars
        </button>
      </div>

      {/* Viewing Instructions */}
      {rocketPosition && (
        <div className="text-center max-w-sm">
          <div className={`text-lg font-semibold ${rocketPosition.visible ? 'text-green-500' : 'text-orange-500'}`}>
            {rocketPosition.visible ? '👁️ Look Up!' : '⏳ Get Ready'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Face {getCompassDirection(rocketPosition.azimuth)} and look{' '}
            {rocketPosition.elevation === 0 ? 'at the horizon' : `${rocketPosition.elevation.toFixed(0)}° above horizon`}
          </div>
          
          {permissionGranted && deviceOrientation && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Turn {getDeviceDirectionHint(deviceOrientation.alpha, rocketPosition.azimuth)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to convert azimuth to compass direction
function getCompassDirection(azimuth: number): string {
  const directions = [
    'North', 'NNE', 'NE', 'ENE', 'East', 'ESE', 'SE', 'SSE',
    'South', 'SSW', 'SW', 'WSW', 'West', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(azimuth / 22.5) % 16;
  return directions[index];
}

// Helper function to give device rotation hints
function getDeviceDirectionHint(deviceHeading: number, targetAzimuth: number): string {
  const diff = ((targetAzimuth - deviceHeading + 540) % 360) - 180;
  
  if (Math.abs(diff) < 15) {
    return 'Perfect! 🎯';
  } else if (diff > 0) {
    return `Turn right ${Math.abs(diff).toFixed(0)}° ↻`;
  } else {
    return `Turn left ${Math.abs(diff).toFixed(0)}° ↺`;
  }
}

export default SkyTracker;