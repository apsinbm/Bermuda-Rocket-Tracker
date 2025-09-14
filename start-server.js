const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

console.log('🚀 Starting Bermuda Rocket Tracker...');

// SECURITY WARNING: Check if running in development
if (process.env.NODE_ENV === 'production') {
  console.error('⚠️  WARNING: This server should NOT be used in production!');
  console.error('⚠️  Use proper deployment methods (Vercel, etc.) for production');
  process.exit(1);
}

console.log('⚠️  SECURITY NOTICE: This server is for LOCAL DEVELOPMENT ONLY');
console.log('⚠️  Do not expose this on public networks or interfaces');

const server = http.createServer((req, res) => {
  console.log(`📡 Request: ${req.url}`);
  
  let filePath = path.join(__dirname, 'build', req.url === '/' ? 'index.html' : req.url);
  
  // Determine content type
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
    case '.ico':
      contentType = 'image/x-icon';
      break;
  }
  
  // SECURITY WARNING: This server is for LOCAL DEVELOPMENT ONLY
  // Do not expose this server on public networks or interfaces
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Restricted CORS - only allow localhost
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Read and serve the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // If file not found, serve index.html (for React routing)
        fs.readFile(path.join(__dirname, 'build', 'index.html'), (error, content) => {
          if (error) {
            res.writeHead(404);
            res.end('Build files not found. Run: npm run build');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🎉 Bermuda Rocket Tracker is running!');
  console.log('');
  console.log('📱 Access the app at any of these URLs:');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log(`   http://0.0.0.0:${PORT}`);
  console.log('');
  console.log('🔧 If connection refused, try:');
  console.log('   1. Use 127.0.0.1 instead of localhost');
  console.log('   2. Check firewall settings');
  console.log('   3. Try a different browser');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log(`💡 Try: lsof -i :${PORT} to see what's using it`);
    console.log(`💡 Or try a different port by changing PORT in this file`);
  } else {
    console.error('Server error:', error);
  }
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});