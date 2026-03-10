# Company Lookup — Claude Code Instructions

Swiss company registry lookup app. Monorepo powered by Zefix PublicREST API.

## Architecture

- **Frontend**: `apps/web/` — Next.js 16 (App Router), Tailwind CSS 4, deployed to Vercel
- **Backend**: Firebase (Firestore + Cloud Functions v2)
- **Shared types**: `packages/types/` — `@company-lookup/types`
- **Functions**: `functions/src/` — scheduled Zefix sync, Zefix API client

**Data flow**: `Zefix API → Firebase Function (scheduled sync) → Firestore → Next.js frontend`

## Dev Commands (run from monorepo root)

```bash
npm install          # install all workspaces
npm run dev          # Next.js on port 3001
npm run emulators    # Firebase Firestore + Functions emulators
npm run build        # build web app
npm run lint         # lint
```

## Environment Setup

Next.js only loads `.env.local` from its own app directory.

- **Required file**: `apps/web/.env.local` (not `/.env.local`)
- Copy from root `.env.local` or `.env.example` and fill in Admin SDK credentials
- `FIREBASE_PRIVATE_KEY` must be quoted and use `\n` literal escapes (Next.js handles the replace)

### Required vars

```
ZEFIX_USERNAME / ZEFIX_PASSWORD / ZEFIX_API_BASE_URL
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID
FIREBASE_CLIENT_EMAIL        # from service account JSON
FIREBASE_PRIVATE_KEY         # from service account JSON (quoted, with \n)
```

Service account JSON files matching `*-firebase-adminsdk-*.json` are gitignored — never commit them.

## Firebase Setup Checklist (new environment)

1. Enable Cloud Firestore API in Google Cloud Console
2. Create the Firestore database in Firebase Console (`/firestore → Create database`)
3. Select region (e.g. `europe-west6` for Switzerland)

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/firebase/admin.ts` | Firebase Admin SDK init (server-side) |
| `apps/web/src/lib/data/companies.ts` | Firestore queries |
| `apps/web/src/app/search/page.tsx` | Search results page |
| `apps/web/src/app/company/[uid]/page.tsx` | Company detail page |
| `functions/src/zefix/client.ts` | Zefix API client |
| `functions/src/sync/sync.ts` | Scheduled weekly sync |

## Styling

"Swiss Modern" aesthetic — see `docs/Branding.md` for full guide. Key points:
- Geist Sans/Mono typefaces, no rounded corners (max 4–8px radius)
- Monochromatic palette + single accent: `red-600` (light) / `red-500` (dark)
- No shadows, no gradients; borders via `zinc-200`/`zinc-800`
