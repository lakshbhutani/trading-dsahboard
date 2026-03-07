# Architecture Overview

This document outlines the high‑level design of the real‑time trading dashboard. It will grow as features are implemented and performance measurements are made.

## Data Flow

1. **WebSocket Layer**
   - A single `WebSocketService` instance (`src/ws/WebSocketService.ts`) encapsulates the connection to the backend.
   - Subscriptions are represented as `{ channel, symbol? }` objects; the service handles `subscribe`/`unsubscribe` requests and re‑sends them after reconnect.
   - Message handlers can register with `addHandler`/`removeHandler`; messages are JSON‑parsed and dispatched to all handlers.
   - Reconnection uses exponential backoff (cap 30 s) and maintains the last URL used.
   - The service is designed to be agnostic of React, allowing hooks or contexts to wrap it cleanly.

2. **State Management**
   - The top‑level `<App>` component currently holds minimal UI state (focused symbol) and passes data down as props.
   - Future iterations will introduce React Contexts or Zustand/Redux slices to isolate the three domains: tickers, order book and trades.
   - Derived state (e.g. grouped order book levels, spread/imbalance, aggregated trades, rolling statistics) will be computed in custom hooks using `useMemo` and incremental update strategies.
   - Care is taken to prevent unrelated updates from triggering renders in other panels; each hook will have its own internal state and subscription logic.

3. **Component Tree**

```
<App>
 ├─ <ConnectionStatus />        // shows WS connectivity state
 ├─ <TickerBar />              // horizontal bar, subscribes to v2/ticker for all symbols
 └─ <main class="main-panel">
     ├─ <OrderBook />          // left panel; subscribes to l2_orderbook for focused symbol
     └─ <TradesFeed />         // right panel; subscribes to all_trades for focused symbol
```

All components are scoped to `src/components`, with corresponding CSS files keeping styles local and straightforward.

## Performance Strategy

*To be detailed during development; initial considerations include:*

- Memoize computed results to avoid full recompute on every tick.
- Use `useRef` and imperative updates for extremely high‑frequency data to avoid React reconciliation when possible.
- Batch state updates using `unstable_batchedUpdates` or local buffers throttled with `requestAnimationFrame`.
- Virtualize long lists (e.g. orders/trades) using libraries like `react-window` if the DOM grows too large.
- Profile with React DevTools to confirm ticker updates do not re-render order book/trades and vice versa.

## Order Book Aggregation

The grouping pipeline will:

1. Receive raw `l2_orderbook` arrays of price/size updates.
2. Apply a configurable increment based on symbol precision to bucket prices.
3. Sum sizes in each bucket, recompute cumulative sums ascending/descending.
4. Compute spread, mid‑price, and imbalance from the grouped bid/ask arrays.

This will be implemented as a pure function that accepts the raw levels and the current grouping interval; memoization or incremental updates may be used to keep computations cheap.

## Trade Feed Batching & Rolling Stats

- Incoming trades will be buffered for 100 ms windows and merged by price to reduce render frequency.
- A separate rolling statistics module maintains a deque or ring buffer of the past 60 s of trades for computing volume, count, and average size.
- The feed will auto‑scroll unless the user has scrolled up; a "Jump to latest" button will appear when new data arrives during a pause.

## Tradeoffs and Scaling

*To be discussed in final document.*

## Known Issues

- Initial UI is placeholder and does not yet connect to the backend.
- Grouping controls, flash highlights, and large‑trade styling are not yet implemented.


---

Future sections will contain performance measurements, profiling notes, and architectural decisions made while under real load.