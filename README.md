# Trading Dashboard

This repository contains a real-time crypto derivatives trading dashboard built with React and TypeScript.

## Setup

1. **Backend**: Clone and run the stress-test backend from [socket-custom-load](https://github.com/saxenanickk/socket-custom-load).
   ```bash
   git clone https://github.com/saxenanickk/socket-custom-load.git
   cd socket-custom-load
   npm install
   npm start
   ```

2. **Frontend**:
   ```bash
   cd /path/to/TradingDashboard
   npm install
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

## Architecture
See [ARCHITECTURE.md](./ARCHITECTURE.md) for an overview of the design and performance strategies.

## Notes
- UI mockup is based on the provided wireframe screenshot.
- The application uses a single WebSocket connection to subscribe to multiple channels depending on the focused symbol.

## Available Scripts
- `npm run dev` - start development server
- `npm run build` - build production bundle
- `npm run preview` - preview production build
- `npm run lint` - run eslint


---

This project is the take-home assignment for the real-time trading dashboard evaluation. Follow the architecture document for design decisions and known issues.