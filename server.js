const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Try different host options
const HOST = '127.0.0.1'; // Try 127.0.0.1 instead of localhost

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`Also try: http://localhost:${PORT}`);
});

// Error handling
app.on('error', (error) => {
  console.error('Server error:', error);
});