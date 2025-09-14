const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HOST = '0.0.0.0'; // Bind to all interfaces

// SECURITY WARNING: Check if running in development
if (process.env.NODE_ENV === 'production') {
  console.error('⚠️  WARNING: This server should NOT be used in production!');
  console.error('⚠️  Use proper deployment methods (Vercel, etc.) for production');
  process.exit(1);
}

console.log('⚠️  SECURITY WARNING: This server binds to ALL network interfaces (0.0.0.0)');
console.log('⚠️  Only use this on trusted networks for local development');
console.log('⚠️  Never expose this server to the internet or public networks');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.url}`);
  
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
  }
  
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Read and serve the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // If file not found, serve index.html (for React routing)
        fs.readFile(path.join(__dirname, 'build', 'index.html'), (error, content) => {
          if (error) {
            res.writeHead(404);
            res.end('404 Not Found');
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

server.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Try accessing:');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  http://172.20.10.2:${PORT} (Your local network IP)`);
  console.log(`  http://0.0.0.0:${PORT}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});