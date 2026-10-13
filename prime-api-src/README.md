# Prime API Integration – Multi-Courier Shipping Demo

Frontend-only prototype of a courier-aggregator checkout: product catalog → cart → checkout → compare
GATI / Xpressbees / Shiprocket rates side by side (lowest price and fastest flagged) → mock AWB →
order confirmation → simulated tracking. All courier rates, AWBs and tracking events are simulated.

Live at `https://leadtracker.primecomputers.co.in/Prime_API_Integration`.

## Run / build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + writes ONE self-contained ../Prime_API_Integration/index.html
```

The built `Prime_API_Integration/index.html` is committed, so the server needs no build step for it
(`git pull` + `pm2 reload`). Rebuild and commit it after any change here; never hand-edit it.

## Structure

```
src/
  main.tsx, App.tsx        entry + hash router + providers
  types.ts, data.ts        types, demo products / courier / stage data
  lib.ts                   formatters, localStorage + hash-route hooks, courier quote builder
  context.tsx              shared app state (cart, orders, draft, toast)
  components/              ui primitives, layout, ProductCard, OrderSummary, Timeline
  pages/                   Home, Products, Cart, Checkout, Shipping, Confirmation, Orders, OrderDetail, Track
```

State (cart, orders, AWBs, tracking progress) persists in the visitor's `localStorage`; use
"Reset demo data" in the footer to clear it.

Developed by Prime Computers.
