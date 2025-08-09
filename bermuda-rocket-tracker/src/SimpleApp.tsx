import React, { useState, useEffect } from 'react';

function SimpleApp() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    try {
      setMessage('🚀 Bermuda Rocket Tracker is working!');
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error loading app');
    }
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>{message}</h1>
      <p>
        If you can see this, the basic React app is working. 
        The issue might be with the complex components or services.
      </p>
    </div>
  );
}

export default SimpleApp;