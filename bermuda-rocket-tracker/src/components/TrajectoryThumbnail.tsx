import React, { useState } from 'react';

interface TrajectoryThumbnailProps {
  imageUrl: string;
  trajectoryDirection?: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  launchName: string;
}

const TrajectoryThumbnail: React.FC<TrajectoryThumbnailProps> = ({ 
  imageUrl, 
  trajectoryDirection,
  launchName 
}) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleImageError = () => {
    setImageError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const getDirectionColor = (direction?: string) => {
    switch (direction) {
      case 'North': return 'text-purple-600 bg-purple-100';
      case 'Northeast': return 'text-green-600 bg-green-100';
      case 'East-Northeast': return 'text-emerald-600 bg-emerald-100';
      case 'East': return 'text-blue-600 bg-blue-100';
      case 'East-Southeast': return 'text-amber-600 bg-amber-100';
      case 'Southeast': return 'text-orange-600 bg-orange-100';
      case 'South': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (imageError) {
    return (
      <div className="w-24 h-16 bg-gray-100 dark:bg-gray-700 rounded border flex items-center justify-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">No Map</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="w-24 h-16 bg-gray-100 dark:bg-gray-700 rounded border flex items-center justify-center">
          <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        </div>
      )}
      
      <img
        src={imageUrl}
        alt={`Trajectory map for ${launchName}`}
        className={`w-24 h-16 object-cover rounded border shadow-sm ${loading ? 'hidden' : 'block'}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
      
      {trajectoryDirection && trajectoryDirection !== 'Unknown' && !loading && !imageError && (
        <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-xs font-medium rounded ${getDirectionColor(trajectoryDirection)}`}>
          {trajectoryDirection === 'North' ? 'N' :
           trajectoryDirection === 'Northeast' ? 'NE' : 
           trajectoryDirection === 'East-Northeast' ? 'ENE' :
           trajectoryDirection === 'East' ? 'E' : 
           trajectoryDirection === 'East-Southeast' ? 'ESE' :
           trajectoryDirection === 'Southeast' ? 'SE' :
           trajectoryDirection === 'South' ? 'S' : 'E'}
        </div>
      )}
    </div>
  );
};

export default TrajectoryThumbnail;