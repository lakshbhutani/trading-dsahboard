# Architecture & Design Document

This document provides a high-level overview of the real-time trading dashboard's architecture, performance strategies, and technical tradeoffs.

## 1. Architecture Overview

The application is designed around a reactive data flow, where data originates from a single WebSocket connection and is processed through specialized hooks before being rendered by UI components.

### Data Flow Diagram

```text
  [ WebSocket Server ]
           |
           | (Single persistent connection)
           v
 [ WebSocketService (Singleton) ]
   - Manages connection, subscriptions, and reconnection.
   - Broadcasts all incoming JSON messages to registered handlers.
           |
           | (Raw JSON messages)
           v
 [ Custom Hooks (useOrderBook, useTrades, useTickers) ]
   - Each hook registers as a handler with WebSocketService.
   - Filters messages relevant to its domain (e.g., 'l2_orderbook').
   - Subscribes/unsubscribes to channels based on the focused symbol.
   - Processes, aggregates, and throttles data.
   - Manages its own state (e.g., grouped levels, aggregated trades).
           |
           | (Processed & throttled data as props)
           v
 [ React Components (OrderBook, TradesFeed, TickerBar) ]
   - Purely presentational, receive data via props.
   - Memoized (`React.memo`) to prevent unnecessary re-renders.
   - Emit user events (e.g., onGroupChange) back up to the App/hooks.
```

### Layers

1.  **WebSocket Layer (`WebSocketService.ts`)**: A singleton service that establishes and maintains a single, persistent WebSocket connection. It multiplexes all channel subscriptions (`l2_orderbook`, `all_trades`, `v2/ticker`) over this connection and handles automatic reconnection with exponential backoff. It is framework-agnostic and uses a simple handler pattern (`addHandler`/`removeHandler`) to dispatch raw messages.

2.  **State Management & Logic (Custom Hooks)**: Responsibility is decentralized into domain-specific hooks. `useOrderBook` subscribes to the order book for the focused symbol, processes raw levels, and computes derived stats. `useTrades` subscribes to the trade feed, implementing buffering and aggregation. This isolates concerns, ensuring that an update to the trade feed does not trigger a re-render in the order book panel.

3.  **Component Tree (`App.tsx`, `components/`)**: The UI is composed of functional components. The main `App` component orchestrates the data flow, passing the focused symbol to the hooks and forwarding the processed data from hooks down to the presentational components.

## 2. Performance Strategy

The primary performance challenge is handling high-frequency updates from the WebSocket without freezing the UI. The strategy is to minimize the work done on the main thread and reduce the frequency of React re-renders.

*   **Problem 1: High-Frequency Order Book Updates**
    *   **Observation**: The `l2_orderbook` channel sends full snapshots every 50-100ms. Processing (grouping, calculating stats, computing flashes) and re-rendering on every message would cause significant UI jank.
    *   **Optimization**: We use `requestAnimationFrame` (rAF) for throttling in `useOrderBook`. This strategy synchronizes our updates with the browser's rendering cycle.
        *   **Frame Budget**: On a standard 60Hz display, the browser has approximately 16ms to complete all work for a single frame.
        *   **Buffering**: When a WebSocket message arrives, the raw data is stored in a `useRef` without triggering a React render.
        *   **Scheduling**: We then call `requestAnimationFrame(throttledUpdate)`. A `useRef` acts as a lock, ensuring that this is only called once per frame. If multiple messages arrive within the same 16ms window, only the first one schedules an update; the subsequent ones only update the data in the buffer.
        *   **Coalescing**: At the start of the next frame, the browser executes `throttledUpdate`. This single function call processes the *most recent* data from the buffer, performs all expensive calculations, and updates React state once. This coalesces multiple data updates into a single processing and rendering cycle, effectively capping updates to the browser's paint rate.

*   **Problem 2: High-Velocity Trade Feed**
    *   **Observation**: The `all_trades` channel can push new trades every 10-40ms. Rendering each one individually is inefficient and creates an unreadable, flickering UI.
    *   **Optimization**: We use a **Buffer and Batch** strategy in `useTrades`.
        1.  **Buffering**: Incoming trades are collected in a `useRef` array (`pendingTradesRef`) without triggering state changes.
        2.  **Batching**: A `setTimeout` of 100ms (`AGG_WINDOW_MS`) is used to flush the buffer.
        3.  **Aggregation**: During the flush, trades within the 100ms window that share the same price and side are merged, reducing the number of new rows to be rendered. This throttles UI updates to a maximum of 10Hz.

*   **Problem 3: Expensive Rolling Stats**
    *   **Observation**: Calculating the 60-second rolling trade statistics on every new trade or even every 100ms batch is wasteful.
    *   **Optimization**: The stats calculation was moved into its own `setInterval` loop running once per second in `useTrades`. This decouples it from the high-frequency data ingestion path and ensures stats decay correctly even when trading activity stops.

### Why Different Throttling Strategies?

The decision to use `requestAnimationFrame` for the order book and a `setTimeout`-based batching system for the trade feed is a critical distinction based on their different data requirements:

-   **Order Book (State-based):** The order book represents the *current state* of market depth. We only care about the most recent snapshot. `rAF` excels here by coalescing multiple updates within a single render frame, discarding intermediate states and only processing the very latest data. This guarantees we render the most up-to-date information possible without doing wasteful work on stale data.

-   **Trades Feed (Event-based):** The trade feed is a stream of *discrete events*. Every trade is important and must be accounted for. Simply discarding trades would be incorrect. The "Buffer and Batch" approach using `setTimeout` allows us to collect all events over a short window (100ms), aggregate them for efficiency and readability (e.g., merging trades at the same price), and then render them in a single, less frequent batch. This prevents UI flicker and makes the stream of data digestible for the user.

In short:

- **`rAF` (Order Book):** Ideal for rendering the **latest state** of continuous data.
- **`setTimeout` Batching (Trades):** Ideal for processing a **stream of discrete events** without losing any.

## 3. Order Book Grouping

The aggregation pipeline is implemented in the `groupLevels` function within `useOrderBook.ts`.

1.  **Bucketing**: It iterates over the raw price levels. For each level, it determines a "bucket" price by rounding to the nearest multiple of the user-selected grouping increment. Bids are rounded down (`Math.floor`) and asks are rounded up (`Math.ceil`) to ensure the spread is never artificially crossed.
2.  **Aggregation**: A `Map` is used to aggregate the total size for each bucketed price. This is an efficient O(N) operation.
3.  **Finalization**: The `Map` is converted back into an array, sorted correctly (bids descending, asks ascending), and a final pass is made to compute the cumulative size for each level.

This approach was chosen for its simplicity and performance. It avoids complex data structures and completes the entire aggregation in a single pass over the data, making it fast enough to run inside the `rAF` callback.

## 4. Tradeoffs & Technical Debt

*   **What would be done differently in production?**
    *   **Web Workers**: The most significant improvement would be to move all WebSocket communication and data processing (grouping, aggregation, stats) into a Web Worker. This would completely isolate the main UI thread from this heavy work, guaranteeing a responsive UI even under extreme market volatility. The hooks would simply `postMessage` to the worker and listen for processed results.
    *   **List Virtualization**: Both the `OrderBook` and `TradesFeed` would be implemented with a virtualization library (e.g., `TanStack Virtual`). While the current DOM size is manageable, virtualization is essential for ensuring consistent performance on lower-end devices and preventing memory issues with very long-running sessions.
    *   **State Management**: For an application with more shared state, I would introduce a formal state manager like Zustand to avoid prop drilling the `focused` symbol and connection status.

*   **What was simplified?**
    *   **Styling & UX**: The UI is functional but lacks the polish of a production application. Error handling is minimal (a status indicator, but no modals).
    *   **Testing**: The project has no unit or integration tests. This was a major shortcut to save time, but it increases the risk of regressions during future development.

*   **Existing Tech Debt**
    *   The `useOrderBook` hook processes full snapshots on every message. A more efficient implementation would apply deltas if the backend API supported it.
    *   The rolling stats calculation in `useTrades` filters the entire 60-second window every second. A more optimal data structure like a deque or ring buffer would allow for O(1) updates.

