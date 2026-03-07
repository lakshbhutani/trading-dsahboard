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

  connect(url: string) {
    if (this.socket) return;
    this.url = url;
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.notifyStatus('connected');
      // re‑subscribe existing
      this.subs.forEach((s) => {
        if (s.channel && s.symbol) {
          this.sendSubscribe(s.channel, [s.symbol]);
        } else if (s.channel) {
          this.sendSubscribe(s.channel);
        }
      });
    };
    this.socket.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handlers.forEach((h) => h(msg));
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
    setTimeout(() => {
      this.reconnectAttempts++;
      if (this.url) this.connect(this.url);
    }, delay);
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  subscribe(channel: Channel, symbol?: string) {
    // track subscription state
    const existing = this.subs.find((s) => s.channel === channel && s.symbol === symbol);
    if (!existing) {
      this.subs.push({ channel, symbol });
    }
    if (this.socket?.readyState === WebSocket.OPEN) {
      if (symbol) this.sendSubscribe(channel, [symbol]);
      else this.sendSubscribe(channel);
    }
  }

  unsubscribe(channel: Channel, symbol?: string) {
    this.subs = this.subs.filter((s) => !(s.channel === channel && s.symbol === symbol));
    if (this.socket?.readyState === WebSocket.OPEN) {
      if (symbol) this.sendUnsubscribe(channel, [symbol]);
      else this.sendUnsubscribe(channel);
    }
  }

  private sendSubscribe(channel: Channel, symbols: string[] = []) {
    const payload: any = { channels: [{ name: channel }] };
    if (symbols.length) payload.channels[0].symbols = symbols;
    this.send({ type: 'subscribe', payload });
  }

  private sendUnsubscribe(channel: Channel, symbols: string[] = []) {
    const payload: any = { channels: [{ name: channel }] };
    if (symbols.length) payload.channels[0].symbols = symbols;
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
      console.debug('[ws] send', txt);
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