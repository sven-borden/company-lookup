import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { ZefixClient } from "../zefix/client";
import { CompanyFull, CompanyShort, CANTONS, CANTON_SCHEDULE } from "@company-lookup/types";
import { logger } from "firebase-functions/v2";

initializeApp();

const zefixUsername = defineString("ZEFIX_USERNAME");
const zefixPassword = defineString("ZEFIX_PASSWORD");
const zefixBaseUrl = defineString("ZEFIX_API_BASE_URL", {
  default: "https://www.zefix.admin.ch/ZefixPublicREST",
});

export const BATCH_SIZE = 500;
const MAX_SOGC_PUB_ENTRIES = 100;

function trimCompanyForFirestore(full: CompanyFull): CompanyFull {
  if (!full.sogcPub || full.sogcPub.length <= MAX_SOGC_PUB_ENTRIES) return full;
  const sorted = [...full.sogcPub].sort((a, b) =>
    b.sogcDate.localeCompare(a.sogcDate)
  );
  return { ...full, sogcPub: sorted.slice(0, MAX_SOGC_PUB_ENTRIES) };
}

async function fetchCompaniesForPrefix(
  client: ZefixClient,
  prefix: string,
  canton: string
): Promise<CompanyShort[]> {
  logger.info(`Canton ${canton}: fetching prefix "${prefix}*"`);
  try {
    const results = await client.searchCompanies({ name: `${prefix}*`, canton });
    logger.info(`Canton ${canton}: prefix "${prefix}*" → ${results.length} companies`);
    return results;
  } catch (err) {
    const isTooBig =
      err instanceof Error && err.message.includes("RESULTLIST_TO_LARGE");
    if (isTooBig) {
      logger.info(`Canton ${canton}: prefix "${prefix}*" too large — expanding to sub-prefixes`);
      const results: CompanyShort[] = [];
      for (const letter of "abcdefghijklmnopqrstuvwxyz") {
        const sub = await fetchCompaniesForPrefix(client, `${prefix}${letter}`, canton);
        results.push(...sub);
      }
      logger.info(`Canton ${canton}: prefix "${prefix}*" expanded — ${results.length} companies total`);
      return results;
    }
    throw err;
  }
}

export function createClient(): ZefixClient {
  return new ZefixClient({
    baseUrl: zefixBaseUrl.value(),
    username: zefixUsername.value(),
    password: zefixPassword.value(),
  });
}

export async function syncReferenceData(client: ZefixClient): Promise<void> {
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

export async function syncCompaniesForCanton(
  client: ZefixClient,
  canton: string
): Promise<number> {
  const db = getFirestore();

  const seen = new Set<number>();
  const companies: CompanyShort[] = [];
  logger.info(`Canton ${canton}: starting company discovery`);
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const before = companies.length;
    const batch = await fetchCompaniesForPrefix(client, letter, canton);
    for (const c of batch) {
      if (!seen.has(c.ehraid)) {
        seen.add(c.ehraid);
        companies.push(c);
      }
    }
    logger.info(`Canton ${canton}: letter "${letter}" done — +${companies.length - before} new (${companies.length} total)`);
  }
  logger.info(`Canton ${canton}: discovery complete — ${companies.length} unique companies to sync`);

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

    const trimmed = trimCompanyForFirestore(full);
    const docRef = db.collection("companies").doc(trimmed.uid);
    batch.set(docRef, {
      ...trimmed,
      syncedAt: new Date(),
    });

    batchCount++;
    synced++;

    if (synced % 100 === 0) {
      logger.info(`Canton ${canton}: fetched details for ${synced}/${companies.length} companies`);
    }

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
      logger.info(`Canton ${canton}: committed batch — ${synced}/${companies.length} companies written`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  // Update canton stats
  const countSnapshot = await db
    .collection("companies")
    .where("canton", "==", canton)
    .count()
    .get();
  const totalCount = countSnapshot.data().count;

  await db.collection("canton_stats").doc(canton).set(
    {
      totalCompanies: totalCount,
      lastSyncedAt: new Date(),
    },
    { merge: true }
  );

  logger.info(`Canton ${canton}: sync complete — ${synced} companies (Total in DB: ${totalCount})`);
  return synced;
}

export const syncZefixData = onSchedule(
  {
    schedule: "every day 02:00",
    timeZone: "Europe/Zurich",
    timeoutSeconds: 3600,
    memory: "1GiB",
  },
  async () => {
    const db = getFirestore();
    const logRef = db.collection("cron_logs").doc();
    const startTime = new Date();

    await logRef.set({
      functionName: "syncZefixData",
      startTime,
      status: "running",
    });

    try {
      const client = createClient();
      const dayOfWeek = startTime.getDay();
      const cantonsToSync = CANTON_SCHEDULE[dayOfWeek] || [];

      logger.info(
        `Starting Zefix sync for day ${dayOfWeek} (Cantons: ${cantonsToSync.join(
          ", "
        )})`
      );

      // Sync reference data daily to ensure we have the latest legal forms/communities
      await syncReferenceData(client);

      let totalSynced = 0;
      const results: Record<string, number> = {};

      for (const canton of cantonsToSync) {
        try {
          const count = await syncCompaniesForCanton(client, canton);
          totalSynced += count;
          results[canton] = count;
        } catch (err) {
          logger.error(`Failed to sync canton ${canton}: ${err}`);
          results[canton] = -1;
        }
      }

      await logRef.update({
        endTime: new Date(),
        status: "success",
        totalSynced,
        results,
        cantons: cantonsToSync,
      });

      logger.info(
        `Zefix sync complete for day ${dayOfWeek} — ${totalSynced} companies total`
      );
    } catch (err) {
      logger.error(`Cron sync failed: ${err}`);
      await logRef.update({
        endTime: new Date(),
        status: "failed",
        error: String(err),
      });
      throw err;
    }
  }
);

