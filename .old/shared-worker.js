// Shared Worker for multiplayer sync
let connections = [];
let messages = [];

self.onconnect = function(e) {
    const port = e.ports[0];
    connections.push(port);
    
    console.log('New connection, total:', connections.length);
    
    port.onmessage = function(event) {
        const data = event.data;
        console.log('Worker received:', data);
        
        if (data.type === 'broadcast') {
            // Add to messages
            messages.push(data.message);
            
            // Keep only last 100 messages
            if (messages.length > 100) {
                messages = messages.slice(-50);
            }
            
            // Send to all other connections
            connections.forEach(conn => {
                if (conn !== port) {
                    try {
                        conn.postMessage({
                            type: 'message',
                            data: data.message
                        });
                    } catch(e) {
                        // Connection might be closed
                    }
                }
            });
        } else if (data.type === 'getHistory') {
            // Send recent messages
            port.postMessage({
                type: 'history',
                messages: messages.slice(-20)
            });
        }
    };
    
    port.start();
};