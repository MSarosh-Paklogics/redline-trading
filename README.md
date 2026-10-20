# FRYE Trading Platform 2.0

A complete, frontend-only client presentation demo in a red, yellow and black trading-terminal theme.

## Open immediately — no installation

Double-click **START-DEMO.cmd**, or open **index.html** in Chrome or Edge. No Node, server, API keys or internet connection is needed for the application.

For the most consistent browser storage behavior, use the local server option below. File-mode storage behavior can vary between browsers. Use the same browser and URL throughout your presentation.

## Optional local server

Requires Node.js 18 or newer. There are no runtime dependencies to install.

```text
cd /d D:\Client_Projects\redline
npm run dev
```

Open **http://127.0.0.1:4173**. Keep the terminal open during the presentation. Press Ctrl+C afterward to stop it. If the port is occupied, check whether the demo is already running there. In PowerShell, use `$env:PORT=4174; npm run dev` to select another port.

Optional build and preview:

```text
npm run check
npm run build
npm run preview
```

The build copies the three static application files into `dist/`. The source also works directly without a build. `npm install` is unnecessary because there are no application dependencies.

## What is included

- Overview: illustrative portfolio curve, market pulse, watchlist, sectors and signals.
- Advanced chart: symbol/timeframe selection, candlesticks, volume, moving averages, wave annotations, level overlays, horizontal drawings, zoom, pan, crosshair and expansion.
- Market X-Ray: trend alignment, breadth, momentum, relative strength, correlations and fictional catalysts.
- Sectors: eleven sectors, day/week/month scenarios and related symbol navigation.
- Strategies: seven playbooks, Elliott degree filters, structural illustrations and monitoring toggles.
- Signals and notifications: signal details, status/search filters, local alert rules and manual event simulation.
- Journal: seeded examples, closed paper trade integration, editable reviews, tags, discipline rating and CSV export.
- Paper trading: $100,000 starting account, long/short market and limit orders, order review, stop/target evaluation, position closure and history.
- Settings: local profile, density, reduced motion, default symbol/timeframe, paper risk reference and reset controls.
- Guided presentation tour, keyboard symbol search with Ctrl/Cmd+K, responsive layouts and accessible dialogs.

## Demo and storage boundaries

All prices, signals, confidence values, wave structures, catalysts and performance statistics are fictional. No real account, feed, broker, external notification service or backend is connected. No real orders are placed. Seed journal examples and the illustrative model portfolio are separate from your paper account.

Browser local storage retains paper activity, journal reviews, watchlists, rules and preferences. If browser storage is unavailable, activity remains only for the session. **Settings → Reset entire demo** restores fixtures. The paper desk also has an account-only reset, which preserves journal reviews.

## CEO walkthrough

Read **DEMO_GUIDE.md**, or click **Presentation tour** on Overview. Start at 100% browser zoom on a laptop or desktop. Screenshots in `screenshots/` provide a backup if screen sharing fails.

## Validation

The app was checked in headless Microsoft Edge at 1440px desktop and 390px mobile widths. All nine routes, chart controls, long/short orders, limit fills, invalid stop validation, journal persistence and deduplication, local notifications, settings persistence and CSV export were exercised. JavaScript syntax and static production build passed.

`qa.cjs` is the developer integration check. It requires Playwright, supplied separately by the development environment, and a running demo on port 4173. Playwright is not needed to use the demo.

## Limitations

This is a presentation prototype, not a production trading system. Charts use custom SVG rendering and illustrative timestamps. Moving averages derive from mock bars; wave counts and market intelligence are hand-authored fixtures. Simulation advances on explicit user action. Orders have no partial fills, leverage, exchange routing, borrowing costs, fees or slippage; see ARCHITECTURE.md for details.

The written handoff was not exposed and the reference website was inaccessible through the fetch tool. Ten original client screenshots were subsequently recovered. The Engine Room, Controls, seven-account preview and Client References gallery preserve their visible engine roles. Six other attachments remain unavailable. See CLIENT_REFERENCE_MAP.md for evidence and scope; reconcile algorithms and contracts against the actual handoff before production work.

## Client reference expansion

Open Engine Room for Engine 22 seven-degree structure, Engine 27 six-degree Trader Intelligence, Engine 26 planning, permission conflict scenarios and the visible engine inventory. Client References contains ten recovered historical screenshots. Controls includes the original seven-account model and a local access-preview toggle. These are presentation simulations, not connected engines. The source and dist builds include reference images.

