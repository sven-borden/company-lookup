import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { ZefixClient } from "../zefix/client";
import { CompanyFull } from "@company-lookup/types";
import { logger } from "firebase-functions/v2";

initializeApp();

const zefixUsername = defineString("ZEFIX_USERNAME");
const zefixPassword = defineString("ZEFIX_PASSWORD");
const zefixBaseUrl = defineString("ZEFIX_API_BASE_URL", {
  default: "https://www.zefix.admin.ch/ZefixPublicREST",
});

const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
];

const BATCH_SIZE = 500;

function createClient(): ZefixClient {
  return new ZefixClient({
    baseUrl: zefixBaseUrl.value(),
    username: zefixUsername.value(),
    password: zefixPassword.value(),
  });
}

async function syncReferenceData(client: ZefixClient): Promise<void> {
  const db = getFirestore();

  const [legalForms, communities, registries] = await Promise.all([
    client.getLegalForms(),
    client.getCommunities(),
    client.getRegistriesOfCommerce(),
  ]);

  logger.info(
    `Syncing reference data: ${legalForms.length} legal forms, ${communities.length} communities, ${registries.length} registries`
  );

  let batch = db.batch();
  let count = 0;

  for (const lf of legalForms) {
    batch.set(db.collection("legalForms").doc(String(lf.id)), lf);
    if (++count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  for (const c of communities) {
    batch.set(db.collection("communities").doc(String(c.bfsId)), c);
    if (++count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  for (const r of registries) {
    batch.set(
      db.collection("registries").doc(String(r.registryOfCommerceId)),
      r
    );
    if (++count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  logger.info("Reference data sync complete");
}

async function syncCompaniesForCanton(
  client: ZefixClient,
  canton: string
): Promise<number> {
  const db = getFirestore();

  const companies = await client.searchCompanies({ name: "*", canton });
  logger.info(`Canton ${canton}: found ${companies.length} companies`);

  let synced = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const company of companies) {
    let full: CompanyFull;
    try {
      full = await client.getCompanyByEhraid(company.ehraid);
    } catch (err) {
      logger.warn(
        `Failed to fetch details for ehraid ${company.ehraid}: ${err}`
      );
      continue;
    }

    const docRef = db.collection("companies").doc(full.uid);
    batch.set(docRef, {
      ...full,
      syncedAt: new Date(),
    });

    batchCount++;
    synced++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
      logger.info(`Canton ${canton}: committed ${synced} companies so far`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(`Canton ${canton}: sync complete — ${synced} companies`);
  return synced;
}

export const syncZefixData = onSchedule(
  {
    schedule: "every sunday 02:00",
    timeZone: "Europe/Zurich",
    timeoutSeconds: 3600,
    memory: "1GiB",
  },
  async () => {
    const client = createClient();

    logger.info("Starting Zefix sync");

    await syncReferenceData(client);

    let totalSynced = 0;
    for (const canton of CANTONS) {
      try {
        const count = await syncCompaniesForCanton(client, canton);
        totalSynced += count;
      } catch (err) {
        logger.error(`Failed to sync canton ${canton}: ${err}`);
      }
    }

    logger.info(`Zefix sync complete — ${totalSynced} companies total`);
  }
);
