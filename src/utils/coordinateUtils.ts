/**
 * Coordinate conversion utilities for trajectory image analysis
 * Handles conversion between image pixels and geographic coordinates
 */

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ImagePoint {
  x: number;
  y: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

// Standard map bounds for Florida/Atlantic trajectory maps
// Based on typical Space Launch Schedule trajectory image coverage
export const FLORIDA_TRAJECTORY_MAP_BOUNDS: MapBounds = {
  north: 35.0,   // Northern boundary (roughly Georgia)
  south: 20.0,   // Southern boundary (roughly Caribbean)
  east: -60.0,   // Eastern boundary (well past Bermuda)
  west: -85.0    // Western boundary (Florida panhandle)
};

/**
 * Convert pixel coordinates to geographic coordinates
 * Assumes a simple rectangular (Plate Carrée) projection
 */
export function pixelToGeo(
  pixel: ImagePoint,
  imageWidth: number,
  imageHeight: number,
  bounds: MapBounds = FLORIDA_TRAJECTORY_MAP_BOUNDS
): GeoPoint {
  // Convert pixel coordinates to 0-1 range
  const normalizedX = pixel.x / imageWidth;
  const normalizedY = pixel.y / imageHeight;
  
  // Convert to geographic coordinates
  const lng = bounds.west + normalizedX * (bounds.east - bounds.west);
  const lat = bounds.north - normalizedY * (bounds.north - bounds.south);
  
  return { lat, lng };
}

/**
 * Convert geographic coordinates to pixel coordinates
 */
export function geoToPixel(
  geo: GeoPoint,
  imageWidth: number,
  imageHeight: number,
  bounds: MapBounds = FLORIDA_TRAJECTORY_MAP_BOUNDS
): ImagePoint {
  // Convert to normalized coordinates (0-1)
  const normalizedX = (geo.lng - bounds.west) / (bounds.east - bounds.west);
  const normalizedY = (bounds.north - geo.lat) / (bounds.north - bounds.south);
  
  // Convert to pixel coordinates
  const x = normalizedX * imageWidth;
  const y = normalizedY * imageHeight;
  
  return { x, y };
}

/**
 * Detect map bounds from trajectory image by looking for coordinate labels
 * This is a placeholder for future OCR-based bounds detection
 */
export function detectMapBounds(imageData: ImageData): MapBounds | null {
  // Future enhancement: OCR-based coordinate detection
  // Would scan the image for coordinate labels like "30°N", "-70°W" etc.
  // and automatically determine the map bounds
  
  return null;
}

/**
 * Validate that coordinates are reasonable for Florida trajectory maps
 */
export function validateTrajectoryCoordinates(points: GeoPoint[]): boolean {
  for (const point of points) {
    // Check if coordinates are within reasonable bounds for Florida launches
    if (point.lat < 15 || point.lat > 40) return false; // Latitude range
    if (point.lng < -90 || point.lng > -50) return false; // Longitude range
  }
  return true;
}

/**
 * Calculate great circle distance between two points (in kilometers)
 */
export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing from point1 to point2 (in degrees)
 */
export function calculateBearing(point1: GeoPoint, point2: GeoPoint): number {
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(point2.lat * Math.PI / 180);
  const x = Math.cos(point1.lat * Math.PI / 180) * Math.sin(point2.lat * Math.PI / 180) -
    Math.sin(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Find the closest point on a trajectory to Bermuda
 */
export function findClosestApproach(trajectoryPoints: GeoPoint[]): {
  closestPoint: GeoPoint;
  distance: number;
  index: number;
} {
  const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
  
  let closestDistance = Infinity;
  let closestPoint = trajectoryPoints[0];
  let closestIndex = 0;
  
  trajectoryPoints.forEach((point, index) => {
    const distance = calculateDistance(bermuda, point);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = point;
      closestIndex = index;
    }
  });
  
  return {
    closestPoint,
    distance: closestDistance,
    index: closestIndex
  };
}

/**
 * Interpolate additional points along a trajectory for smoother analysis
 */
export function interpolateTrajectory(points: GeoPoint[], targetPointCount: number): GeoPoint[] {
  if (points.length < 2) return points;
  if (targetPointCount <= points.length) return points;
  
  const interpolated: GeoPoint[] = [];
  const segmentCount = targetPointCount - 1;
  const pointsPerSegment = segmentCount / (points.length - 1);
  
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const segmentPoints = Math.ceil(pointsPerSegment);
    
    for (let j = 0; j < segmentPoints; j++) {
      const t = j / segmentPoints;
      const lat = start.lat + t * (end.lat - start.lat);
      const lng = start.lng + t * (end.lng - start.lng);
      interpolated.push({ lat, lng });
    }
  }
  
  // Add the last point
  interpolated.push(points[points.length - 1]);
  
  return interpolated.slice(0, targetPointCount);
}