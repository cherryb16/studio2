# Trade Insights Pro

This project is a Next.js application configured for Firebase App Hosting. It provides a trading journal and portfolio analysis tool that integrates with Firebase for authentication and SnapTrade for brokerage data.

## Prerequisites

- **Node.js**: version 20 or higher is recommended.
- **Environment variables**: create a `.env` file with the following keys:

```bash
# Public Firebase config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin service account
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# SnapTrade API credentials
SNAPTRADE_CLIENT_ID=
SNAPTRADE_SECRET=
SNAPTRADE_REDIRECT_URI=
```

### Firebase Setup
1. Create a Firebase project and enable Email/Password and Google authentication.
2. Generate a service account key and copy the credentials to the variables above.
3. The `src/lib/firebase.ts` module uses the `NEXT_PUBLIC_` variables to initialize the client SDK, while `src/lib/firebase-admin.ts` uses the Admin credentials for server actions.

### SnapTrade Setup
1. Sign up for the SnapTrade developer program to obtain your `clientId` and `consumerKey`.
2. Set `SNAPTRADE_REDIRECT_URI` to a URL allowed by SnapTrade for OAuth redirects.
3. These variables are consumed in `src/app/actions/snaptrade.ts` to register users and request connection URLs.

## Development Commands

- `npm run dev` – start the Next.js development server on port 9003 with Turbopack.
- `npm run genkit:dev` – run AI flows locally using `genkit`.
- `npm run genkit:watch` – watch mode for AI flows with hot reloading.
- `npm run build` – create a production build.
- `npm start` – start the production server.
- `npm run lint` – run ESLint.
- `npm run typecheck` – perform TypeScript type checking.

## Application Features

Core features are described in `docs/blueprint.md`:

- Secure authentication with Firebase using a custom `useAuth` hook.
- Dashboard with sidebar navigation, metric cards and charts.
- Trades table supporting manual entry, editing and deletion.
- Journal page with entries that can be linked to trades.
- AI-powered assistant that suggests journal prompts based on trade data.
- Brokerage integration via SnapTrade to connect and analyze accounts.

Refer to the source files for implementation details, such as the environment variables used in `src/lib/firebase.ts` and `src/app/actions/snaptrade.ts`.
