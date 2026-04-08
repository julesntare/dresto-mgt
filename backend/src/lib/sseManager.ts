import { Response } from "express";
import { randomUUID } from "crypto";

interface SSEClient {
  id: string;
  res: Response;
  userId: string;
  role: string;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(res: Response, userId: string, role: string): string {
    const clientId = randomUUID();
    this.clients.set(clientId, { id: clientId, res, userId, role });
    return clientId;
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
  }

  broadcast(event: string, data: unknown, roles?: string[]) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    console.log(`[SSE] Broadcasting "${event}" to ${this.clients.size} client(s)`);
    for (const client of this.clients.values()) {
      if (!roles || roles.includes(client.role)) {
        try {
          client.res.write(payload);
          // Force flush — bypass Nagle's algorithm
          (client.res as any).flush?.();
        } catch (err) {
          console.log(`[SSE] Client ${client.id} write failed, removing`);
          this.clients.delete(client.id);
        }
      }
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
