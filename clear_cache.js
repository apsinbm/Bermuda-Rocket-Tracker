// Script to inject into browser console to clear cache and debug
console.log('=== CLEARING LAUNCH CACHE ===');
localStorage.removeItem('bermuda-rocket-launches-db');
localStorage.removeItem('bermuda-rocket-db-metadata');
console.log('Cache cleared! Reloading page...');
window.location.reload();