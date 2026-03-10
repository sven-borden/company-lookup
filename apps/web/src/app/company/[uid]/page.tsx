import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { getCompanyByUid } from "@/lib/data/companies";
import { MOCK_COMPANY_FULL } from "@/lib/data/mock-companies";

interface PageProps {
  params: Promise<{ uid: string }>;
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { uid } = await params;
  const decodedUid = decodeURIComponent(uid);

  // Attempt to fetch from Firestore
  let company = await getCompanyByUid(decodedUid);

  // Fallback to mock for known demo UIDs if Firestore is empty
  if (!company && (decodedUid === "CHE-123.456.789" || decodedUid === "CHE-105.909.036")) {
     company = MOCK_COMPANY_FULL;
  }

  if (!company) {
    notFound();
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-100 dark:border-zinc-900 pb-12">
          <div className="space-y-4 text-left">
            <Link 
              href="/search" 
              className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              ← Back to Results
            </Link>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase leading-tight italic">
              {company.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <code className="text-sm font-bold bg-zinc-100 dark:bg-zinc-900 px-2 py-1">
                {company.uid}
              </code>
              <Badge variant={company.status === "ACTIVE" ? "active" : "cancelled"}>
                {company.status}
              </Badge>
              <Badge variant="outline">{company.legalForm?.name?.de || "Unternehmen"}</Badge>
            </div>
          </div>
          
          <div className="flex gap-3">
             {company.cantonalExcerptWeb && (
               <a 
                href={company.cantonalExcerptWeb} 
                target="_blank" 
                rel="noopener noreferrer"
                className="h-11 px-6 flex items-center bg-black text-white dark:bg-white dark:text-black font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Commercial Register
              </a>
             )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                Purpose
              </h3>
              <p className="text-lg leading-relaxed font-medium text-zinc-800 dark:text-zinc-200">
                {company.purpose || "No purpose text available for this company."}
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-zinc-100 dark:border-zinc-900 pt-8">
               <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Address
                </h3>
                <div className="space-y-1 font-mono text-sm uppercase">
                  {company.address ? (
                    <>
                      <p>{company.address.street} {company.address.houseNumber}</p>
                      <p>{company.address.swissZipCode} {company.address.city}</p>
                      <p>Canton {company.canton || company.legalSeat}</p>
                    </>
                  ) : (
                    <p>Address not available.</p>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Financials
                </h3>
                <div className="space-y-1 font-mono text-sm uppercase">
                  <p>Capital: {company.capitalNominal || "N/A"} {company.capitalCurrency || ""}</p>
                  <p>Legal Form: {company.legalForm?.shortName?.de || "N/A"}</p>
                  <p>CH-ID: {company.chid}</p>
                </div>
              </section>
            </div>
          </div>

          <aside className="space-y-8">
             {company.sogcPub && company.sogcPub.length > 0 ? (
               <Card className="rounded-none border-2 border-zinc-950 dark:border-zinc-50">
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest italic">
                      Latest Mutation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-400 uppercase">SOGC Date</p>
                      <p className="font-mono text-sm">{company.sogcPub[0].sogcDate}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-400 uppercase">Message</p>
                      <p className="text-sm font-bold leading-tight uppercase italic text-red-600 dark:text-red-500">
                        {company.sogcPub[0].message}
                      </p>
                    </div>
                  </CardContent>
               </Card>
             ) : (
               <div className="p-6 border border-zinc-100 dark:border-zinc-900 text-xs font-bold uppercase text-zinc-400 tracking-widest italic">
                 No recent publications
               </div>
             )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
