# Bütçe

A personal budgeting app for Turkey: daily safe-to-spend, bills and subscriptions, credit card installments (taksit) and savings goals. Turkish and English, light and dark mode, installable on a phone.

## Features

- **Safe to spend today**: income minus spending, savings and unpaid bills, divided by the days left in the month.
- **Quick entry**: `250 market, 80 taksi, +42000 maaş, 12000 telefon 6 taksit` creates four entries and guesses categories.
- **Bills & subscriptions**: due-date reminders, one tap to mark as paid.
- **Installments (taksit)**: monthly amount, what's left to pay, and the load on the next 6 months. Purchases after the card's statement day start next month.
- **Credit cards**: statement and due dates, estimated statement, limit usage.
- **Category limits** and a comparison with the same point last month.
- **Savings goals**: how much to put aside each month, with a USD equivalent.
- **Backup**: export and restore all data as JSON.

## Run locally

Needs Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for the parser and budget math
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Project structure

```
index.html            page shell
public/               manifest, icons, service worker (offline support)
src/
  main.js             start-up and event wiring
  store.js            data layer — the only file that touches storage
  state.js            in-memory copy of the data + lookups
  model.js            budget math (installments, cards, month totals)
  parser.js           quick-entry text parser
  i18n.js             all interface text (tr / en)
  format.js, utils.js money, dates, numbers
  actions.js          saving, deleting, backup
  forms.js, sheet.js  bottom sheets and forms
  sample.js           sample data
  views/              Overview, Activity, Payments, Goals
  styles.css
tests/                Vitest unit tests
```

## Data

For now, data is stored in the browser's `localStorage` on the device. `src/store.js` is the only place that reads or writes it, with the same `list / insert / update / remove` shape a Supabase client uses, so moving to Supabase (accounts and sync) means replacing that one file.

## Roadmap

- Supabase: sign-in, sync across devices, row-level security
- Deploy on Vercel
- Gemini: receipt photo → expenses, monthly AI summary (`ai.parseReceipt` placeholder in `src/store.js`)
- App Store / Google Play build with Capacitor