## 5. Scaling Question

**If we needed 50 symbols with full orderbook + trades for each, what breaks first and how would you redesign?**

**What Breaks First: The Main UI Thread.**

The current architecture, where each hook in the main thread processes data, would collapse. The CPU would be overwhelmed.

1.  **JavaScript Execution**: Even with throttling, the sheer volume of messages for 100 subscriptions (50 order books, 50 trade feeds) would saturate the main thread. The `WebSocketService` would be dispatching to hundreds of handlers, and the combined processing load from all active `useOrderBook` and `useTrades` instances would cause extreme lag and make the UI unresponsive.
2.  **Memory Pressure**: Storing 50 full order books and 50 trade histories (500 items each) directly in React state would consume a significant amount of RAM, leading to poor performance and potential browser crashes.

**Redesign for Scale:**

The solution is to aggressively move work off the main thread, adopting a **View/Worker** architecture.

1.  **Centralize in a Web Worker**: A single Web Worker would be responsible for the `WebSocketService` connection and all data processing. It would subscribe to all 50 symbols and maintain the "source of truth" for all data (order books, trades, stats) in its own memory space.
2.  **Data on Demand for the UI**: The React application would **not** hold data for all 50 symbols. The `useOrderBook` and `useTrades` hooks would be modified. When mounted, they would `postMessage` to the worker, requesting data for their specific `symbol`. The worker would then start pushing processed, throttled data for that symbol back to the main thread.
3.  **Intelligent Subscriptions**: When the user switches the focused symbol, the old hooks unmount and send a message to the worker to *stop* sending data for the old symbol, while the new hooks request data for the new one. The worker itself would keep the underlying WebSocket subscription active.
4.  **Shared Data**: For components like the `TickerBar` that need a summary of all symbols, the worker would compute this summary and push a single, throttled array to the main thread, instead of having the main thread process 50 individual ticker updates.

This design ensures the main thread is only concerned with rendering what is currently visible, while the heavy lifting is handled concurrently in the background.

## 6. Known Issues

- **No List Virtualization**: The `OrderBook` and `TradesFeed` render a fixed number of DOM nodes. Performance will degrade on low-end devices or if the number of visible rows is increased significantly.
- **Inefficient Stats Calculation**: The 60-second rolling stats in `useTrades` re-calculates from the full window every second instead of using a more efficient data structure like a deque for incremental updates.
- **No Unit/Integration Tests**: The lack of a test suite makes the codebase fragile and difficult to refactor with confidence.

## 7. Recent Performance Findings & Optimizations

During profiling, a few critical performance bottlenecks were identified and resolved:

- **Render Leakage (Root Cause: Top-Level State):** Initially, real-time hooks (`useTickers`, `useTrades`, `useOrderBook`) were called inside `App.tsx`. Every WebSocket message triggered a top-level state update, causing the entire component tree (including isolated panels) to re-render needlessly. 
  - *Fix:* State was strictly co-located by extracting hooks into dedicated wrapper components. We also implemented strict value-equality bailouts in state setters (e.g., `setStats`) to completely cancel render cycles if the newly calculated data hadn't mathematically changed.
- **DOM Thrashing in Order Book (Root Cause: Entity-based Keys):** Using `key={price}` for order book rows caused React to aggressively destroy and recreate DOM nodes whenever prices shifted.
  - *Fix:* Switched to `key={idx}` for the fixed 25-row layout. This treats the UI as stable "slots," allowing React to bypass node creation and strictly mutate text content, drastically increasing frame rates.
- **JS Heap & GC Spikes (Root Cause: High-Frequency Allocations):** The `useTrades` hook was generating unique React keys via `Math.random()` and allocating new `Map` and `Array` objects on every 100ms flush cycle, putting immense pressure on the Garbage Collector.
  - *Fix:* Replaced expensive random string generation with a zero-cost auto-incrementing integer (`nextTradeId++`). Memory allocations were neutralized by persisting a module-level `Map` (reset via `.clear()`) and mutating arrays directly (via `.length = 0`).
