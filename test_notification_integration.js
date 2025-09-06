/**
 * Test Script to Verify Notification System Integration
 * Run this in the browser console to test notification features
 */

console.log('🚀 Testing Bermuda Rocket Tracker Notification System');

// Test 1: Check if notification service is available
if (typeof window !== 'undefined' && window.notificationService) {
  console.log('✅ Notification service is available');
  
  // Test notification support
  const status = window.notificationService.getStatus();
  console.log('📊 Notification Status:', status);
  
  if (status.supported) {
    console.log('✅ Browser supports notifications');
    
    if (status.permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Test notification
      window.notificationService.testNotification()
        .then(() => console.log('✅ Test notification sent successfully'))
        .catch(err => console.error('❌ Test notification failed:', err));
        
    } else {
      console.log('⚠️ Notification permission not granted. Click the notification button in the app to request permission.');
    }
  } else {
    console.log('❌ Browser does not support notifications');
  }
} else {
  console.log('❌ Notification service not found. Make sure the app is running.');
}

// Test 2: Check if launch data is being processed
setTimeout(() => {
  const launchCards = document.querySelectorAll('[id^="launch-"]');
  console.log(`📋 Found ${launchCards.length} launch cards on page`);
  
  if (launchCards.length > 0) {
    console.log('✅ Launch data is being displayed');
    console.log('🎯 Notification system should be scheduling alerts for visible launches');
  } else {
    console.log('⚠️ No launch cards found. App may still be loading or no launches available.');
  }
}, 2000);

console.log(`
🔔 To test notifications:
1. Click the "🔔 Notifications" button in the app header
2. Enable notifications when prompted
3. Click "Send Test Notification" to verify it works
4. The system will automatically schedule notifications for upcoming visible launches

📱 Features included:
- Browser notification permission handling
- Configurable reminder times (1 hour, 15 minutes, 5 minutes before launch)  
- High visibility filtering
- Sound alerts
- Click-to-focus functionality
- Persistent settings in localStorage
`);