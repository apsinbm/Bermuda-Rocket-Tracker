import React, { useRef, useEffect, useState } from 'react';
import { LaunchWithVisibility } from '../types';
import { TrajectoryData } from '../services/trajectoryService';
import { calculateBearing, calculateDistance, GeoPoint } from '../utils/coordinateUtils';

interface InteractiveSkyMapProps {
  launch: LaunchWithVisibility;
  trajectoryData?: TrajectoryData;
  onClose: () => void;
}

interface StarData {
  name: string;
  azimuth: number;
  elevation: number;
  magnitude: number;
  constellation: string;
}

interface CompassDirection {
  label: string;
  angle: number;
  shortLabel: string;
}

const InteractiveSkyMap: React.FC<InteractiveSkyMapProps> = ({ launch, trajectoryData, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<number | null>(null);
  const [showCompass, setShowCompass] = useState(false);

  // Calculate real-time star positions for current date and launch time
  const getRealTimeStarPositions = (launchDate: Date): StarData[] => {
    // This would normally use astronomical calculations, but for now we'll adjust based on season
    const month = launchDate.getMonth();
    const hour = launchDate.getHours();
    
    // Base positions with seasonal adjustments
    const baseStars: StarData[] = [
      { name: 'Polaris', azimuth: 0, elevation: 32.3, magnitude: 2.0, constellation: 'Ursa Minor' }, // Always at latitude elevation
      { name: 'Vega', azimuth: 280 + (month * 15) % 360, elevation: 60 - (month * 3) % 40 + 20, magnitude: 0.0, constellation: 'Lyra' },
      { name: 'Altair', azimuth: 250 + (month * 12) % 360, elevation: 45 - (month * 2) % 30 + 20, magnitude: 0.8, constellation: 'Aquila' },
      { name: 'Deneb', azimuth: 320 + (month * 10) % 360, elevation: 75 - (month * 2) % 25 + 15, magnitude: 1.3, constellation: 'Cygnus' },
      { name: 'Arcturus', azimuth: 225 + (month * 20) % 360, elevation: 40 + (month * 3) % 35 + 10, magnitude: -0.1, constellation: 'Boötes' },
      { name: 'Sirius', azimuth: 180 + (month * 25) % 360, elevation: Math.max(5, 25 - Math.abs(month - 6) * 3), magnitude: -1.5, constellation: 'Canis Major' },
      { name: 'Betelgeuse', azimuth: 210 + (month * 18) % 360, elevation: Math.max(10, 35 - Math.abs(month - 12) * 2), magnitude: 0.5, constellation: 'Orion' },
      { name: 'Rigel', azimuth: 200 + (month * 18) % 360, elevation: Math.max(8, 30 - Math.abs(month - 12) * 2), magnitude: 0.1, constellation: 'Orion' }
    ];
    
    // Adjust for time of night (rough rotation)
    const timeAdjustment = (hour - 20) * 15; // 15 degrees per hour after 8 PM
    return baseStars.map(star => ({
      ...star,
      azimuth: (star.azimuth + timeAdjustment + 360) % 360,
      elevation: Math.max(5, star.elevation) // Ensure stars don't go below horizon
    }));
  };

  const referenceStars = getRealTimeStarPositions(new Date(launch.net));

  // Constants for accurate Bermuda coordinates
  const BERMUDA_COORDINATES = { lat: 32.3078, lng: -64.7505 };

  // Validation function to ensure zenith accuracy
  const validateZenithReference = (): boolean => {
    // Zenith should always be at center of sky map (directly overhead at Bermuda)
    // This represents 90° elevation at Bermuda's exact coordinates
    return userLocation ? 
      Math.abs(userLocation.lat - BERMUDA_COORDINATES.lat) < 0.1 &&
      Math.abs(userLocation.lng - BERMUDA_COORDINATES.lng) < 0.1
      : true; // Default to true if location not available
  };

  const compassDirections: CompassDirection[] = [
    { label: 'North', angle: 0, shortLabel: 'N' },
    { label: 'Northeast', angle: 45, shortLabel: 'NE' },
    { label: 'East', angle: 90, shortLabel: 'E' },
    { label: 'Southeast', angle: 135, shortLabel: 'SE' },
    { label: 'South', angle: 180, shortLabel: 'S' },
    { label: 'Southwest', angle: 225, shortLabel: 'SW' },
    { label: 'West', angle: 270, shortLabel: 'W' },
    { label: 'Northwest', angle: 315, shortLabel: 'NW' }
  ];

  useEffect(() => {
    // Request geolocation for more accurate star positions
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          // Fallback to exact Bermuda coordinates for consistent zenith reference
          setUserLocation(BERMUDA_COORDINATES);
        }
      );
    } else {
      setUserLocation(BERMUDA_COORDINATES);
    }

    // Request device orientation for compass functionality
    if ('DeviceOrientationEvent' in window) {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          setDeviceOrientation(event.alpha);
          setShowCompass(true);
        }
      };

      // Check if we need permission (iOS 13+)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission()
          .then((response: string) => {
            if (response === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
            }
          })
          .catch((error: Error) => {
          });
      } else {
        // Non-iOS devices
        window.addEventListener('deviceorientation', handleOrientation);
      }

      return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, []);

  useEffect(() => {
    if (!userLocation) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawSkyMap(ctx, canvas);
  }, [userLocation, deviceOrientation, launch, trajectoryData]);

  // Helper function to calculate launch site bearing from Bermuda
  const calculateLaunchSiteBearing = (launch: LaunchWithVisibility): number => {
    // Extract launch coordinates from the launch data
    let launchLat = 28.5618571; // Cape Canaveral default
    let launchLng = -80.577366;
    
    // Try to get more precise coordinates from launch pad data
    if (launch.pad.latitude && launch.pad.longitude) {
      launchLat = typeof launch.pad.latitude === 'string' ? 
        parseFloat(launch.pad.latitude) : launch.pad.latitude;
      launchLng = typeof launch.pad.longitude === 'string' ? 
        parseFloat(launch.pad.longitude) : launch.pad.longitude;
    } else if (launch.pad.location?.latitude && launch.pad.location?.longitude) {
      launchLat = launch.pad.location.latitude;
      launchLng = launch.pad.location.longitude;
    }
    
    // Use proper coordinate utilities for accurate bearing calculation
    const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
    const launchSite: GeoPoint = { lat: launchLat, lng: launchLng };
    
    return calculateBearing(bermuda, launchSite);
  };

  // Helper function to convert trajectory direction to bearing
  const directionToBearing = (direction: string): number => {
    const directionMap: { [key: string]: number } = {
      'North': 0,
      'Northeast': 45,
      'East-Northeast': 67.5,
      'East': 90,
      'East-Southeast': 112.5,
      'Southeast': 135,
      'South': 180,
      'Southwest': 225,
      'West': 270,
      'Northwest': 315
    };
    return directionMap[direction] || 45;
  };

  const drawSkyMap = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    // Clear canvas
    ctx.fillStyle = '#0a0a23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create gradient for sky
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, '#1a1a4a');
    gradient.addColorStop(0.5, '#0f0f35');
    gradient.addColorStop(1, '#05051a');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Draw horizon circle
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw elevation circles with height labels
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    
    const elevationRings = [
      { elevation: 30, radius: radius * 0.67, label: '30°' },
      { elevation: 60, radius: radius * 0.33, label: '60°' }
    ];
    
    elevationRings.forEach(ring => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, ring.radius, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Add elevation labels at multiple positions around the ring
      ctx.fillStyle = '#4a5568';
      ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      // Place labels at N, E, S, W positions
      const labelPositions = [0, 90, 180, 270]; // North, East, South, West
      labelPositions.forEach(angle => {
        const labelX = centerX + Math.cos((angle - 90) * Math.PI / 180) * ring.radius;
        const labelY = centerY + Math.sin((angle - 90) * Math.PI / 180) * ring.radius;
        
        // Add background for better readability
        const textWidth = ctx.measureText(ring.label).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(labelX - textWidth/2 - 2, labelY - 8, textWidth + 4, 12);
        
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(ring.label, labelX, labelY + 2);
      });
    });

    // Draw all compass directions (primary + diagonal)
    compassDirections.forEach(dir => {
      const adjustedAngle = deviceOrientation ? 
        (dir.angle - deviceOrientation + 360) % 360 : dir.angle;
      const x = centerX + Math.cos((adjustedAngle - 90) * Math.PI / 180) * (radius + 30);
      const y = centerY + Math.sin((adjustedAngle - 90) * Math.PI / 180) * (radius + 30);
      
      // Different styling for primary vs diagonal directions
      const isPrimary = ['N', 'E', 'S', 'W'].includes(dir.shortLabel);
      const circleRadius = isPrimary ? 14 : 10;
      const fontSize = isPrimary ? 'bold 14px' : '11px';
      
      ctx.font = `${fontSize} -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      
      // Add background circle for compass points
      ctx.fillStyle = isPrimary ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = isPrimary ? '#2d3748' : '#4a5568';
      ctx.lineWidth = isPrimary ? 2 : 1;
      ctx.stroke();
      
      ctx.fillStyle = '#1a202c';
      ctx.fillText(dir.shortLabel, x, y + (isPrimary ? 5 : 4));
    });

    // Draw reference stars
    referenceStars.forEach(star => {
      const adjustedAzimuth = deviceOrientation ? 
        (star.azimuth - deviceOrientation + 360) % 360 : star.azimuth;
      
      // Convert elevation to radius (90° = center, 0° = edge)
      const starRadius = radius * (1 - star.elevation / 90);
      const x = centerX + Math.cos((adjustedAzimuth - 90) * Math.PI / 180) * starRadius;
      const y = centerY + Math.sin((adjustedAzimuth - 90) * Math.PI / 180) * starRadius;
      
      // Star size based on magnitude (brighter stars are larger)
      const starSize = Math.max(1, 4 - star.magnitude);
      
      // Star color based on constellation
      ctx.fillStyle = getStarColor(star.constellation);
      ctx.beginPath();
      ctx.arc(x, y, starSize, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add star glow for bright stars
      if (star.magnitude < 1) {
        ctx.fillStyle = getStarColor(star.constellation) + '40';
        ctx.beginPath();
        ctx.arc(x, y, starSize * 2, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Add star name labels for bright stars
      if (star.magnitude < 1.5) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '9px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        
        // Position label slightly offset from star
        const labelOffset = starSize + 8;
        const labelX = x + (x > centerX ? labelOffset : -labelOffset);
        const labelY = y - labelOffset;
        
        // Add semi-transparent background for readability
        const textWidth = ctx.measureText(star.name).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(labelX - textWidth/2 - 2, labelY - 8, textWidth + 4, 12);
        
        ctx.fillStyle = '#f7fafc';
        ctx.fillText(star.name, labelX, labelY);
      }
    });

    // Draw rocket trajectory CORRECTLY - showing flight path ACROSS sky FROM launch site
    // Get trajectory information
    const { getTrajectoryMapping } = require('../services/trajectoryMappingService');
    const trajectoryMapping = getTrajectoryMapping(launch);
    const trajectoryDirection = trajectoryData?.trajectoryDirection || trajectoryMapping.direction;
    
    // Calculate launch site bearing (where rocket comes FROM)
    const launchSiteBearing = calculateLaunchSiteBearing(launch);
    
    // Calculate trajectory direction bearing (where rocket travels TO)
    const trajectoryBearing = directionToBearing(trajectoryDirection);
    
    // Adjust bearings for device orientation
    const adjustedLaunchBearing = deviceOrientation ? 
      (launchSiteBearing - deviceOrientation + 360) % 360 : launchSiteBearing;
    const adjustedTrajectoryBearing = deviceOrientation ? 
      (trajectoryBearing - deviceOrientation + 360) % 360 : trajectoryBearing;
    
    // Create trajectory path showing rocket traveling ACROSS sky
    if (trajectoryData && trajectoryData.points && trajectoryData.points.length > 0) {
      // Define Bermuda coordinates as reference point
      const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
      
      // Use real telemetry data to create accurate sky path
      const visiblePoints = trajectoryData.points.filter(point => {
        const pointGeo: GeoPoint = { lat: point.latitude, lng: point.longitude };
        const distance = calculateDistance(bermuda, pointGeo);
        
        // Improved elevation angle calculation accounting for Earth's curvature
        const altitudeKm = point.altitude / 1000;
        const earthRadius = 6371; // km
        const elevationAngle = Math.atan2(altitudeKm, distance - (altitudeKm * altitudeKm) / (2 * earthRadius)) * 180 / Math.PI;
        
        return elevationAngle > 0 && point.visible;
      });
      
      if (visiblePoints.length > 1) {
        // Convert to sky coordinates showing actual flight path
        const skyPoints = visiblePoints.map(point => {
          const pointGeo: GeoPoint = { lat: point.latitude, lng: point.longitude };
          const bearing = calculateBearing(bermuda, pointGeo);
          const distance = calculateDistance(bermuda, pointGeo);
          
          // Improved elevation angle calculation accounting for Earth's curvature
          const altitudeKm = point.altitude / 1000;
          const earthRadius = 6371; // km
          const elevationAngle = Math.atan2(altitudeKm, distance - (altitudeKm * altitudeKm) / (2 * earthRadius)) * 180 / Math.PI;
          
          const adjustedBearing = deviceOrientation ? 
            (bearing - deviceOrientation + 360) % 360 : (bearing + 360) % 360;
          
          // Convert elevation to sky dome coordinates
          // Center (radius 0) = zenith (90° elevation, directly overhead at Bermuda)
          // Edge (radius = radius) = horizon (0° elevation)
          const normalizedElevation = Math.max(0, Math.min(90, elevationAngle)) / 90;
          const skyRadius = radius * (1 - normalizedElevation);
          
          // Convert bearing to screen coordinates (0° = North = top of screen)
          const x = centerX + Math.cos((adjustedBearing - 90) * Math.PI / 180) * skyRadius;
          const y = centerY + Math.sin((adjustedBearing - 90) * Math.PI / 180) * skyRadius;
          
          return { x, y, elevation: elevationAngle, time: point.time };
        });
        
        // Draw telemetry-based path
        ctx.strokeStyle = '#f56565';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(skyPoints[0].x, skyPoints[0].y);
        
        for (let i = 1; i < skyPoints.length; i++) {
          ctx.lineTo(skyPoints[i].x, skyPoints[i].y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Rocket icon at start (closest to launch site)
        ctx.fillStyle = '#f56565';
        ctx.font = '16px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚀', skyPoints[0].x, skyPoints[0].y + 6);
        
        // Direction arrow at end
        if (skyPoints.length > 1) {
          const lastPoint = skyPoints[skyPoints.length - 1];
          const secondLastPoint = skyPoints[skyPoints.length - 2];
          const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
          
          const arrowSize = 8;
          ctx.fillStyle = '#f56565';
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(
            lastPoint.x - arrowSize * Math.cos(angle - Math.PI / 6),
            lastPoint.y - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            lastPoint.x - arrowSize * Math.cos(angle + Math.PI / 6),
            lastPoint.y - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        
        // Label showing path direction (with telemetry indicator)
        const labelText = `From Florida → ${trajectoryDirection} (Telemetry)`;
        ctx.fillStyle = '#fed7d7';
        ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        
        const labelX = skyPoints[0].x;
        const labelY = skyPoints[0].y + 25;
        const textWidth = ctx.measureText(labelText).width;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(labelX - textWidth/2 - 4, labelY - 12, textWidth + 8, 16);
        
        ctx.fillStyle = '#fed7d7';
        ctx.fillText(labelText, labelX, labelY);
      }
    } else {
      // Simple trajectory path from launch site to trajectory direction
      // Start point: Launch site bearing on horizon
      const startRadius = radius * 0.95; // Near horizon (lower elevation)
      const startX = centerX + Math.cos((adjustedLaunchBearing - 90) * Math.PI / 180) * startRadius;
      const startY = centerY + Math.sin((adjustedLaunchBearing - 90) * Math.PI / 180) * startRadius;
      
      // Calculate trajectory path across sky
      // For demonstration, create a curved path from launch site toward trajectory direction
      const maxElevation = 45; // Maximum elevation for trajectory
      const maxRadius = radius * (1 - maxElevation / 90);
      
      // Create curved path points
      const pathPoints = [];
      const numPoints = 10;
      
      for (let i = 0; i <= numPoints; i++) {
        const progress = i / numPoints;
        
        // Interpolate between launch bearing and trajectory bearing
        let currentBearing = launchSiteBearing + progress * (trajectoryBearing - launchSiteBearing);
        
        // Handle bearing wrap-around
        const bearingDiff = trajectoryBearing - launchSiteBearing;
        if (Math.abs(bearingDiff) > 180) {
          if (bearingDiff > 0) {
            currentBearing = launchSiteBearing + progress * (bearingDiff - 360);
          } else {
            currentBearing = launchSiteBearing + progress * (bearingDiff + 360);
          }
        }
        currentBearing = (currentBearing + 360) % 360;
        
        // Adjust for device orientation
        const adjustedBearing = deviceOrientation ? 
          (currentBearing - deviceOrientation + 360) % 360 : currentBearing;
        
        // Calculate elevation (parabolic arc)
        const elevation = progress * (1 - progress) * 4 * maxElevation; // Parabolic trajectory
        const currentRadius = radius * (1 - elevation / 90);
        
        const x = centerX + Math.cos((adjustedBearing - 90) * Math.PI / 180) * currentRadius;
        const y = centerY + Math.sin((adjustedBearing - 90) * Math.PI / 180) * currentRadius;
        
        pathPoints.push({ x, y });
      }
      
      // Draw trajectory path
      ctx.strokeStyle = '#f56565';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      
      for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Rocket icon at start (launch site direction)
      ctx.fillStyle = '#f56565';
      ctx.font = '16px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚀', pathPoints[0].x, pathPoints[0].y + 6);
      
      // Direction arrow at end
      if (pathPoints.length > 1) {
        const lastPoint = pathPoints[pathPoints.length - 1];
        const secondLastPoint = pathPoints[pathPoints.length - 2];
        const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
        
        const arrowSize = 8;
        ctx.fillStyle = '#f56565';
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(
          lastPoint.x - arrowSize * Math.cos(angle - Math.PI / 6),
          lastPoint.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          lastPoint.x - arrowSize * Math.cos(angle + Math.PI / 6),
          lastPoint.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
      
      // Label showing correct path direction
      const labelText = `From Florida → ${trajectoryDirection}`;
      ctx.fillStyle = '#fed7d7';
      ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      const labelX = pathPoints[0].x;
      const labelY = pathPoints[0].y + 25;
      const textWidth = ctx.measureText(labelText).width;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(labelX - textWidth/2 - 4, labelY - 12, textWidth + 8, 16);
      
      ctx.fillStyle = '#fed7d7';
      ctx.fillText(labelText, labelX, labelY);
    }

    // Draw distinctive red dot for Bermuda
    ctx.fillStyle = '#DC2626'; // Bright red color
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add thin white border for contrast against sky background
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
    ctx.stroke();

    // Add zenith label on two lines, positioned away from center dot
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    // Two-line zenith label positioned above center
    const zenithLine1 = 'Bermuda';
    const zenithLine2 = 'Zenith';
    const line1Width = ctx.measureText(zenithLine1).width;
    const line2Width = ctx.measureText(zenithLine2).width;
    const maxWidth = Math.max(line1Width, line2Width);
    
    // Position labels above the center dot to avoid blocking it
    const labelY = centerY - 25;
    
    // Add background for both lines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(centerX - maxWidth/2 - 4, labelY - 12, maxWidth + 8, 20);
    
    ctx.fillStyle = '#f7fafc';
    ctx.fillText(zenithLine1, centerX, labelY - 2);
    ctx.fillText(zenithLine2, centerX, labelY + 8);
  };

  const getStarColor = (constellation: string): string => {
    const colors: { [key: string]: string } = {
      'Ursa Minor': '#ffd700',
      'Lyra': '#87ceeb',
      'Aquila': '#ffffff',
      'Cygnus': '#e6e6fa',
      'Boötes': '#ffa500',
      'Canis Major': '#87cefa',
      'Orion': '#b0c4de'
    };
    return colors[constellation] || '#ffffff';
  };

  const requestCompassPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setShowCompass(true);
          window.location.reload(); // Reload to start orientation tracking
        } else {
          alert('Compass permission denied. Sky map will show fixed orientation.');
        }
      } catch (error) {
        console.error('Error requesting compass permission:', error);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🗺️ Interactive Sky Map - Bermuda (Zenith)
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {launch.mission.name} trajectory from Bermuda • {new Date(launch.net).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Sky Map Canvas */}
      <div className="p-6">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="w-full max-w-lg mx-auto border border-gray-300 dark:border-gray-600 rounded-lg"
            style={{ aspectRatio: '1:1' }}
          />
          
          {/* Compass status */}
          <div className="mt-4 text-center">
            {showCompass && deviceOrientation !== null ? (
              <div className="text-green-600 dark:text-green-400 text-sm">
                🧭 Compass active - map rotates with device
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  📱 Enable compass for live orientation
                </div>
                {typeof (DeviceOrientationEvent as any).requestPermission === 'function' && (
                  <button
                    onClick={requestCompassPermission}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    Enable Compass
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🚀 Launch Tracking
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Red dashed line shows rocket trajectory</li>
              <li>• Rocket icon marks launch direction</li>
              <li>• Look at bearing {launch.visibility.bearing}°</li>
              <li>• Start watching 5-6 minutes after liftoff</li>
            </ul>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              ⭐ Reference Stars
            </h3>
            <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
              <li>• Colored dots show bright reference stars</li>
              <li>• Use constellations to find launch direction</li>
              <li>• Center = directly overhead (zenith)</li>
              <li>• Edge = horizon (0° elevation)</li>
            </ul>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Map Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-red-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Rocket Path</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-gray-700 dark:text-gray-300">Reference Stars</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-gray-600"></div>
              <span className="text-gray-700 dark:text-gray-300">Elevation Rings</span>
            </div>
            <div className="flex items-center justify-center space-x-1">
              <div className="text-center">
                <div className="text-gray-700 dark:text-gray-300 text-xs mb-1">Compass Directions</div>
                <div className="grid grid-cols-5 gap-1 text-xs text-gray-600 items-center">
                  <div></div><div>NW</div><div>N</div><div>NE</div><div></div>
                  <div>W</div><div></div><div>•</div><div></div><div>E</div>
                  <div></div><div>SW</div><div>S</div><div>SE</div><div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveSkyMap;