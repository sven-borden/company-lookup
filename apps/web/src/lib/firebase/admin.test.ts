import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCert, mockInitializeApp, mockGetApps, mockGetApp, mockGetFirestore } = vi.hoisted(
  () => ({
    mockCert: vi.fn().mockReturnValue({ type: "cert" }),
    mockInitializeApp: vi.fn().mockReturnValue({ name: "[DEFAULT]" }),
    mockGetApps: vi.fn().mockReturnValue([]),
    mockGetApp: vi.fn().mockReturnValue({ name: "[DEFAULT]" }),
    mockGetFirestore: vi.fn().mockReturnValue({}),
  })
);

vi.mock("firebase-admin/app", () => ({
  initializeApp: mockInitializeApp,
  getApps: mockGetApps,
  cert: mockCert,
  getApp: mockGetApp,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: mockGetFirestore,
}));

const VALID_ENV = {
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "my-project",
  FIREBASE_CLIENT_EMAIL: "sa@my-project.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nMIIE\\n-----END RSA PRIVATE KEY-----",
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mockGetApps.mockReturnValue([]);
  mockInitializeApp.mockReturnValue({ name: "[DEFAULT]" });
  mockCert.mockReturnValue({ type: "cert" });
  mockGetApp.mockReturnValue({ name: "[DEFAULT]" });
  mockGetFirestore.mockReturnValue({});

  // Clear env
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Firebase Admin init", () => {
  it("exports undefined adminDb when NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing", async () => {
    process.env.FIREBASE_CLIENT_EMAIL = VALID_ENV.FIREBASE_CLIENT_EMAIL;
    process.env.FIREBASE_PRIVATE_KEY = VALID_ENV.FIREBASE_PRIVATE_KEY;

    const { adminDb } = await import("./admin");
    expect(adminDb).toBeUndefined();
  });

  it("exports undefined adminDb when FIREBASE_CLIENT_EMAIL is missing", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = VALID_ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    process.env.FIREBASE_PRIVATE_KEY = VALID_ENV.FIREBASE_PRIVATE_KEY;

    const { adminDb } = await import("./admin");
    expect(adminDb).toBeUndefined();
  });

  it("exports undefined adminDb when FIREBASE_PRIVATE_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = VALID_ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    process.env.FIREBASE_CLIENT_EMAIL = VALID_ENV.FIREBASE_CLIENT_EMAIL;

    const { adminDb } = await import("./admin");
    expect(adminDb).toBeUndefined();
  });

  it("error message lists all missing variable names", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./admin");

    const errorCall = consoleSpy.mock.calls.find((args) =>
      String(args[1] ?? args[0]).includes("Missing")
    );
    expect(errorCall).toBeDefined();
    const msg = String(errorCall![1] ?? errorCall![0]);
    expect(msg).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    expect(msg).toContain("FIREBASE_CLIENT_EMAIL");
    expect(msg).toContain("FIREBASE_PRIVATE_KEY");
  });

  it("replaces \\n literals in FIREBASE_PRIVATE_KEY with real newlines", async () => {
    Object.assign(process.env, VALID_ENV);

    await import("./admin");

    expect(mockCert).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKey: expect.stringContaining("\n"),
      })
    );
    const certArg = mockCert.mock.calls[0][0];
    expect(certArg.privateKey).not.toContain("\\n");
  });

  it("calls initializeApp with cert credential when all env vars are set", async () => {
    Object.assign(process.env, VALID_ENV);

    await import("./admin");

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockCert).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: VALID_ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: VALID_ENV.FIREBASE_CLIENT_EMAIL,
      })
    );
  });

  it("re-uses existing app when already initialized (singleton)", async () => {
    Object.assign(process.env, VALID_ENV);
    mockGetApps.mockReturnValue([{ name: "[DEFAULT]" }]);

    await import("./admin");

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockGetApp).toHaveBeenCalled();
  });
});
