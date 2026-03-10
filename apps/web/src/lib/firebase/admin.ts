import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Robust Firebase Admin initialization for Next.js Server Components.
 * Checks for required environment variables and initializes only once.
 */
function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  // Next.js normally loads .env.local into process.env.
  // We'll check if they are present.
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
    
    console.error(`[Firebase Admin] CRITICAL: Missing environment variables: ${missing.join(", ")}`);
    console.log("[Firebase Admin] Current process.env keys:", Object.keys(process.env).filter(k => k.includes("FIREBASE")));
    
    throw new Error(`Firebase Admin SDK: Missing ${missing.join(", ")} in process.env.`);
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("[Firebase Admin] Initialization error:", error);
    throw error;
  }
}

// Ensure the app is initialized before getting Firestore
let adminDb: Firestore;
try {
  const app = getAdminApp();
  adminDb = getFirestore(app);
} catch (e) {
  console.error("[Firebase Admin] Failed to export adminDb:", e);
}

export { adminDb };
