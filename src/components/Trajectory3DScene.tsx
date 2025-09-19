/**
 * 3D Trajectory Scene Component
 * 
 * Handles Three.js scene setup, Earth rendering, trajectory paths,
 * and all 3D visualizations for rocket trajectory data.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { ProcessedSimulationData, EnhancedTelemetryFrame, StageEvent } from '../services/flightClubApiService';
import { getTelemetryFrame, getTelemetryFrameIndexAtOrAfterTime } from '../utils/telemetryUtils';
import { PlatformInfo } from '../utils/platformUtils';

interface Trajectory3DSceneProps {
  simulationData: ProcessedSimulationData;
  viewMode: string;
  playbackTime: number;
  highlightedStage?: number | null;
  showDataOverlay?: boolean;
  platform?: PlatformInfo;
}

// Earth and coordinates constants
const EARTH_RADIUS = 100; // Scaled for visualization
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;
const FLORIDA_LAT = 28.4158; // Approximate Cape Canaveral
const FLORIDA_LNG = -80.6081;

// Convert lat/lng/altitude to 3D coordinates
function latLngAltToVector3(lat: number, lng: number, alt: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (-lng) * (Math.PI / 180); // Fixed: removed +180 offset that caused east-west mirroring
  
  const radius = EARTH_RADIUS + (alt / 1000) * 0.4; // Scale altitude for visibility
  
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Cached textures for performance
let cachedEarthTexture: THREE.CanvasTexture | null = null;
let cachedAtmosphereTexture: THREE.CanvasTexture | null = null;
let texturesInitialized = false;

// Fast texture creation functions
const createSimpleEarthTexture = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = 512; // Reduced from 1024 for faster initialization
  canvas.height = 256; // Reduced from 512
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // Simple ocean base
  ctx.fillStyle = '#1a365d';
  ctx.fillRect(0, 0, 512, 256);
  
  // Simplified continents (fewer details for faster rendering)
  ctx.fillStyle = '#2d5a27';
  
  // Americas
  ctx.fillRect(75, 90, 30, 40); // North America simplified
  ctx.fillRect(100, 160, 15, 35); // South America simplified
  
  // Europe/Africa
  ctx.fillRect(250, 100, 20, 45);
  
  // Asia
  ctx.fillRect(350, 75, 40, 30);
  
  return new THREE.CanvasTexture(canvas);
};

const createDetailedEarthTexture = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // Ocean base
  ctx.fillStyle = '#1a365d';
  ctx.fillRect(0, 0, 1024, 512);
  
  // Detailed continents
  ctx.fillStyle = '#2d5a27';
  
  // North America
  ctx.beginPath();
  ctx.ellipse(150, 180, 60, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // South America
  ctx.beginPath();
  ctx.ellipse(200, 320, 30, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Europe/Africa
  ctx.beginPath();
  ctx.ellipse(500, 200, 40, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Asia
  ctx.beginPath();
  ctx.ellipse(700, 150, 80, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Atmospheric glow effect
  const gradient = ctx.createRadialGradient(512, 256, 0, 512, 256, 300);
  gradient.addColorStop(0, 'rgba(135, 206, 250, 0)');
  gradient.addColorStop(0.7, 'rgba(135, 206, 250, 0.1)');
  gradient.addColorStop(1, 'rgba(135, 206, 250, 0.3)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  
  return new THREE.CanvasTexture(canvas);
};

const createAtmosphereTexture = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  const gradient = ctx.createRadialGradient(128, 128, 50, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(135, 206, 250, 0)');
  gradient.addColorStop(0.8, 'rgba(135, 206, 250, 0.2)');
  gradient.addColorStop(1, 'rgba(135, 206, 250, 0.4)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  
  return new THREE.CanvasTexture(canvas);
};

// Progressive texture loading
const initializeTextures = async () => {
  if (texturesInitialized) return;
  
  // Create simple textures first (fast)
  cachedEarthTexture = createSimpleEarthTexture();
  cachedAtmosphereTexture = createAtmosphereTexture();
  
  texturesInitialized = true;
  
  // Upgrade to detailed texture after a short delay
  setTimeout(() => {
    const detailedTexture = createDetailedEarthTexture();
    if (detailedTexture) {
      cachedEarthTexture = detailedTexture;
    }
  }, 500); // 500ms delay for progressive loading
};

// Earth sphere component with preloaded textures
const Earth: React.FC<{ onTexturesReady?: () => void }> = ({ onTexturesReady }) => {
  const earthRef = useRef<THREE.Mesh>(null);
  const [texturesReady, setTexturesReady] = useState(false);
  
  // Initialize textures on mount
  useEffect(() => {
    const loadTextures = async () => {
      await initializeTextures();
      setTexturesReady(true);
      onTexturesReady?.();
    };
    loadTextures();
  }, [onTexturesReady]);
  
  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0005; // Very slow rotation
    }
  });

  return (
    <group>
      {/* Main Earth sphere */}
      <Sphere ref={earthRef} args={[EARTH_RADIUS, 64, 32]} position={[0, 0, 0]}>
        <meshPhongMaterial 
          map={cachedEarthTexture || undefined}
          shininess={1}
          specular={new THREE.Color(0x111111)}
          color={!cachedEarthTexture ? '#2d5a27' : undefined}
        />
      </Sphere>
      
      {/* Atmospheric glow */}
      <Sphere args={[EARTH_RADIUS * 1.02, 32, 16]} position={[0, 0, 0]}>
        <meshBasicMaterial
          map={cachedAtmosphereTexture || undefined}
          transparent
          opacity={0.6}
          side={THREE.BackSide}
          color={!cachedAtmosphereTexture ? '#87ceeb' : undefined}
        />
      </Sphere>
    </group>
  );
};

