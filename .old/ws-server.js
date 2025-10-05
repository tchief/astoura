#!/usr/bin/env node

// Simple WebSocket server for multiplayer
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8082;

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Server Running on port ' + PORT);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();
let clientIdCounter = 0;

console.log('🚀 Starting WebSocket server...');

wss.on('connection', (ws, req) => {
    const clientId = ++clientIdCounter;
    const clientIp = req.socket.remoteAddress;
    
    clients.set(clientId, {
        ws: ws,
        id: clientId,
        ip: clientIp,
        joinedAt: new Date()
    });
    
    console.log(`✅ Client #${clientId} connected from ${clientIp} (Total: ${clients.size})`);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId: clientId,
        message: 'Connected to server'
    }));
    
    // Broadcast user joined
    broadcast({
        type: 'userJoined',
        clientId: clientId,
        totalUsers: clients.size
    }, clientId);
    
    // Handle messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`📨 Message from #${clientId}:`, data.type);
            
            // Add server timestamp and clientId
            data.serverTime = Date.now();
            data.fromClient = clientId;
            
            // Broadcast to all other clients
            broadcast(data, clientId);
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });
    
    // Handle disconnect
    ws.on('close', () => {
        console.log(`❌ Client #${clientId} disconnected`);
        clients.delete(clientId);
        
        // Broadcast user left
        broadcast({
            type: 'userLeft',
            clientId: clientId,
            totalUsers: clients.size
        }, clientId);
    });
    
    ws.on('error', (err) => {
        console.error(`Error with client #${clientId}:`, err.message);
        clients.delete(clientId);
    });
});

// Broadcast to all clients except sender
function broadcast(data, exceptClientId) {
    const message = JSON.stringify(data);
    let sent = 0;
    
    clients.forEach((client, id) => {
        if (id !== exceptClientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
            sent++;
        }
    });
    
    if (sent > 0) {
        console.log(`📡 Broadcasted to ${sent} clients`);
    }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ WebSocket server running on ws://localhost:${PORT}`);
    console.log(`📌 HTTP status on http://localhost:${PORT}`);
    console.log('Waiting for connections...\n');
});