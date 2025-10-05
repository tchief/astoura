// Single-file Deno Deploy server with KV watch for real-time multiplayer
// Deploy this file directly to Deno Deploy Playground

const kv = await Deno.openKv();

// HTML client embedded in server
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KV Watch Multiplayer Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 2em;
        }
        .status {
            text-align: center;
            padding: 10px 20px;
            border-radius: 20px;
            margin-bottom: 20px;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .status.connected {
            background: linear-gradient(135deg, #56ab2f, #a8e063);
            color: white;
        }
        .status.connecting {
            background: linear-gradient(135deg, #f2994a, #f2c94c);
            color: white;
        }
        .status.disconnected {
            background: linear-gradient(135deg, #eb3349, #f45c43);
            color: white;
        }
        .controls {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 15px;
            margin-bottom: 30px;
        }
        input[type="text"] {
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button {
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        button:active {
            transform: translateY(0);
        }
        .messages {
            max-height: 400px;
            overflow-y: auto;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .message {
            padding: 12px 15px;
            margin-bottom: 10px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .message .author {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .message .text {
            color: #333;
        }
        .message .time {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
        }
        .users {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
        }
        .user {
            padding: 8px 15px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 20px;
            font-size: 14px;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .info {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 20px;
        }
        .counter {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 KV Watch Real-Time Demo</h1>
        
        <div id="status" class="status connecting">⏳ Підключення...</div>
        
        <div class="controls">
            <input type="text" id="nameInput" placeholder="Ваше ім'я..." maxlength="20">
            <button onclick="setName()">Встановити</button>
        </div>
        
        <div class="controls">
            <input type="text" id="messageInput" placeholder="Введіть повідомлення..." maxlength="200">
            <button onclick="sendMessage()">Надіслати</button>
        </div>
        
        <div class="counter" id="counter">Повідомлень: 0</div>
        
        <div class="users" id="users"></div>
        
        <div class="messages" id="messages">
            <div style="text-align: center; color: #999;">Очікування повідомлень...</div>
        </div>
        
        <div class="info">
            ID: <span id="userId">-</span> | 
            Використовується Deno KV Watch для real-time синхронізації
        </div>
    </div>

    <script>
        // Generate unique user ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        document.getElementById('userId').textContent = userId;
        
        let userName = localStorage.getItem('userName') || 'Анонім';
        let eventSource = null;
        let messageCount = 0;
        const messages = [];
        const users = new Map();
        
        // Load saved name
        document.getElementById('nameInput').value = userName;
        
        // Setup EventSource for real-time updates
        function connect() {
            const status = document.getElementById('status');
            status.className = 'status connecting';
            status.textContent = '⏳ Підключення...';
            
            eventSource = new EventSource('/sse');
            
            eventSource.onopen = () => {
                console.log('SSE connected');
                status.className = 'status connected';
                status.textContent = '🟢 Підключено в реальному часі';
                
                // Send user presence
                sendPresence();
            };
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Received:', data);
                    
                    switch(data.type) {
                        case 'message':
                            addMessage(data);
                            break;
                        case 'presence':
                            updateUser(data);
                            break;
                        case 'counter':
                            updateCounter(data.count);
                            break;
                    }
                } catch(err) {
                    console.error('Parse error:', err);
                }
            };
            
            eventSource.onerror = (err) => {
                console.error('SSE error:', err);
                status.className = 'status disconnected';
                status.textContent = '🔴 Розірвано - перепідключення...';
                
                // Reconnect after 3 seconds
                setTimeout(connect, 3000);
            };
        }
        
        // Add message to UI
        function addMessage(data) {
            const container = document.getElementById('messages');
            
            // Clear placeholder
            if (container.querySelector('div[style]')) {
                container.innerHTML = '';
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.innerHTML = \`
                <div class="author">\${data.userName || 'Анонім'}</div>
                <div class="text">\${data.text}</div>
                <div class="time">\${new Date(data.timestamp).toLocaleTimeString()}</div>
            \`;
            
            container.insertBefore(messageDiv, container.firstChild);
            
            // Keep only last 50 messages
            while (container.children.length > 50) {
                container.removeChild(container.lastChild);
            }
            
            messages.unshift(data);
        }
        
        // Update user presence
        function updateUser(data) {
            users.set(data.userId, {
                name: data.userName,
                lastSeen: Date.now()
            });
            
            renderUsers();
        }
        
        // Update counter
        function updateCounter(count) {
            messageCount = count;
            document.getElementById('counter').textContent = \`Повідомлень: \${count}\`;
        }
        
        // Render active users
        function renderUsers() {
            const container = document.getElementById('users');
            container.innerHTML = '';
            
            // Remove inactive users (not seen for 30 seconds)
            const now = Date.now();
            for (const [id, user] of users.entries()) {
                if (now - user.lastSeen > 30000) {
                    users.delete(id);
                }
            }
            
            // Show active users
            for (const [id, user] of users.entries()) {
                const userDiv = document.createElement('div');
                userDiv.className = 'user';
                userDiv.textContent = user.name + (id === userId ? ' (Ви)' : '');
                container.appendChild(userDiv);
            }
        }
        
        // Send message
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const text = input.value.trim();
            
            if (!text) return;
            
            try {
                const response = await fetch('/api/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        userName,
                        text,
                        timestamp: Date.now()
                    })
                });
                
                if (response.ok) {
                    input.value = '';
                    input.focus();
                }
            } catch(err) {
                console.error('Send error:', err);
            }
        }
        
        // Send presence
        async function sendPresence() {
            try {
                await fetch('/api/presence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        userName,
                        timestamp: Date.now()
                    })
                });
            } catch(err) {
                console.error('Presence error:', err);
            }
        }
        
        // Set user name
        function setName() {
            const input = document.getElementById('nameInput');
            userName = input.value.trim() || 'Анонім';
            localStorage.setItem('userName', userName);
            sendPresence();
        }
        
        // Enter key handling
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        document.getElementById('nameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                setName();
            }
        });
        
        // Send presence every 20 seconds
        setInterval(sendPresence, 20000);
        
        // Start connection
        connect();
    </script>
</body>
</html>`;

// Store active SSE connections
const sseClients = new Set<ReadableStreamDefaultController>();

// Broadcast to all SSE clients
function broadcast(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);
  
  for (const client of sseClients) {
    try {
      client.enqueue(encoded);
    } catch {
      // Client disconnected
      sseClients.delete(client);
    }
  }
}

// Watch for KV changes
async function watchKV() {
  const watch = kv.watch([["messages", "stream"]]);
  
  for await (const entries of watch) {
    for (const entry of entries) {
      if (entry.value) {
        // Broadcast new message to all clients
        broadcast({
          type: "message",
          ...entry.value
        });
      }
    }
  }
}

// Start watching (only works locally, not on Deno Deploy yet)
if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
  watchKV().catch(console.error);
}

// Main server
Deno.serve({ port: 8001 }, async (req: Request) => {
  const url = new URL(req.url);
  
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Serve HTML
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(HTML_CONTENT, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  
  // Server-Sent Events endpoint
  if (url.pathname === "/sse") {
    const stream = new ReadableStream({
      start(controller) {
        // Add client to set
        sseClients.add(controller);
        
        // Send initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: {"type":"connected"}\n\n`));
        
        // Keep-alive ping every 30 seconds
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`:ping\n\n`));
          } catch {
            clearInterval(pingInterval);
            sseClients.delete(controller);
          }
        }, 30000);
        
        // Send current message count
        kv.get(["counter", "messages"]).then(result => {
          const count = result.value || 0;
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "counter", count })}\n\n`
          ));
        });
        
        // Load recent messages
        kv.list({ prefix: ["messages"], limit: 10 }).then(async entries => {
          const messages = [];
          for await (const entry of entries) {
            if (entry.key[1] !== "stream") {
              messages.push(entry.value);
            }
          }
          
          // Send recent messages
          messages.reverse().forEach(msg => {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "message", ...msg })}\n\n`
            ));
          });
        });
      },
      
      cancel() {
        sseClients.delete(controller);
      }
    });
    
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
  
  // API: Send message
  if (url.pathname === "/api/message" && req.method === "POST") {
    const message = await req.json();
    message.id = crypto.randomUUID();
    message.timestamp = Date.now();
    
    // Store message
    await kv.set(["messages", message.id], message);
    
    // Update stream trigger for watchers
    await kv.set(["messages", "stream"], message);
    
    // Update counter
    const counterResult = await kv.get(["counter", "messages"]);
    const newCount = ((counterResult.value as number) || 0) + 1;
    await kv.set(["counter", "messages"], newCount);
    
    // Broadcast to all clients (fallback for Deploy where watch doesn't work)
    broadcast({ type: "message", ...message });
    broadcast({ type: "counter", count: newCount });
    
    return new Response(JSON.stringify({ success: true, id: message.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // API: Send presence
  if (url.pathname === "/api/presence" && req.method === "POST") {
    const presence = await req.json();
    
    // Store user presence with TTL
    await kv.set(
      ["users", presence.userId],
      presence,
      { expireIn: 30000 } // 30 seconds TTL
    );
    
    // Broadcast presence to all clients
    broadcast({ type: "presence", ...presence });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // API: Get messages
  if (url.pathname === "/api/messages" && req.method === "GET") {
    const messages = [];
    const entries = kv.list({ prefix: ["messages"], limit: 100 });
    
    for await (const entry of entries) {
      if (entry.key[1] !== "stream") {
        messages.push(entry.value);
      }
    }
    
    return new Response(JSON.stringify(messages), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  return new Response("Not Found", { status: 404 });
});