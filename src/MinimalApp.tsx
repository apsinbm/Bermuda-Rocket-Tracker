import React from 'react';

export default function MinimalApp() {
  
  return React.createElement('div', {
    style: {
      padding: '40px',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }
  }, [
    React.createElement('h1', { key: 'title' }, '🚀 Bermuda Rocket Tracker'),
    React.createElement('p', { key: 'message' }, 'Minimal version - no external dependencies'),
    React.createElement('div', { 
      key: 'status',
      style: { 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: 'lightgreen',
        borderRadius: '5px'
      }
    }, '✅ React is working!')
  ]);
}