// Trajectory path component with first frame initialization
const TrajectoryPath: React.FC<{
  telemetry: EnhancedTelemetryFrame[];
  playbackTime: number;
  highlightedStage?: number | null;
  onFirstFrameReady?: () => void;
}> = ({ telemetry, playbackTime, highlightedStage, onFirstFrameReady }) => {
  const controlPoints = useMemo(() => {
    if (!telemetry || telemetry.length === 0) {
      return [] as THREE.Vector3[];
    }

    return telemetry.map(frame =>
      latLngAltToVector3(frame.latitude, frame.longitude, frame.altitude)
    );
  }, [telemetry]);

  const smoothCurve = useMemo(() => {
    if (controlPoints.length < 2) {
      return null;
    }

    return new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.5);
  }, [controlPoints]);

  const curveSamples = useMemo(() => {
    if (!smoothCurve) {
      return controlPoints;
    }

    const sampleCount = Math.min(Math.max(controlPoints.length * 4, 200), 1200);
    return smoothCurve.getPoints(sampleCount);
  }, [smoothCurve, controlPoints]);

  const colors = useMemo(() => {
    if (!telemetry || telemetry.length === 0 || curveSamples.length === 0) {
      return [] as [number, number, number][];
    }

    const maxIndex = Math.max(telemetry.length - 1, 1);

    return curveSamples.map((_, index) => {
      const t = index / Math.max(curveSamples.length - 1, 1);
      const telemetryIndex = Math.min(Math.floor(t * maxIndex), maxIndex);
      const frame = telemetry[telemetryIndex];

      const speedFactor = Math.min((frame.speed || 0) / 8000, 1);
      const altitudeFactor = Math.min((frame.altitude || 0) / 400000, 1);

      if (highlightedStage && frame.stageNumber === highlightedStage) {
        return [1, 1, 1] as [number, number, number];
      }

      if (frame.stageNumber === 1) {
        return [1, 0.4 + speedFactor * 0.6, 0] as [number, number, number];
      }

      if (frame.stageNumber === 2) {
        return [0, 0.4 + altitudeFactor * 0.6, 1] as [number, number, number];
      }

      const r = speedFactor;
      const g = 1 - speedFactor;
      const b = Math.max(0.2, 1 - speedFactor);

      return [r, g, b] as [number, number, number];
    });
  }, [curveSamples, telemetry, highlightedStage]);

  const currentPosition = useMemo(() => {
    if (!telemetry || telemetry.length === 0 || curveSamples.length === 0) {
      return null;
    }

    if (smoothCurve) {
      const lastFrame = telemetry[telemetry.length - 1];
      const maxTime = Math.max(lastFrame?.time ?? 0, 1);
      const t = Math.min(Math.max(playbackTime / maxTime, 0), 1);
      return smoothCurve.getPoint(t);
    }

    return curveSamples[curveSamples.length - 1];
  }, [telemetry, playbackTime, curveSamples, smoothCurve]);

  const glowGeometry = useMemo(() => {
    if (!smoothCurve) {
      return null;
    }

    const tubularSegments = Math.min(Math.max(curveSamples.length * 2, 400), 2000);
    return new THREE.TubeGeometry(smoothCurve, tubularSegments, 0.8, 24, false);
  }, [smoothCurve, curveSamples.length]);

  useEffect(() => {
    return () => {
      glowGeometry?.dispose();
    };
  }, [glowGeometry]);

  useEffect(() => {
    if (curveSamples.length > 0) {
      onFirstFrameReady?.();
    }
  }, [curveSamples.length, onFirstFrameReady]);

  if (!telemetry || telemetry.length === 0 || curveSamples.length === 0) {
    if (telemetry.length === 0) {
      return (
        <Sphere 
          args={[2]} 
          position={latLngAltToVector3(FLORIDA_LAT, FLORIDA_LNG, 0)}
        >
          <meshBasicMaterial color="#ff6b6b" />
        </Sphere>
      );
    }
    return null;
  }

  return (
    <group>
      {glowGeometry && (
        <mesh geometry={glowGeometry}>
          <meshBasicMaterial
            color="#ffae58"
            transparent
            opacity={0.18}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      <Line
        points={curveSamples}
        color="white"
        lineWidth={2}
        transparent
        opacity={0.9}
        vertexColors={colors.length > 0 ? colors : undefined}
      />

      {currentPosition && (
        <group position={currentPosition}>
          <Sphere args={[2]} position={[0, 0, 0]}>
            <meshBasicMaterial color="#ff6b6b" />
          </Sphere>

          <Sphere args={[4]} position={[0, 0, 0]}>
            <meshBasicMaterial 
              color="#ff6b6b" 
              transparent 
              opacity={0.3}
            />
          </Sphere>

          {(() => {
            const currentFrame = getTelemetryFrame(telemetry, playbackTime);
            if (currentFrame?.velocityVector) {
              const vectorLength = Math.min(currentFrame.velocityVector.magnitude * 10, 50);
              const direction = currentFrame.velocityVector.direction * Math.PI / 180;
              const vectorEnd = [
                vectorLength * Math.cos(direction),
                0,
                vectorLength * Math.sin(direction)
              ] as [number, number, number];

              return (
                <Line
                  points={[[0, 0, 0], vectorEnd]}
                  color="#ffff00"
                  lineWidth={3}
                />
              );
            }
            return null;
          })()}
        </group>
      )}

      <Sphere 
        args={[1.5]} 
        position={latLngAltToVector3(FLORIDA_LAT, FLORIDA_LNG, 0)}
      >
        <meshBasicMaterial color="#ffd700" />
      </Sphere>
    </group>
  );
};

// Bermuda marker
const BermudaMarker: React.FC = () => {
  const position = latLngAltToVector3(BERMUDA_LAT, BERMUDA_LNG, 0);
  
  return (
    <group position={position}>
      <Sphere args={[1]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#00ff00" />
      </Sphere>
      <Text
        position={[0, 3, 0]}
        fontSize={2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        🏝️ Bermuda
      </Text>
    </group>
  );
};

// Visibility cone (approximate)
const VisibilityCone: React.FC<{
  telemetry: EnhancedTelemetryFrame[];
  playbackTime: number;
}> = ({ telemetry, playbackTime }) => {
  const bermudaPosition = latLngAltToVector3(BERMUDA_LAT, BERMUDA_LNG, 0);
  
  const visibleFrames = useMemo(() => {
    return telemetry.filter(frame => frame.aboveHorizon);
  }, [telemetry]);

  if (visibleFrames.length === 0) return null;

  // Create a simple cone indicating the viewing area
  const coneHeight = 50;
  const coneRadius = 20;

  return (
    <group position={bermudaPosition}>
      <mesh position={[0, coneHeight / 2, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[coneRadius, coneHeight, 8]} />
        <meshBasicMaterial 
          color="#00ff00" 
          transparent 
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// Stage event markers
const StageMarkers: React.FC<{
  simulationData: ProcessedSimulationData;
  telemetry: EnhancedTelemetryFrame[];
}> = ({ simulationData, telemetry }) => {
  const markers = useMemo(() => {
    return simulationData.stageEvents.map(event => {
      const frameIndex = getTelemetryFrameIndexAtOrAfterTime(telemetry, event.time);
      if (frameIndex === -1) return null;

      const frame = telemetry[frameIndex];
      const position = latLngAltToVector3(frame.latitude, frame.longitude, frame.altitude);
      
      return {
        position,
        event: event.event,
        time: event.time
      };
    }).filter(Boolean);
  }, [simulationData.stageEvents, telemetry]);

  return (
    <group>
      {markers.map((marker, index) => (
        <group key={index} position={marker!.position}>
          <Sphere args={[1.5]}>
            <meshBasicMaterial color="#ff9500" />
          </Sphere>
          <Text
            position={[0, 4, 0]}
            fontSize={1.5}
            color="orange"
            anchorX="center"
            anchorY="middle"
          >
            {marker!.event}
          </Text>
        </group>
      ))}
    </group>
  );
};

// Compass rose component for orientation
const CompassRose: React.FC = () => {
  const compassRadius = EARTH_RADIUS * 1.4; // Position outside Earth
  
  return (
    <group>
      {/* North indicator - North Pole maps to +Y */}
      <Text
        position={[0, compassRadius, 0]}
        fontSize={8}
        color="#ff4444"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI/2, 0, 0]}
      >
        N
      </Text>
      
      {/* South indicator - South Pole maps to -Y */}
      <Text
        position={[0, -compassRadius, 0]}
        fontSize={8}
        color="#ff4444"
        anchorX="center"
        anchorY="middle"
        rotation={[Math.PI/2, 0, 0]}
      >
        S
      </Text>
      
      {/* East indicator - 90°E longitude maps to -Z */}
      <Text
        position={[0, 0, -compassRadius]}
        fontSize={8}
        color="#44ff44"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, 0]}
      >
        E
      </Text>
      
      {/* West indicator - 90°W longitude maps to +Z */}
      <Text
        position={[0, 0, compassRadius]}
        fontSize={8}
        color="#44ff44"
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI, 0]}
      >
        W
      </Text>
      
      {/* Compass ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
        <ringGeometry args={[compassRadius - 5, compassRadius + 1, 64]} />
        <meshBasicMaterial color="#666666" transparent opacity={0.3} />
      </mesh>
      
      {/* Cardinal direction lines */}
      {/* North-South line (Y-axis) */}
      <Line 
        points={[
          [0, compassRadius - 10, 0], 
          [0, compassRadius + 10, 0]
        ]} 
        color="#ff4444" 
        lineWidth={2} 
      />
      <Line 
        points={[
          [0, -compassRadius + 10, 0], 
          [0, -compassRadius - 10, 0]
        ]} 
        color="#ff4444" 
        lineWidth={2} 
      />
      {/* East-West line (Z-axis) */}
      <Line 
        points={[
          [0, 0, -compassRadius + 10], 
          [0, 0, -compassRadius - 10]
        ]} 
        color="#44ff44" 
        lineWidth={2} 
      />
      <Line 
        points={[
          [0, 0, compassRadius - 10], 
          [0, 0, compassRadius + 10]
        ]} 
        color="#44ff44" 
        lineWidth={2} 
      />
    </group>
  );
};

