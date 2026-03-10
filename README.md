# Company Lookup

Personal Zefix replica with augmented data. Swiss company registry lookup powered by the Zefix PublicREST API.

## Architecture

- **Frontend**: Next.js 16 (App Router) deployed to Vercel
- **Backend**: Firebase (Firestore + Cloud Functions)
- **Shared types**: `@company-lookup/types` package

**Data flow**: `Zefix API -> Firebase Function (scheduled sync) -> Firestore -> Next.js frontend`

## Project Structure

```
company-lookup/
├── apps/web/          # Next.js 16 app
├── packages/types/    # Shared TypeScript types
├── functions/         # Firebase Cloud Functions
├── firebase.json      # Firebase config
└── firestore.rules    # Firestore security rules
```

## Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` inside the `apps/web` directory and fill in values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

3. Start the Next.js dev server:

```bash
npm run dev
```

4. Start Firebase emulators (requires Firebase CLI):

```bash
npm run emulators
```

## Environment Variables

See `.env.example` for all required variables:

- `ZEFIX_*` — Zefix API Basic Auth credentials
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client SDK config
- `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin SDK (server-side)