## Presentation motion

Page entrances, staggered cards, chart reveals, KPI count-ups, dialog transitions and interaction feedback are visual only. They do not change market data or execution state. Motion respects both system reduced-motion preferences and Settings → Reduced motion.

## Pro terminal navigation

The sidebar groups Market Workspace, Intelligence and Trading Desk routes, with lower utility links. The workspace selector opens three working navigation presets. Collapse to an icon rail using the top-right sidebar control; this preference persists locally. Engine Room shows direct structure/intelligence/planner shortcuts. Mobile uses a dismissible navigation drawer. The account footer reads the same simulated ledger as the paper desk.

## Editable chart studies and drawings

Chart toolbar → Indicators opens the study library: two SMAs, EMA, Bollinger Bands, full-window VWAP, Wilder RSI, MACD and volume. Use each study’s settings button to edit its periods and color. RSI and MACD have removable lower panes. Appearance selects candles/line/area, bull/bear colors, grid and volume. Drawings manages labeled, fixed-price horizontal levels per symbol. Double-click the plot to add a level; click a line or use Drawings to edit/delete it. Preferences and levels persist locally; Reset entire demo clears them.

Calculations use all 180 synthetic bars before slicing the visible window. Bollinger Bands use population standard deviation; EMA is initialized at the first mock close, and RSI uses Wilder smoothing. VWAP accumulates the entire mock window without exchange-session resets. These are prototype studies, not a live market analytical service.

## Professional chart terminal

The chart now uses a full-height terminal layout inspired by the supplied screenshot: compact toolbar, drawing rail, large responsive plot, docked watchlist/instrument details and collapsible positions/orders/history drawer. The chart route automatically reduces app navigation to an icon rail and restores it on exit. The top-left menu can expand it. Focus terminal provides an edge-to-edge view (Escape exits). Watchlist toggles the inspector; Buy/Sell and Paper trade open its paper ticket. History inspects an earlier mock window without advancing the simulation. Save view stores the starting symbol/timeframe and chart preferences. Export downloads the main chart as an SVG labeled simulated. All previous studies, color reset and editable fixed-price levels remain available.

## FRYE CORSA visual edition

Motorsport-inspired red/yellow/black surfaces, condensed racing typography, subtle carbon-style textures, a circuit graphic, animated needles and a dedicated Performance Meters route. The overview has four meters and the chart watchlist includes a compact telemetry pair. The full cluster adds trend alignment and setup conviction. Click a meter for its source, meaning and display scale. Capital load derives from open position/pending order notional relative to paper equity; it is not maximum loss or stop-based risk. Other gauges are existing presentation fixtures. Motion respects system and application reduced-motion preferences. There is no affiliation with Ferrari or any third-party car brand.

## REDLINE branding

The visible application wordmark, monogram, browser icon, chart watermark and status/footer branding now use REDLINE. Reusable vector assets are assets/redline-logo.svg and assets/redline-mark.svg. FRYE names remain where they identify the client engine concepts and historical references.

## TP / SL controls

The chart order bar has TP (Take Profit) and SL (Stop Loss) controls. Save direction-specific draft prices, inspect risk/reward, then use Buy or Sell to prefill the paper ticket. Existing paper orders still require explicit review and confirmation. Draft levels and filled-position entry/TP/SL lines appear on the chart, with automatic price-axis fitting. Click a protection line or the TP / SL button beside an open position to edit its protection. Long/short level placement is validated. Drafts are stored per symbol/direction and position protection is stored with the paper ledger. Exits occur only when Advance market evaluates the simulated quote, including any gap beyond the reference price.

## Client-supplied logo

The active logo is the exact uploaded PNG in assets/redline-client-logo.png, used in the expanded/collapsed sidebar, dashboard hero and browser icon. The original image bytes are preserved. Earlier vector concept assets remain in assets/ for reference but are not the active application logo.

## Refined logo and restored circuit banner

The dashboard hero uses the original race-circuit graphic again. The active compact application identity is assets/redline-pro-logo-v2.png, generated with the built-in image-generation tool and preserved with transparency. The uploaded circular badge is retained as a source asset but is no longer displayed in the header or hero. The sidebar header returns to its compact height; the collapsed rail displays the monogram through a CSS viewport of the same asset. The favicon uses the earlier simple red R vector.
