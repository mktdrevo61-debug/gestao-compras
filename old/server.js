const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5182;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml'
};

const os = require('os');

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  // Tratar parâmetros de consulta (?_=1237812) na URL
  if (filePath.includes('?')) {
    filePath = filePath.split('?')[0];
  }

  let extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Erro no Servidor: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Descobrir o IP local de rede
function getLocalIp() {
  const networkInterfaces = os.networkInterfaces();
  for (let interfaceName in networkInterfaces) {
    for (let iface of networkInterfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`DREVO GESTÃO DE COMPRAS - SERVIDOR ATIVO`);
  console.log(`======================================================`);
  console.log(`> Local:       http://localhost:${PORT}`);
  console.log(`> Rede Local:  http://${localIp}:${PORT} (Compartilhe com quem está no mesmo Wi-Fi)`);
  console.log(`======================================================\n`);
});