// Camera controller for different view modes
const CameraController: React.FC<{ viewMode: string; telemetry: EnhancedTelemetryFrame[] }> = ({ 
  viewMode, 
  telemetry 
}) => {
  const { camera } = useThree();

  useEffect(() => {
    const bermudaPosition = latLngAltToVector3(BERMUDA_LAT, BERMUDA_LNG, 0);
    const launchPosition = latLngAltToVector3(FLORIDA_LAT, FLORIDA_LNG, 0);

    switch (viewMode) {
      case 'overview':
        // North-up orientation: position camera south of Earth, looking north
        // Z-axis points north, so position camera at negative Z to look north
        camera.position.set(0, 200, -300);
        camera.lookAt(0, 0, 0);
        // Set camera up vector to maintain north-up orientation
        camera.up.set(0, 1, 0);
        break;
      
      case 'side-profile':
        camera.position.set(300, 0, 0);
        camera.lookAt(0, 0, 0);
        break;
      
      case 'bermuda-pov':
        camera.position.copy(bermudaPosition);
        camera.position.multiplyScalar(1.1); // Slightly above Bermuda
        camera.lookAt(launchPosition);
        break;
      
      case 'top-down':
        camera.position.set(0, 400, 0);
        camera.lookAt(0, 0, 0);
        break;
      
      default:
        // North-up orientation by default
        camera.position.set(0, 200, -300);
        camera.lookAt(0, 0, 0);
        camera.up.set(0, 1, 0);
    }
  }, [viewMode, camera, telemetry]);

  return null;
};

