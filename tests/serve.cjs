// Local-only manual Firefox fixture. No dependencies; not packaged in the XPI.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const fixture = fs.readFileSync(path.join(__dirname, 'manual-navigation.html'));
http.createServer((request, response) => {
  response.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
  response.end(fixture);
}).listen(8765, '127.0.0.1', () => {
  console.log('Manual fixture: http://127.0.0.1:8765/ — stop with Ctrl+C');
});

