// minimal skeleton for websocket management

export type Channel = 'v2/ticker' | 'l2_orderbook' | 'all_trades';

interface Subscription {
  channel: Channel;
  symbol?: string;
}

type MessageHandler = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private subs: Subscription[] = [];
  private reconnectAttempts = 0;
  private statusHandlers: Set<(status: 'connected' | 'reconnecting' | 'disconnected') => void> = new Set();

  connect(url: string) {
    if (this.socket) return;
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.notifyStatus('connected');
      this.send({ op: 'ping' });
      this.subs.forEach((s) => this.send({ op: 'subscribe', channel: s.channel, symbol: s.symbol }));
    };
    this.socket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      this.handlers.forEach((h) => h(msg));
    };
    this.socket.onclose = () => {
      this.socket = null;
      this.notifyStatus('disconnected');
      this.reconnect();
    };
    this.socket.onerror = () => {
      // short circuit; will close eventually
    };
  }

  private reconnect() {
    this.notifyStatus('reconnecting');
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(this.url!);
    }, delay);
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  subscribe(channel: Channel, symbol?: string) {
    this.subs.push({ channel, symbol });
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ op: 'subscribe', channel, symbol });
    }
  }

  unsubscribe(channel: Channel, symbol?: string) {
    this.subs = this.subs.filter((s) => !(s.channel === channel && s.symbol === symbol));
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ op: 'unsubscribe', channel, symbol });
    }
  }

  addHandler(fn: MessageHandler) {
    this.handlers.add(fn);
  }

  removeHandler(fn: MessageHandler) {
    this.handlers.delete(fn);
  }

  private send(payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  // keep track of url for reconnect
  private url: string | null = null;

  addStatusHandler(fn: (status: 'connected' | 'reconnecting' | 'disconnected') => void) {
    this.statusHandlers.add(fn);
  }

  removeStatusHandler(fn: (status: 'connected' | 'reconnecting' | 'disconnected') => void) {
    this.statusHandlers.delete(fn);
  }

  private notifyStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
    this.statusHandlers.forEach((h) => h(status));
  }
}

export const wsService = new WebSocketService();
