// Simple WebSocket server for multiplayer sync
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create HTTP server to serve the HTML file
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(data);
        });
    } else if (req.url === '/shared-worker.js') {
        fs.readFile(path.join(__dirname, 'shared-worker.js'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, {'Content-Type': 'text/javascript'});
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();
const markers = [];

wss.on('connection', (ws) => {
    const clientId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    console.log('New client connected:', clientId);
    clients.set(clientId, ws);
    
    // Send existing markers to new client
    if (markers.length > 0) {
        ws.send(JSON.stringify({
            type: 'markersSync',
            markers: markers
        }));
    }
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type, 'from', clientId);
            
            // Store markers
            if (data.type === 'newMarker') {
                markers.push(data.marker);
                // Keep only last 100 markers
                if (markers.length > 100) {
                    markers.splice(0, markers.length - 100);
                }
            }
            
            // Broadcast to all other clients
            clients.forEach((client, id) => {
                if (id !== clientId && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected:', clientId);
        clients.delete(clientId);
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        clients.delete(clientId);
    });
});

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket ready on ws://localhost:${PORT}`);
});