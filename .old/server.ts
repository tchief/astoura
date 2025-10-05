// Deno Deploy server with KV storage for multiplayer
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

// Store active SSE connections
const connections = new Map<string, ReadableStreamDefaultController>();

// Clean old messages periodically
async function cleanOldMessages() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const messages = kv.list({ prefix: ["messages"] });
  
  for await (const entry of messages) {
    const msg = entry.value as any;
    if (msg.timestamp < fiveMinutesAgo) {
      await kv.delete(entry.key);
    }
  }
}

// Clean every minute
setInterval(cleanOldMessages, 60000);

// Watch for KV changes and notify clients
async function watchMessages() {
  const stream = kv.watch([["messages", "latest"]]);
  
  for await (const entries of stream) {
    // Get the latest message
    const latestEntry = entries[0];
    if (latestEntry && latestEntry.value) {
      // Send to all connected SSE clients
      const message = JSON.stringify({
        type: "message",
        data: latestEntry.value
      });
      
      for (const [id, controller] of connections.entries()) {
        try {
          controller.enqueue(`data: ${message}\n\n`);
        } catch (e) {
          // Remove closed connections
          connections.delete(id);
        }
      }
    }
  }
}

// Start watching (only in Deno runtime, not in Deploy)
if (typeof Deno !== 'undefined' && Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
  watchMessages();
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  
  // Server-Sent Events endpoint for real-time updates
  if (url.pathname === "/api/events") {
    const clientId = crypto.randomUUID();
    
    const stream = new ReadableStream({
      start(controller) {
        // Store the connection
        connections.set(clientId, controller);
        
        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);
        
        // Keep alive interval
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(`:ping\n\n`);
          } catch (e) {
            clearInterval(keepAlive);
            connections.delete(clientId);
          }
        }, 30000);
        
        // Clean up on close
        req.signal.addEventListener("abort", () => {
          clearInterval(keepAlive);
          connections.delete(clientId);
        });
      },
      
      cancel() {
        connections.delete(clientId);
      }
    });
    
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
  
  // API endpoints
  if (url.pathname === "/api/messages") {
    if (req.method === "GET") {
      // Get recent messages
      const since = Number(url.searchParams.get("since") || "0");
      const messages = [];
      
      const entries = kv.list({ prefix: ["messages"] });
      for await (const entry of entries) {
        const msg = entry.value as any;
        if (msg.timestamp > since) {
          messages.push(msg);
        }
      }
      
      // Sort by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Keep only last 100 messages
      const recentMessages = messages.slice(-100);
      
      return new Response(JSON.stringify(recentMessages), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    
    if (req.method === "POST") {
      // Add new message
      const message = await req.json();
      message.timestamp = Date.now();
      message.id = crypto.randomUUID();
      
      // Store in KV with timestamp as key for ordering
      await kv.set(["messages", message.timestamp.toString(), message.id], message);
      
      // Also store as latest for watch
      await kv.set(["messages", "latest"], message);
      
      // Broadcast to SSE clients
      const sseMessage = JSON.stringify({
        type: "message",
        data: message
      });
      
      for (const [id, controller] of connections.entries()) {
        try {
          controller.enqueue(`data: ${sseMessage}\n\n`);
        } catch (e) {
          connections.delete(id);
        }
      }
      
      return new Response(JSON.stringify({ success: true, id: message.id }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  }
  
  if (url.pathname === "/api/users") {
    if (req.method === "POST") {
      // Update user presence
      const user = await req.json();
      user.lastSeen = Date.now();
      
      // Store user data with 30 second expiration
      await kv.set(["users", user.id], user, { expireIn: 30000 });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    
    if (req.method === "GET") {
      // Get active users
      const users = [];
      const entries = kv.list({ prefix: ["users"] });
      
      for await (const entry of entries) {
        users.push(entry.value);
      }
      
      return new Response(JSON.stringify(users), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  }
  
  // Serve the HTML file
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await Deno.readTextFile("./index.html");
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }
  
  return new Response("Not Found", { status: 404 });
}, { port: 8000 });