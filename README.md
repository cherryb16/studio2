# Trade Insights Pro

Trade Insights Pro is a Next.js starter built with **Firebase Studio**. The app demonstrates
a trading journal that integrates Firebase authentication, SnapTrade brokerage data
and generative AI features.

## Prerequisites

- **Node.js** v18 or newer
- A Firebase project with Email/Password and Google authentication enabled
- SnapTrade API credentials
- The following environment variables:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

SNAPTRADE_CLIENT_ID=...
SNAPTRADE_SECRET=...
SNAPTRADE_REDIRECT_URI=...
```

Create a `.env.local` file in the project root and provide values for the above
variables before running the app.

## Development commands

- `npm run dev` – start the Next.js dev server on port **9003**
- `npm run genkit:dev` – run Genkit flows once
- `npm run genkit:watch` – watch and reload Genkit flows
- `npm run build` – build the application for production
- `npm run start` – start the built app
- `npm run lint` – run ESLint
- `npm run typecheck` – run TypeScript type checks

## Features

- **User Authentication** – secure sign in via Firebase (email/password and Google)
- **Dashboard & Visualization** – portfolio charts and metrics using Recharts and ShadCN
- **Trade Management** – sortable table for adding, editing and deleting trades
- **Journaling with AI** – AI powered prompt suggestions for journal entries via Genkit
- **Brokerage Integration** – connect accounts using SnapTrade to fetch balances and positions

To get started exploring the code, see `src/app/page.tsx` and the components under `src/app`.