// Real-time data overlay component
const DataOverlay: React.FC<{
  telemetry: EnhancedTelemetryFrame[];
  playbackTime: number;
  stageEvents: StageEvent[];
}> = ({ telemetry, playbackTime, stageEvents }) => {
  const { camera } = useThree();
  
  const currentData = useMemo(() => {
    const frame = getTelemetryFrame(telemetry, playbackTime);
    if (!frame) return null;

    // Find recent stage events
    const recentEvents = stageEvents.filter(
      event => event.time <= playbackTime && event.time >= playbackTime - 30
    );
    
    return {
      frame,
      recentEvents
    };
  }, [telemetry, playbackTime, stageEvents]);

  if (!currentData) return null;

  const { frame, recentEvents } = currentData;
  
  // Position overlay in screen space
  const overlayPosition: [number, number, number] = [
    camera.position.x > 0 ? -80 : 80,
    60,
    camera.position.z > 0 ? -20 : 20
  ];

  return (
    <group position={overlayPosition}>
      {/* Background panel */}
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[60, 40]} />
        <meshBasicMaterial 
          color="#000000" 
          transparent 
          opacity={0.7}
        />
      </mesh>
      
      {/* Telemetry text */}
      <Text
        position={[-25, 15, 0]}
        fontSize={2}
        color="#ffffff"
        anchorX="left"
        anchorY="top"
      >
        {`T+${Math.floor(playbackTime / 60)}:${(Math.floor(playbackTime) % 60).toString().padStart(2, '0')}`}
      </Text>
      
      <Text
        position={[-25, 10, 0]}
        fontSize={1.5}
        color="#00ff88"
        anchorX="left"
        anchorY="top"
      >
        {`ALT: ${(frame.altitude / 1000).toFixed(1)} km`}
      </Text>
      
      <Text
        position={[-25, 6, 0]}
        fontSize={1.5}
        color="#ff6b6b"
        anchorX="left"
        anchorY="top"
      >
        {`VEL: ${(frame.speed / 1000).toFixed(2)} km/s`}
      </Text>
      
      <Text
        position={[-25, 2, 0]}
        fontSize={1.5}
        color="#4a90e2"
        anchorX="left"
        anchorY="top"
      >
        {`DIST: ${frame.distanceFromBermuda.toFixed(0)} km`}
      </Text>
      
      <Text
        position={[-25, -2, 0]}
        fontSize={1.5}
        color="#ffd700"
        anchorX="left"
        anchorY="top"
      >
        {`ELEV: ${frame.elevationAngle.toFixed(1)}°`}
      </Text>
      
      <Text
        position={[-25, -6, 0]}
        fontSize={1.5}
        color="#ff9500"
        anchorX="left"
        anchorY="top"
      >
        {`STAGE: ${frame.stageNumber}`}
      </Text>
      
      {/* Recent stage events */}
      {recentEvents.length > 0 && (
        <Text
          position={[-25, -12, 0]}
          fontSize={1.2}
          color="#ffff00"
          anchorX="left"
          anchorY="top"
        >
          {recentEvents[recentEvents.length - 1].event}
        </Text>
      )}
      
      {/* Visibility indicator */}
      <Text
        position={[-25, -16, 0]}
        fontSize={1.2}
        color={frame.aboveHorizon ? "#00ff00" : "#ff0000"}
        anchorX="left"
        anchorY="top"
      >
        {frame.aboveHorizon ? "✓ VISIBLE" : "✗ NOT VISIBLE"}
      </Text>
    </group>
  );
};

