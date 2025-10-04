/**
 * Simplified 3D Trajectory Scene
 *
 * Clean, fast, easy-to-understand 3D visualization
 * Focus: Show rocket path from Bermuda's perspective
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { ProcessedSimulationData } from '../services/flightClubApiService';
import { PlatformInfo } from '../utils/platformUtils';

interface Trajectory3DSceneProps {
  simulationData: ProcessedSimulationData;
  viewMode: string;
  playbackTime: number;
  highlightedStage?: number | null;
  showDataOverlay?: boolean;
  platform?: PlatformInfo;
}

// Constants
const EARTH_RADIUS = 100;
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

// Convert lat/lng/altitude to 3D coordinates
function latLngAltToVector3(lat: number, lng: number, alt: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (-lng) * (Math.PI / 180);
  const radius = EARTH_RADIUS + (alt / 1000) * 0.4; // Scale altitude

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Simple Earth component - just a blue sphere
const SimpleEarth: React.FC = () => {
  return (
    <group>
      {/* Main Earth sphere - simple blue */}
      <Sphere args={[EARTH_RADIUS, 32, 32]}>
        <meshStandardMaterial
          color="#1a4d8f"
          roughness={0.8}
          metalness={0.2}
        />
      </Sphere>

      {/* Slight atmosphere glow */}
      <Sphere args={[EARTH_RADIUS * 1.02, 32, 32]}>
        <meshBasicMaterial
          color="#4a90e2"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
};

// Bermuda marker
const BermudaMarker: React.FC = () => {
  const position = latLngAltToVector3(BERMUDA_LAT, BERMUDA_LNG, 0);

  return (
    <group position={position}>
      {/* Bright marker sphere */}
      <Sphere args={[2, 16, 16]}>
        <meshBasicMaterial color="#00ff88" />
      </Sphere>

      {/* Label */}
      <Text
        position={[0, 5, 0]}
        fontSize={4}
        color="#00ff88"
        anchorX="center"
        anchorY="middle"
      >
        Bermuda
      </Text>
    </group>
  );
};

// Trajectory path component
const TrajectoryPath: React.FC<{
  telemetry: ProcessedSimulationData['enhancedTelemetry'];
  playbackTime: number;
}> = ({ telemetry, playbackTime }) => {

  // Convert telemetry to 3D points
  const trajectoryPoints = useMemo(() => {
    return telemetry.map(frame =>
      latLngAltToVector3(frame.latitude, frame.longitude, frame.altitude)
    );
  }, [telemetry]);

  // Separate into visible and not-visible segments
  const { visiblePoints, invisiblePoints, currentIndex } = useMemo(() => {
    const visible: THREE.Vector3[] = [];
    const invisible: THREE.Vector3[] = [];
    let currentIdx = 0;

    telemetry.forEach((frame, i) => {
      const point = trajectoryPoints[i];
      if (frame.aboveHorizon) {
        visible.push(point);
      } else {
        invisible.push(point);
      }

      if (frame.time <= playbackTime) {
        currentIdx = i;
      }
    });

    return {
      visiblePoints: visible,
      invisiblePoints: invisible,
      currentIndex: currentIdx
    };
  }, [telemetry, trajectoryPoints, playbackTime]);

  // Current rocket position
  const currentPosition = trajectoryPoints[currentIndex];

  return (
    <group>
      {/* Visible trajectory (green) */}
      {visiblePoints.length > 1 && (
        <Line
          points={visiblePoints}
          color="#00ff88"
          lineWidth={3}
        />
      )}

      {/* Invisible trajectory (red/dim) */}
      {invisiblePoints.length > 1 && (
        <Line
          points={invisiblePoints}
          color="#ff4444"
          lineWidth={2}
          opacity={0.5}
          transparent
        />
      )}

      {/* Current rocket position */}
      {currentPosition && (
        <group position={currentPosition}>
          <Sphere args={[3, 16, 16]}>
            <meshBasicMaterial color="#ffd700" />
          </Sphere>

          {/* Pulsing glow effect */}
          <Sphere args={[4, 16, 16]}>
            <meshBasicMaterial
              color="#ffd700"
              transparent
              opacity={0.3}
            />
          </Sphere>
        </group>
      )}
    </group>
  );
};

