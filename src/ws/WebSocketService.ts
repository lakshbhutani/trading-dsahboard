// minimal skeleton for websocket management

export type Channel = 'v2/ticker' | 'ticker' | 'l2_orderbook' | 'all_trades';

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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(url: string) {
    if (this.socket) return;
    this.url = url;
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.notifyStatus('connected');
      this.sendSubscriptions();
    };
    this.socket.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handlers.forEach((h) => {
        try {
          h(msg);
        } catch (e) {
          console.error('[WebSocketService] handler error', e);
        }
      });
    };
    this.socket.onclose = () => {
      this.socket = null;
      this.notifyStatus('disconnected');
      this.reconnect();
    };
    this.socket.onerror = () => {
      // errors are handled in close
    };
  }

  private reconnect() {
    this.notifyStatus('reconnecting');
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.url) this.connect(this.url);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  subscribe(channel: Channel, symbol?: string | string[]) {
    // track subscription state
    const symbols = Array.isArray(symbol) ? symbol : [symbol];
    symbols.forEach(s => {
      if (!this.subs.find(sub => sub.channel === channel && sub.symbol === s)) {
        this.subs.push({ channel, symbol: s });
      }
    });

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscriptions();
    }
  }

  unsubscribe(channel: Channel, symbol?: string | string[]) {
    const symbols = Array.isArray(symbol) ? symbol : [symbol];
    this.subs = this.subs.filter(s => {
      return !(s.channel === channel && symbols.includes(s.symbol));
    });

    if (this.socket?.readyState === WebSocket.OPEN) {
      if (Array.isArray(symbol)) {
        this.sendUnsubscribe(channel, symbol);
      } else if (symbol) {
        this.sendUnsubscribe(channel, [symbol]);
      } else {
        this.sendUnsubscribe(channel);
      }
    }
  }

  private sendSubscriptions() {
    const subsByChannel = this.subs.reduce((acc, s) => {
      if (!acc[s.channel]) acc[s.channel] = [];
      if (s.symbol) acc[s.channel].push(s.symbol);
      return acc;
    }, {} as Record<Channel, string[]>);

    const channels = Object.entries(subsByChannel).map(([name, symbols]) => ({
      name,
      symbols,
    }));

    if (channels.length > 0) {
      this.send({ type: 'subscribe', payload: { channels } });
    }
  }

  private sendUnsubscribe(channel: Channel, symbols: string[] = []) {
    // mirror sendSubscribe: always include symbols array so the server
    // can correctly remove the subscription even when unsubscribing all.
    const payload: any = { channels: [{ name: channel, symbols }] };
    this.send({ type: 'unsubscribe', payload });
  }

  addHandler(fn: MessageHandler) {
    this.handlers.add(fn);
  }

  /**
   * Return current subscribe records (mainly for debugging).
   */
  getSubscriptions() {
    return [...this.subs];
  }

  removeHandler(fn: MessageHandler) {
    this.handlers.delete(fn);
  }

  private send(payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const txt = JSON.stringify(payload);
      this.socket.send(txt);
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
