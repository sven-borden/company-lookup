export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { initializeDatabase } = await import("@/lib/db/init");
    await initializeDatabase();
    console.log("[startup] Database initialized");
  } catch (err) {
    console.error("[startup] Database initialization failed:", err);
  }
}
