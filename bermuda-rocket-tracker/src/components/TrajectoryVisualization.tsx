/**
 * Trajectory Visualization Component
 * Shows rocket trajectory paths for high-visibility launches
 */

import React, { useState, useEffect, useRef } from 'react';
import { LaunchWithVisibility } from '../types';

interface TrajectoryPoint {
  time: number; // seconds after liftoff
  latitude: number;
  longitude: number;
  altitude: number; // meters
  visible?: boolean; // visible from Bermuda at this point
}

interface TrajectoryVisualizationProps {
  launch: LaunchWithVisibility;
  onClose?: () => void;
  className?: string;
}

// Bermuda coordinates for reference
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

const TrajectoryVisualization: React.FC<TrajectoryVisualizationProps> = ({
  launch,
  onClose,
  className = ''
}) => {
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryPoint[]>([]);
  const [currentTime, setCurrentTime] = useState(0); // Now represents seconds, not array index
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    generateTrajectoryData();
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch]);

  // Handle animation state changes
  useEffect(() => {
    if (isPlaying && trajectoryData.length > 0) {
      // Start continuous animation
      animationRef.current = setInterval(animate, 100); // 100ms = 10 fps
    } else {
      // Stop animation
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = undefined;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, trajectoryData.length]);

  useEffect(() => {
    if (trajectoryData.length > 0) {
      drawTrajectory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectoryData, currentTime]);

  /**
   * Generate trajectory data based on launch parameters
   */
  const generateTrajectoryData = async () => {
    setLoading(true);
    setError(null);

    try {
      // For demo purposes, generate trajectory based on orbit type
      const points = generateTrajectoryForOrbit(launch.mission.orbit?.name || 'LEO');
      setTrajectoryData(points);
    } catch (err) {
      setError('Failed to generate trajectory data');
      console.error('Trajectory generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate trajectory points based on orbit type
   */
  const generateTrajectoryForOrbit = (orbitType: string): TrajectoryPoint[] => {
    const points: TrajectoryPoint[] = [];
    const padLat = 28.6; // Approximate Cape Canaveral latitude
    const padLng = -80.6; // Approximate Cape Canaveral longitude

    // Different trajectory patterns based on orbit type and mission
    const trajectoryConfig = getTrajectoryConfig(orbitType, launch.mission.name);
    
    // Generate trajectory points every 10 seconds 
    for (let t = 0; t <= trajectoryConfig.duration; t += 10) {
      const progress = t / trajectoryConfig.duration;
      
      // Calculate position based on trajectory type
      const lat = padLat + (trajectoryConfig.latDelta * progress) + 
                   (trajectoryConfig.latCurve * Math.sin(progress * Math.PI));
      const lng = padLng + (trajectoryConfig.lngDelta * progress) + 
                   (trajectoryConfig.lngCurve * Math.cos(progress * Math.PI));
      const alt = trajectoryConfig.maxAltitude * Math.sin(progress * Math.PI * 0.8);
      
      // Determine visibility from Bermuda
      const visible = isVisibleFromBermuda(lat, lng, alt);
      
      points.push({
        time: t,
        latitude: lat,
        longitude: lng,
        altitude: alt,
        visible
      });
    }

    return points;
  };

  /**
   * Get trajectory configuration based on orbit type and actual launch azimuth
   */
  const getTrajectoryConfig = (orbitType: string, missionName: string) => {
    const type = orbitType.toLowerCase();
    const mission = missionName.toLowerCase();
    
    // Import trajectory mapping service for accurate azimuth
    const { getTrajectoryMapping } = require('../services/trajectoryMappingService');
    const trajectoryMapping = getTrajectoryMapping(launch);
    const azimuth = trajectoryMapping.azimuth;
    
    // Calculate trajectory parameters based on actual azimuth
    // Azimuth determines the direction: 45° = NE, 90° = E, 135° = SE
    const azimuthRad = azimuth * Math.PI / 180;
    
    // Calculate lat/lng deltas based on azimuth
    // Southeast trajectories (120-150°) go negative in latitude (south)
    // Northeast trajectories (30-60°) go positive in latitude (north)
    const latDelta = Math.cos(azimuthRad) * 10; // Use proper navigation coordinates (0°=North)
    const lngDelta = Math.sin(azimuthRad) * 15; // Positive sin for eastern component
    
    if (type.includes('gto') || type.includes('geo')) {
      return {
        duration: 600, // 10 minutes
        latDelta: latDelta * 0.5, // GTO missions have less latitude change
        lngDelta: lngDelta * 1.2, // More eastward movement
        latCurve: Math.abs(latDelta) * 0.1,
        lngCurve: -2,
        maxAltitude: 200000 // 200 km
      };
    } else if (type.includes('leo')) {
      return {
        duration: 480, // 8 minutes
        latDelta: latDelta,
        lngDelta: lngDelta * 0.8,
        latCurve: 1,
        lngCurve: -2,
        maxAltitude: 150000 // 150 km
      };
    } else if (type.includes('sso') || type.includes('polar')) {
      return {
        duration: 540, // 9 minutes
        latDelta: latDelta * 1.5, // More north/south movement for polar
        lngDelta: lngDelta * 0.5, // Less east/west for polar
        latCurve: 0.5,
        lngCurve: -1,
        maxAltitude: 180000 // 180 km
      };
    } else {
      // Default trajectory based on calculated azimuth
      return {
        duration: 480,
        latDelta: latDelta * 0.7,
        lngDelta: lngDelta * 0.9,
        latCurve: 1.5,
        lngCurve: -2.5,
        maxAltitude: 175000
      };
    }
  };

  /**
   * Check if a point is visible from Bermuda
   */
  const isVisibleFromBermuda = (lat: number, lng: number, alt: number): boolean => {
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
    const horizonDistance = calculateHorizonDistance(alt);
    
    // Simplified visibility check
    return distance <= horizonDistance && alt > 50000; // Above 50km
  };

  /**
   * Calculate distance between two points
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Calculate horizon distance at given altitude
   */
  const calculateHorizonDistance = (altitude: number): number => {
    const R = 6371000; // Earth radius in meters
    return Math.sqrt(2 * R * altitude + altitude * altitude);
  };

  /**
   * Draw trajectory on canvas
   */
  const drawTrajectory = () => {
    const canvas = canvasRef.current;
    if (!canvas || trajectoryData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up coordinate system with more padding for axis labels
    const bounds = getTrajectoryBounds();
    const leftPadding = 60;  // More space for latitude labels
    const rightPadding = 20;
    const topPadding = 20;
    const bottomPadding = 80; // More space for longitude labels, axis title, and legend separation
    const width = canvas.width - leftPadding - rightPadding;
    const height = canvas.height - topPadding - bottomPadding;

    // Draw background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, bounds, leftPadding, topPadding, width, height);

    // Draw coastlines (US East Coast)
    drawCoastlines(ctx, bounds, leftPadding, topPadding, width, height);

    // Draw Bermuda
    drawBermuda(ctx, bounds, leftPadding, topPadding, width, height);

    // Draw trajectory path
    drawTrajectoryPath(ctx, bounds, leftPadding, topPadding, width, height);

    // Draw rocket position - convert time to array index
    const timeIndex = Math.floor(currentTime / 10); // Convert seconds to 10-second intervals
    if (timeIndex >= 0 && timeIndex < trajectoryData.length && trajectoryData[timeIndex]) {
      drawRocket(ctx, bounds, leftPadding, topPadding, width, height, timeIndex);
    }

    // Draw visibility indicators
    drawVisibilityIndicators(ctx, bounds, leftPadding, topPadding, width, height);
  };

  /**
   * Get trajectory bounds for scaling
   */
  const getTrajectoryBounds = () => {
    const lats = trajectoryData.map(p => p.latitude);
    const lngs = trajectoryData.map(p => p.longitude);
    
    return {
      minLat: Math.min(...lats, BERMUDA_LAT) - 1,
      maxLat: Math.max(...lats, BERMUDA_LAT) + 1,
      minLng: Math.min(...lngs, BERMUDA_LNG) - 1,
      maxLng: Math.max(...lngs, BERMUDA_LNG) + 1
    };
  };

  /**
   * Convert geographic coordinates to canvas coordinates
   */
  const geoToCanvas = (lat: number, lng: number, bounds: any, leftPadding: number, topPadding: number, width: number, height: number) => {
    const x = leftPadding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
    const y = topPadding + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
    return { x, y };
  };

  /**
   * Draw coordinate grid with labels
   */
  const drawGrid = (ctx: CanvasRenderingContext2D, bounds: any, leftPadding: number, topPadding: number, width: number, height: number) => {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px Arial';

    // Draw latitude lines (horizontal) with labels
    for (let lat = Math.ceil(bounds.minLat); lat <= bounds.maxLat; lat++) {
      const { y } = geoToCanvas(lat, bounds.minLng, bounds, leftPadding, topPadding, width, height);
      
      // Draw grid line
      ctx.strokeStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(leftPadding + width, y);
      ctx.stroke();
      
      // Add latitude label on left side
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`${lat}°N`, leftPadding - 5, y + 3);
    }

    // Draw longitude lines (vertical) with labels - every 5 degrees for clarity
    for (let lng = Math.ceil(bounds.minLng / 5) * 5; lng <= bounds.maxLng; lng += 5) {
      const { x } = geoToCanvas(bounds.minLat, lng, bounds, leftPadding, topPadding, width, height);
      
      // Draw grid line
      ctx.strokeStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(x, topPadding);
      ctx.lineTo(x, topPadding + height);
      ctx.stroke();
      
      // Add longitude label at bottom
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.abs(lng)}°W`, x, topPadding + height + 15);
    }

    // Draw axis labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X-axis label (Longitude)
    ctx.fillText('Longitude (degrees West)', leftPadding + width / 2, topPadding + height + 35);
    
    // Y-axis label (Latitude) - rotated
    ctx.save();
    ctx.translate(15, topPadding + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Latitude (degrees North)', 0, 0);
    ctx.restore();
  };

  /**
   * Draw US East Coast coastlines
   */
  const drawCoastlines = (ctx: CanvasRenderingContext2D, bounds: any, leftPadding: number, topPadding: number, width: number, height: number) => {
    ctx.strokeStyle = '#fbbf24'; // Light yellow color for coastlines
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)'; // Semi-transparent yellow fill for land masses

    // US East Coast - Major outline points from Maine to Florida
    const eastCoastPoints = [
      // Maine
      { lat: 44.3, lng: -69.8 },
      { lat: 43.7, lng: -69.2 },
      // New Hampshire/Massachusetts  
      { lat: 42.8, lng: -70.8 },
      { lat: 42.3, lng: -71.1 }, // Boston area
      { lat: 41.5, lng: -71.3 },
      // Rhode Island/Connecticut
      { lat: 41.2, lng: -72.9 },
      { lat: 40.8, lng: -73.9 }, // New York area
      // New Jersey
      { lat: 40.0, lng: -74.2 },
      { lat: 39.5, lng: -74.6 },
      // Delaware/Maryland
      { lat: 38.8, lng: -75.2 },
      { lat: 37.8, lng: -75.7 },
      // Virginia
      { lat: 37.0, lng: -75.8 },
      { lat: 36.2, lng: -75.7 },
      // North Carolina - Outer Banks
      { lat: 35.8, lng: -75.5 },
      { lat: 35.2, lng: -75.6 },
      { lat: 34.7, lng: -76.7 },
      // South Carolina
      { lat: 33.7, lng: -78.9 },
      { lat: 32.8, lng: -79.9 },
      // Georgia/Florida
      { lat: 31.5, lng: -81.1 },
      { lat: 30.4, lng: -81.4 },
      { lat: 29.7, lng: -81.2 }, // St. Augustine
      { lat: 28.5, lng: -80.8 }, // Cape Canaveral area
      { lat: 27.8, lng: -80.5 },
      { lat: 26.7, lng: -80.0 }, // Palm Beach
      { lat: 25.8, lng: -80.2 }, // Miami area
      { lat: 25.1, lng: -80.4 }, // Florida Keys start
    ];

    // Florida Keys and Gulf Coast transition
    const floridaKeysPoints = [
      { lat: 25.1, lng: -80.4 },
      { lat: 24.7, lng: -80.9 },
      { lat: 24.5, lng: -81.4 },
      { lat: 24.6, lng: -81.9 }, // Key West area
    ];

    // Caribbean Islands - Major islands visible in trajectory area
    const caribbeanIslands = [
      // Bahamas
      [
        { lat: 25.0, lng: -77.4 }, // Nassau area
        { lat: 24.2, lng: -76.4 },
        { lat: 23.1, lng: -75.8 },
        { lat: 22.5, lng: -74.3 },
      ],
      // Cuba (northern coast)
      [
        { lat: 23.1, lng: -82.4 }, // Havana area
        { lat: 23.2, lng: -81.0 },
        { lat: 23.1, lng: -79.5 },
        { lat: 22.4, lng: -78.3 },
        { lat: 21.9, lng: -77.8 },
        { lat: 20.9, lng: -76.8 },
        { lat: 20.2, lng: -74.5 }, // Eastern tip
      ],
      // Jamaica
      [
        { lat: 18.5, lng: -78.4 },
        { lat: 18.2, lng: -77.4 },
        { lat: 17.9, lng: -76.8 },
        { lat: 18.0, lng: -76.2 },
      ],
      // Hispaniola (Haiti/Dominican Republic)
      [
        { lat: 19.9, lng: -74.0 },
        { lat: 19.8, lng: -72.0 },
        { lat: 18.6, lng: -71.6 },
        { lat: 18.0, lng: -71.0 },
        { lat: 17.6, lng: -71.8 },
        { lat: 18.4, lng: -74.5 },
      ],
      // Puerto Rico
      [
        { lat: 18.5, lng: -67.1 },
        { lat: 18.2, lng: -65.6 },
        { lat: 17.9, lng: -65.2 },
        { lat: 18.0, lng: -67.3 },
      ],
    ];

    // Draw US East Coast
    drawCoastlinePath(ctx, eastCoastPoints, bounds, leftPadding, topPadding, width, height, false);
    
    // Draw Florida Keys
    drawCoastlinePath(ctx, floridaKeysPoints, bounds, leftPadding, topPadding, width, height, false);

    // Draw Caribbean islands
    caribbeanIslands.forEach(island => {
      drawCoastlinePath(ctx, island, bounds, leftPadding, topPadding, width, height, true);
    });
  };

  /**
   * Helper function to draw a coastline path
   */
  const drawCoastlinePath = (
    ctx: CanvasRenderingContext2D, 
    points: {lat: number, lng: number}[], 
    bounds: any, 
    leftPadding: number, 
    topPadding: number, 
    width: number, 
    height: number,
    closed: boolean = false
  ) => {
    if (points.length < 2) return;

    // Filter points that are within the visible bounds
    const visiblePoints = points.filter(point => 
      point.lat >= bounds.minLat - 1 && 
      point.lat <= bounds.maxLat + 1 && 
      point.lng >= bounds.minLng - 1 && 
      point.lng <= bounds.maxLng + 1
    );

    if (visiblePoints.length < 2) return;

    ctx.beginPath();
    
    // Move to first point
    const firstPoint = geoToCanvas(visiblePoints[0].lat, visiblePoints[0].lng, bounds, leftPadding, topPadding, width, height);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    // Draw lines to subsequent points
    for (let i = 1; i < visiblePoints.length; i++) {
      const point = geoToCanvas(visiblePoints[i].lat, visiblePoints[i].lng, bounds, leftPadding, topPadding, width, height);
      ctx.lineTo(point.x, point.y);
    }
    
    // Close path for islands
    if (closed) {
      ctx.closePath();
      // Fill islands with semi-transparent color
      ctx.save();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.fill();
      ctx.restore();
    }
    
    // Stroke the outline
    ctx.stroke();
  };

  /**
   * Draw Bermuda location
   */
  const drawBermuda = (ctx: CanvasRenderingContext2D, bounds: any, leftPadding: number, topPadding: number, width: number, height: number) => {
    const { x, y } = geoToCanvas(BERMUDA_LAT, BERMUDA_LNG, bounds, leftPadding, topPadding, width, height);
    
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('Bermuda', x + 10, y - 10);
  };

  /**
   * Draw trajectory path
   */
  const drawTrajectoryPath = (ctx: CanvasRenderingContext2D, bounds: any, leftPadding: number, topPadding: number, width: number, height: number) => {
    if (trajectoryData.length < 2) return;

    ctx.lineWidth = 2;
    
    for (let i = 0; i < trajectoryData.length - 1; i++) {
      const point = trajectoryData[i];
      const nextPoint = trajectoryData[i + 1];
      
      const { x, y } = geoToCanvas(point.latitude, point.longitude, bounds, leftPadding, topPadding, width, height);
      const { x: nextX, y: nextY } = geoToCanvas(nextPoint.latitude, nextPoint.longitude, bounds, leftPadding, topPadding, width, height);
      
      // Color based on visibility
      ctx.strokeStyle = point.visible ? '#10b981' : '#ef4444';
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();
    }
  };

  /**
   * Draw rocket position
   */
  const drawRocket = (ctx: CanvasRenderingContext2D, bounds: any, leftPadding: number, topPadding: number, width: number, height: number, timeIndex: number) => {
    const point = trajectoryData[timeIndex];
    if (!point) return;

    const { x, y } = geoToCanvas(point.latitude, point.longitude, bounds, leftPadding, topPadding, width, height);
    
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw rocket icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🚀', x, y + 5);
    
    // Show altitude and time
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`T+${Math.floor(point.time / 60)}:${(point.time % 60).toString().padStart(2, '0')}`, x + 15, y - 10);
    ctx.fillText(`${Math.floor(point.altitude / 1000)}km`, x + 15, y + 5);
  };

  /**
   * Draw visibility indicators
   */
  const drawVisibilityIndicators = (ctx: CanvasRenderingContext2D, bounds: any, leftPadding: number, topPadding: number, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Draw legend with more separation from axis
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('Legend:', 10, canvas.height - 85);
    
    // Trajectory visibility legend
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, canvas.height - 70);
    ctx.lineTo(30, canvas.height - 70);
    ctx.stroke();
    ctx.fillText('Visible from Bermuda', 35, canvas.height - 65);
    
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(10, canvas.height - 50);
    ctx.lineTo(30, canvas.height - 50);
    ctx.stroke();
    ctx.fillText('Not visible from Bermuda', 35, canvas.height - 45);
    
    // Coastline legend
    ctx.strokeStyle = '#fbbf24'; // Match actual coastline color (light yellow)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, canvas.height - 30);
    ctx.lineTo(30, canvas.height - 30);
    ctx.stroke();
    ctx.fillText('US East Coast', 35, canvas.height - 25);
    
    // Bermuda marker legend
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(20, canvas.height - 15, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Bermuda', 35, canvas.height - 10);
  };

  /**
   * Animation loop - Simplified without internal scheduling
   */
  const animate = () => {
    setCurrentTime(prev => {
      const nextTime = prev + 1; // Increment by 1 second
      const maxTime = trajectoryData.length > 0 ? trajectoryData[trajectoryData.length - 1].time : 0;
      
      if (nextTime > maxTime) {
        // Reached the end, stop animation
        setIsPlaying(false);
        return maxTime;
      }
      
      return nextTime;
    });
  };

  /**
   * Start/stop animation - Simplified implementation
   */
  const toggleAnimation = () => {
    if (!isPlaying) {
      // Reset to beginning if at the end
      const maxTime = trajectoryData.length > 0 ? trajectoryData[trajectoryData.length - 1].time : 0;
      if (currentTime >= maxTime) {
        setCurrentTime(0);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  /**
   * Reset animation - Simplified implementation
   */
  const resetAnimation = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `T+${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Generating trajectory...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Trajectory Unavailable
          </h3>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            🚀 Trajectory Visualization
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {launch.name} - {launch.mission.orbit?.name} trajectory
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            ×
          </button>
        )}
      </div>


      {/* Trajectory Content */}
          {/* Explanation */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              What you're looking at:
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              This map shows the rocket's path from Cape Canaveral, Florida to its target orbit. 
              <span className="font-medium"> Green sections</span> indicate when the rocket is visible from Bermuda (above the horizon), 
              while <span className="font-medium"> red sections</span> show when it's not visible (below horizon or too far away). 
              The <span className="font-medium"> green dot</span> marks Bermuda's location, and the 
              <span className="font-medium"> 🚀 rocket icon</span> shows the current position during playback.
              The <span className="font-medium"> "Best View"</span> point marks when the rocket is closest to Bermuda and easiest to spot.
            </p>
          </div>

          {/* Canvas */}
          <div className="p-4">
            <canvas
              ref={canvasRef}
              width={700}
              height={450}
              className="border border-gray-300 dark:border-gray-600 rounded bg-gray-900"
            />
          </div>
      {/* Controls */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleAnimation}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              {isPlaying ? '⏸️ Pause Animation' : '▶️ Play Flight Path'}
            </button>
            <button
              onClick={resetAnimation}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              🔄 Reset to Launch
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Flight Time: {formatTime(currentTime)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {isPlaying ? 'Playing...' : 'Paused'}
            </div>
          </div>
        </div>

        {/* Timeline scrubber */}
        <div className="w-full">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">
            🎯 Drag to jump to any point in the flight • Green sections = Visible from Bermuda
          </div>
          <input
            type="range"
            min={0}
            max={trajectoryData.length > 0 ? trajectoryData[trajectoryData.length - 1].time : 0}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseInt(e.target.value))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            title="Flight timeline - drag to jump to any point"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>🚀 T+0:00 Liftoff</span>
            <span>👁️ Best View (Closest)</span>
            <span>🌌 T+{Math.floor((trajectoryData[trajectoryData.length - 1]?.time || 0) / 60)}:00 End</span>
          </div>
        </div>

        {/* Stats */}
        {(() => {
          const dataIndex = Math.floor(currentTime / 10); // Convert seconds to array index
          const currentPoint = trajectoryData[dataIndex];
          return currentPoint ? (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400">Time</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {formatTime(currentPoint.time)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Altitude</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {Math.floor(currentPoint.altitude / 1000)}km
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Visibility</div>
                <div className={`font-semibold ${currentPoint.visible ? 'text-green-600' : 'text-red-600'}`}>
                  {currentPoint.visible ? 'Visible' : 'Not Visible'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Distance</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {Math.floor(calculateDistance(
                    BERMUDA_LAT, BERMUDA_LNG,
                    currentPoint.latitude, currentPoint.longitude
                  ) / 1000)}km
                </div>
              </div>
            </div>
          ) : null;
        })()}
        
        {/* Debug info */}
        <div className="mt-2 text-xs text-gray-400">
          Debug: Time {currentTime}s → Array index {Math.floor(currentTime / 10)} of {trajectoryData.length} points 
          {(() => {
            const dataIndex = Math.floor(currentTime / 10);
            const point = trajectoryData[dataIndex];
            return point ? ` (Data at T+${Math.floor(point.time / 60)}:${(point.time % 60).toString().padStart(2, '0')})` : ' (No data)';
          })()}
        </div>
        </div>
    </div>
  );
};

export default TrajectoryVisualization;