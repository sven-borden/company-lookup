# Company Lookup Project Context

This project is a Zefix replica for looking up Swiss company registry data, augmented with additional information. It uses a monorepo structure with a Next.js frontend and a Firebase backend.

## Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router) with Tailwind CSS 4, deployed to Vercel.
- **Backend**: Firebase (Firestore, Cloud Functions v2).
- **Shared Package**: `@company-lookup/types` for TypeScript definitions.
- **Data Source**: Swiss Federal Commercial Registry (Zefix) PublicREST API.

### Project Structure

- `apps/web/`: The Next.js 16 web application.
- `functions/`: Firebase Cloud Functions (TypeScript).
- `packages/types/`: Shared TypeScript types and interfaces.
- `firebase.json`: Configuration for Firebase Hosting, Functions, and Emulators.
- `firestore.rules`: Security rules for Firestore.
- `firestore.indexes.json`: Database index definitions.

## Key Data Flow

`Zefix API -> Firebase Function (scheduled sync) -> Firestore -> Next.js frontend`

The `syncZefixData` function in `functions/src/sync/sync.ts` is a scheduled task (every Sunday at 02:00 Zurich time) that:
1.  Initializes the `ZefixClient`.
2.  Syncs reference data (legal forms, communities, registries of commerce).
3.  Iterates through all 26 Swiss cantons to search for and store full company details in Firestore.

## Development & Operations

### Building and Running

- **Install dependencies**: `npm install` (from the root).
- **Frontend development**: `npm run dev` (starts Next.js on port 3001).
- **Firebase Emulators**: `npm run emulators` (starts Firestore and Functions emulators).
- **Build**: `npm run build` (builds the Next.js application).
- **Linting**: `npm run lint`.

### Environment Variables

Required variables (see `.env.example`):
- `ZEFIX_USERNAME`: Basic auth username for Zefix API.
- `ZEFIX_PASSWORD`: Basic auth password for Zefix API.
- `NEXT_PUBLIC_FIREBASE_*`: Client-side Firebase configuration.
- `FIREBASE_CLIENT_EMAIL` & `FIREBASE_PRIVATE_KEY`: Admin SDK credentials for server-side access.

### Development Conventions

- **Monorepo**: Uses NPM workspaces. Add dependencies to specific workspaces using `-w apps/web`, etc.
- **TypeScript**: Strictly typed using the shared `@company-lookup/types` package.
- **Firebase Functions**: Uses v2 Cloud Functions (scheduler, params, etc.).
- **Styling**: Tailwind CSS 4 is used for the frontend.
