// Bermuda Rocket Tracker - Service Worker
// Handles push notifications and offline caching

const CACHE_NAME = 'bermuda-rocket-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
  
  // Take control immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all clients
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external API calls and let them go to network
  if (event.request.url.includes('thespacedevs.com') || 
      event.request.url.includes('api.openweathermap.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response for caching
            const responseToCache = response.clone();
            
            // Add to cache for future requests
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            
            // Return offline page if available
            if (event.request.destination === 'document') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click', event);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate to specific launch if provided
            if (data.url) {
              client.navigate(data.url);
            }
            return client.focus();
          }
        }
        
        // Open new window if app not open
        if (clients.openWindow) {
          const targetUrl = data.url ? 
            `${self.location.origin}${data.url}` : 
            self.location.origin;
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event', event);
  
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New rocket launch update!',
      icon: '/rocket-icon-192.png',
      badge: '/rocket-badge-96.png',
      tag: data.tag || 'launch-update',
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: 'View Launch',
          icon: '/action-view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || '🚀 Bermuda Rocket Tracker',
        options
      )
    );
  } catch (error) {
    console.error('Service Worker: Failed to handle push event', error);
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('🚀 Rocket Launch Update', {
        body: 'Check the app for the latest launch information!',
        icon: '/rocket-icon-192.png'
      })
    );
  }
});

// Background sync - for offline data syncing (future feature)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event);
  
  if (event.tag === 'background-sync-launches') {
    event.waitUntil(
      // Future: sync launch data when back online
      Promise.resolve()
    );
  }
});

// Message event - communication with main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SCHEDULE_NOTIFICATION':
      // Handle notification scheduling
      break;
      
    case 'CLEAR_CACHE':
      // Clear all caches
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        })
      );
      break;
      
    case 'GET_CACHE_INFO':
      // Return cache information
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          event.ports[0].postMessage({
            caches: cacheNames,
            currentCache: CACHE_NAME
          });
        })
      );
      break;
      
    default:
      console.log('Service Worker: Unknown message type', type);
  }
});

console.log('Service Worker: Loaded successfully');