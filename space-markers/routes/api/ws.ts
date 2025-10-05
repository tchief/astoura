import { Handlers } from "$fresh/server.ts";

const kv = await Deno.openKv();
const connections = new Map<string, WebSocket>();

export const handler: Handlers = {
  GET(req) {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    
    socket.onopen = async () => {
      connections.set(userId, socket);
      console.log(`User ${userId} connected`);
      
      // Відправити всі існуючі маркери
      const markers: any[] = [];
      const entries = kv.list({ prefix: ["markers"] });
      for await (const entry of entries) {
        markers.push(entry.value);
      }
      
      socket.send(JSON.stringify({
        type: "allMarkers",
        markers,
      }));
    };

    socket.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === "addMarker") {
        // Зберегти маркер в KV
        await kv.set(["markers", data.marker.id], data.marker);
        
        // Відправити всім підключеним користувачам
        const message = JSON.stringify({
          type: "newMarker",
          marker: data.marker,
        });
        
        connections.forEach((ws, id) => {
          if (id !== userId && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        });
      } else if (data.type === "getAllMarkers") {
        const markers: any[] = [];
        const entries = kv.list({ prefix: ["markers"] });
        for await (const entry of entries) {
          markers.push(entry.value);
        }
        
        socket.send(JSON.stringify({
          type: "allMarkers",
          markers,
        }));
      }
    };

    socket.onclose = () => {
      connections.delete(userId);
      console.log(`User ${userId} disconnected`);
    };

    socket.onerror = (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    };

    return response;
  },
};