// Event markers
const EventMarkers: React.FC<{
  events: ProcessedSimulationData['stageEvents'];
  telemetry: ProcessedSimulationData['enhancedTelemetry'];
}> = ({ events, telemetry }) => {

  const eventPositions = useMemo(() => {
    return events
      .filter(event => event.importance === 'critical' || event.importance === 'major')
      .map(event => {
        // Find telemetry frame closest to event time
        const frame = telemetry.find(f => Math.abs(f.time - event.time) < 5) || telemetry[0];
        return {
          position: latLngAltToVector3(frame.latitude, frame.longitude, frame.altitude),
          event: event.event,
          time: event.time
        };
      });
  }, [events, telemetry]);

  return (
    <group>
      {eventPositions.map((ev, i) => (
        <group key={i} position={ev.position}>
          {/* Event marker sphere */}
          <Sphere args={[2, 12, 12]}>
            <meshBasicMaterial color="#ff6b6b" />
          </Sphere>

          {/* Event label */}
          <Text
            position={[0, 5, 0]}
            fontSize={3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.5}
            outlineColor="#000000"
          >
            {ev.event}
          </Text>
        </group>
      ))}
    </group>
  );
};

// Visibility cone from Bermuda
const VisibilityCone: React.FC = () => {
  const bermudaPos = latLngAltToVector3(BERMUDA_LAT, BERMUDA_LNG, 0);

  // Create cone geometry pointing away from Bermuda
  const coneGeometry = useMemo(() => {
    const geometry = new THREE.ConeGeometry(50, 200, 32, 1, true);
    geometry.rotateX(Math.PI / 2); // Point outward
    return geometry;
  }, []);

  return (
    <mesh position={bermudaPos} geometry={coneGeometry}>
      <meshBasicMaterial
        color="#00ff88"
        transparent
        opacity={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Main component
const Trajectory3DScene: React.FC<Trajectory3DSceneProps> = ({
  simulationData,
  viewMode,
  playbackTime,
  platform
}) => {

  const { enhancedTelemetry, stageEvents } = simulationData;

  // Camera position based on view mode
  const cameraPosition = useMemo((): [number, number, number] => {
    const bermudaPos = latLngAltToVector3(BERMUDA_LAT, BERMUDA_LNG, 0);

    switch (viewMode) {
      case 'bermuda-pov':
        return [bermudaPos.x * 2, bermudaPos.y * 2, bermudaPos.z * 2];
      case 'side-profile':
        return [0, 0, EARTH_RADIUS * 3];
      case 'top-down':
        return [0, EARTH_RADIUS * 3, 0];
      default: // overview
        return [EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2];
    }
  }, [viewMode]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <pointLight position={[200, 200, 200]} intensity={1} />
      <pointLight position={[-200, -200, -200]} intensity={0.3} />

      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={EARTH_RADIUS * 1.5}
        maxDistance={EARTH_RADIUS * 5}
      />

      {/* Earth */}
      <SimpleEarth />

      {/* Bermuda marker */}
      <BermudaMarker />

      {/* Visibility cone */}
      <VisibilityCone />

      {/* Trajectory path */}
      {enhancedTelemetry.length > 0 && (
        <TrajectoryPath
          telemetry={enhancedTelemetry}
          playbackTime={playbackTime}
        />
      )}

      {/* Event markers */}
      {stageEvents.length > 0 && (
        <EventMarkers
          events={stageEvents}
          telemetry={enhancedTelemetry}
        />
      )}
    </>
  );
};

export default Trajectory3DScene;
