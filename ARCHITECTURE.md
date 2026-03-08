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

The order book hook (`useOrderBook`) maintains two sets of state: the raw bid/ask arrays received directly from the websocket and a grouped view derived from them.

### Data flow

1. **WebSocket message** – each `l2_orderbook` payload contains `bids` and `asks` arrays of `[price, size]` strings. The hook parses and sorts them to produce `rawBids` and `rawAsks` (descending/ascending respectively).
2. **Grouping** – when either the raw arrays change or the user selects a new grouping increment, the hook runs `groupLevels`:
   - For each level, compute a bucket price by flooring (bids) or ceiling (asks) the price to the nearest multiple of the increment.
   - Aggregate sizes within each bucket (simple map accumulation).
   - Sort the resulting buckets and compute cumulative sizes.
3. **Derived metrics** – after grouping we compute mid‑price (`(bestBid+bestAsk)/2`), spread (absolute and in basis points), and order book imbalance (total bid volume ÷ total ask volume in the grouped view).
4. **Flash highlights** – the previous grouped arrays are preserved in refs. On each recompute we compare the new bucket sizes to the previous ones; if a bucket’s size changes by ±10 % we record an `up` or `down` flag and apply a CSS animation class for a brief flash.

Grouping increments are symbol‑specific and drawn from a helper in `src/constants.ts`, matching the precision table given in the assignment. The dropdown control in the order book header lets users switch the increment; changing the symbol resets the increment to the first option.

### Performance

Aggregation is O(n) per message where n is the number of raw levels (500 by default). SetTimeout and `useCallback` are used to avoid unnecessary re‑calculations. Flash logic also runs a map lookup per bucket but is bounded by the number of displayed rows (20–50).

Memoization isn’t yet required since the raw data replaces itself on every update; we rely on React’s batched updates to keep renders to a minimum.

## Trade Feed Buffering & Rolling Stats

Trades arrive at high frequency (10–40 ms). Rendering every single one would overwhelm the DOM, so the feed implements a small buffer:

1. **Incoming raw trade** – transformed into a `RawTrade` object containing price, size, side, time string, and notional.
2. **100 ms aggregation window** – trades with identical price and side received within the same 100 ms window are merged into a single `AggTrade` entry, summing size and count.
   - A `pending` array and a `setTimeout` flush ensure updates are batched; React state is updated no faster than 10 Hz.
3. **Rolling statistics** – a sliding window of the last 60 s is kept in a ref; each new raw trade is appended and aged trades are dropped. Buy/sell volumes, count and average size are recalculated incrementally and presented above the feed.

Large trades (notional above a configurable threshold) are highlighted with a bold font and yellow background. A user control allows adjusting the threshold on the fly.

Auto‑scroll is the default; if the user scrolls up a "Jump to latest" button appears. Scrolling back to the bottom re‑enables auto‑scroll.

## Remaining TODO

- Virtualize order book/trade tables to avoid DOM bloating under extreme loads.
- Improve incremental updates for `l2_orderbook` (currently full snapshot each message).
- Add keyboard navigation and persistence of grouping choice.
- Performance benchmarking data (React Profiler traces) to be added.

## Trade Feed Batching & Rolling Stats

- Incoming trades will be buffered for 100 ms windows and merged by price to reduce render frequency.
- A separate rolling statistics module maintains a deque or ring buffer of the past 60 s of trades for computing volume, count, and average size.
- The feed will auto‑scroll unless the user has scrolled up; a "Jump to latest" button will appear when new data arrives during a pause.

## Tradeoffs and Scaling

*To be discussed in final document.*

## Known Issues

- Order book aggregation works and flashes, but there is no throttling when the backend sends full snapshots at 10 ms intervals; in extreme stress the calculations may still overload React. Virtualization is absent and DOM updates may accumulate.
- Raw `l2_orderbook` updates are treated as full snapshots; diffing and applying incremental changes would reduce work.
- Trades are buffered into 100 ms windows but the buffer itself is naive; a more sophisticated approach (e.g. ring buffer or `requestAnimationFrame` batching) could smooth spikes.
- The rolling statistics recompute the entire 60 s window on each trade; this could be optimized with a deque.
- No unit or integration tests have been added yet.
- The UI styling is functional but not pixel‑perfect relative to the screenshot. Group dropdown and stat bar could use icons.
- Connection errors (e.g. backend crash) show only a color change; a user alert/modal would improve UX.
- The threshold control is global per symbol but not saved in localStorage.

These tradeoffs were made to minimise implementation time; a production version would address the above.


---

Future sections will contain performance measurements, profiling notes, and architectural decisions made while under real load.