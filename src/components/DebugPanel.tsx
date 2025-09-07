import React, { useState, useEffect } from 'react';
import { Launch } from '../types';
import { launchDatabase } from '../services/launchDatabase';

interface DebugPanelProps {
  launches: Launch[];
}

const DebugPanel: React.FC<DebugPanelProps> = ({ launches }) => {
  const [dbLaunches, setDbLaunches] = useState<Launch[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Get launches from database
    const cached = launchDatabase.getAllLaunches();
    setDbLaunches(cached);
  }, []);

  const now = new Date();

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md">
      <h3 className="font-bold mb-2">Debug Panel</h3>
      <div className="text-sm space-y-1">
        <p>Current Time: {now.toISOString()}</p>
        <p>Raw Launches: {launches.length}</p>
        <p>DB Cached: {dbLaunches.length}</p>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-500 underline"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-2 max-h-64 overflow-y-auto text-xs">
          <h4 className="font-semibold">Raw Launches:</h4>
          {launches.slice(0, 5).map((launch, i) => {
            const launchTime = new Date(launch.net);
            const isFuture = launchTime > now;
            return (
              <div key={i} className={isFuture ? 'text-green-600' : 'text-red-600'}>
                {launch.name} - {launch.net} ({isFuture ? 'FUTURE' : 'PAST'})
              </div>
            );
          })}
          
          <div className="mt-2 space-y-1">
            <button 
              onClick={() => {
                launchDatabase.clear();
                window.location.reload();
              }}
              className="block w-full px-2 py-1 bg-red-500 text-white rounded text-xs"
            >
              Clear Launch Cache & Reload
            </button>
            <button 
              onClick={() => {
                // Clear trajectory cache
                localStorage.removeItem('trajectory-cache');
                localStorage.removeItem('space-launch-schedule-cache');
                
                // Clear any trajectory-related cache items
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                  if (key.includes('trajectory') || key.includes('space-launch-schedule')) {
                    localStorage.removeItem(key);
                  }
                });
                
                window.location.reload();
              }}
              className="block w-full px-2 py-1 bg-orange-500 text-white rounded text-xs"
            >
              Clear Trajectory Cache & Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;