// Main scene component
const Trajectory3DScene: React.FC<Trajectory3DSceneProps> = ({
  simulationData,
  viewMode,
  playbackTime,
  highlightedStage,
  showDataOverlay,
  platform
}) => {
  const { enhancedTelemetry, stageEvents } = simulationData;
  
  // Loading and initialization states
  const [sceneReady, setSceneReady] = useState(false);
  const [earthReady, setEarthReady] = useState(false);
  const [trajectoryReady, setTrajectoryReady] = useState(false);
  
  // Handle component readiness
  const handleEarthReady = () => {
    setEarthReady(true);
    checkSceneReady();
  };
  
  const handleTrajectoryReady = () => {
    setTrajectoryReady(true);
    checkSceneReady();
  };
  
  const checkSceneReady = () => {
    if (earthReady && (trajectoryReady || !enhancedTelemetry?.length)) {
      setSceneReady(true);
    }
  };
  
  // Initialize scene readiness check
  useEffect(() => {
    checkSceneReady();
  }, [earthReady, trajectoryReady, enhancedTelemetry?.length]);

  // Optimized OrbitControls configuration for mobile
  const orbitConfig = useMemo(() => ({
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
    maxDistance: 800,
    minDistance: 150,
    // Mobile-specific optimizations
    enableDamping: platform?.isMobile ?? true, // Smoother on mobile
    dampingFactor: platform?.isMobile ? 0.1 : 0.05, // More damping on mobile
    rotateSpeed: platform?.isMobile ? 0.8 : 1.0, // Slower rotation on mobile
    zoomSpeed: platform?.isMobile ? 0.8 : 1.0, // Slower zoom on mobile
    panSpeed: platform?.isMobile ? 0.8 : 1.0, // Slower pan on mobile
    touchRotateSpeed: platform?.supportsTouch ? 1.5 : 1.0, // Enhanced touch rotation
    touchZoomSpeed: platform?.supportsTouch ? 1.5 : 1.0, // Enhanced touch zoom
    touchPanSpeed: platform?.supportsTouch ? 1.5 : 1.0, // Enhanced touch pan
  }), [platform]);

  // Add safety checks - but still render Earth and basic scene
  if (!simulationData || !enhancedTelemetry || enhancedTelemetry.length === 0) {
    return (
      <>
        {/* Basic lighting */}
        <ambientLight intensity={0.6} />
        <pointLight position={[100, 100, 100]} intensity={1} />
        
        {/* Camera controls */}
        {viewMode === 'overview' && (
          <OrbitControls
            {...orbitConfig}
          />
        )}
        
        {/* Earth only - still preload textures */}
        <Earth />
        
        {/* Bermuda and launch site markers */}
        <BermudaMarker />
        <Sphere 
          args={[1.5]} 
          position={latLngAltToVector3(FLORIDA_LAT, FLORIDA_LNG, 0)}
        >
          <meshBasicMaterial color="#ffd700" />
        </Sphere>
        
        {/* Compass for orientation */}
        <CompassRose />
        
        {/* Loading/error indicator */}
        <Text position={[0, 150, 0]} fontSize={10} color="#ff4444" anchorX="center" anchorY="middle">
          {simulationData ? 'Loading trajectory data...' : 'No trajectory data available'}
        </Text>
        
        {/* Grid and axes helpers */}
        <gridHelper args={[400, 20]} position={[0, -EARTH_RADIUS - 10, 0]} />
        <axesHelper args={[50]} />
      </>
    );
  }

  return (
    <>
      {/* Lighting - optimized for immediate visibility */}
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={1} />
      <pointLight position={[-100, -100, -100]} intensity={0.4} />

      {/* Camera controls (only for some view modes) */}
      {viewMode === 'overview' && (
        <OrbitControls
          {...orbitConfig}
        />
      )}

      {/* Camera controller for specific view modes */}
      <CameraController viewMode={viewMode} telemetry={enhancedTelemetry} />

      {/* Earth with loading callback - always render first */}
      <Earth onTexturesReady={handleEarthReady} />

      {/* Static elements - render immediately */}
      <BermudaMarker />
      <CompassRose />
      
      {/* Launch site marker */}
      <Sphere 
        args={[1.5]} 
        position={latLngAltToVector3(FLORIDA_LAT, FLORIDA_LNG, 0)}
      >
        <meshBasicMaterial color="#ffd700" />
      </Sphere>

      {/* Grid and axis helpers for reference */}
      <gridHelper args={[400, 20]} position={[0, -EARTH_RADIUS - 10, 0]} />
      <axesHelper args={[50]} />

      {/* Dynamic elements - render only when data is ready */}
      {enhancedTelemetry && enhancedTelemetry.length > 0 && (
        <>
          {/* Visibility cone */}
          <VisibilityCone 
            telemetry={enhancedTelemetry}
            playbackTime={playbackTime}
          />

          {/* Trajectory path with first frame callback */}
          <TrajectoryPath
            telemetry={enhancedTelemetry}
            playbackTime={playbackTime}
            highlightedStage={highlightedStage}
            onFirstFrameReady={handleTrajectoryReady}
          />

          {/* Stage event markers */}
          <StageMarkers
            simulationData={simulationData}
            telemetry={enhancedTelemetry}
          />

          {/* Real-time data overlay */}
          {showDataOverlay && (
            <DataOverlay
              telemetry={enhancedTelemetry}
              playbackTime={playbackTime}
              stageEvents={stageEvents}
            />
          )}
        </>
      )}
      
      {/* Status indicator for data loading */}
      {(!enhancedTelemetry || enhancedTelemetry.length === 0) && (
        <Text 
          position={[0, 130, 0]} 
          fontSize={8} 
          color="#ffaa00" 
          anchorX="center" 
          anchorY="middle"
        >
          Loading trajectory...
        </Text>
      )}
    </>
  );
};

export default Trajectory3DScene;
