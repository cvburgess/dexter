import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class WebTransport implements Transport {
  private responseResolve?: (message: JSONRPCMessage) => void;

  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  sessionId?: string;

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  send(message: JSONRPCMessage): Promise<void> {
    this.responseResolve?.(message);
    return Promise.resolve();
  }

  handleMessage(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    const isRequest = "id" in message;

    if (isRequest) {
      return new Promise((resolve) => {
        this.responseResolve = resolve;
        this.onmessage?.(message);
      });
    }

    this.onmessage?.(message);
    return Promise.resolve(null);
  }
}
