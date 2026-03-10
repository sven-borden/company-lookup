import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import type {
  LegalForm,
  BfsCommunity,
  RegistryOfCommerce,
} from "@company-lookup/types";

export async function getLegalForms(): Promise<LegalForm[]> {
  const snapshot = await adminDb.collection("legalForms").get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as LegalForm);
}

export async function getCommunities(): Promise<BfsCommunity[]> {
  const snapshot = await adminDb.collection("communities").get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as BfsCommunity);
}

export async function getRegistries(): Promise<RegistryOfCommerce[]> {
  const snapshot = await adminDb.collection("registries").get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as RegistryOfCommerce);
}
