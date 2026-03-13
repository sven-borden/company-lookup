import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { getCompanyByUid } from "@/lib/data/companies";
import { MOCK_COMPANY_FULL } from "@/lib/data/mock-companies";
import { CompanyShort, CompanyStatus } from "@swiss-biz-hunter/types";

interface PageProps {
  params: Promise<{ uid: string }>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4 flex items-center gap-2">
      <span className="w-4 h-[1px] bg-zinc-200 dark:bg-zinc-800"></span>
      {children}
    </h3>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="py-3 border-b border-zinc-50 dark:border-zinc-900 last:border-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{label}</p>
      <div className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function CompanyLinkList({ title, companies }: { title: string; companies?: CompanyShort[] }) {
  if (!companies || companies.length === 0) return null;
  return (
    <div className="space-y-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-1 gap-3">
        {companies.map((c) => (
          <Link 
            key={c.uid} 
            href={`/company/${encodeURIComponent(c.uid)}`}
            className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-tight">{c.name}</p>
              <p className="text-[10px] font-mono opacity-60">{c.uid}</p>
            </div>
            <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
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

  // Sort and trim SOGC publications
  const sortedSogc = [...(company.sogcPub || [])]
    .sort((a, b) => new Date(b.sogcDate).getTime() - new Date(a.sogcDate).getTime())
    .slice(0, 100);

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link 
            href="/search" 
            className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-2"
          >
            <span className="text-xs">←</span> Back to Search
          </Link>
        </div>

        {/* Header Section */}
        <header className="mb-16 border-b-4 border-black dark:border-white pb-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-6 max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={company.status === CompanyStatus.ACTIVE ? "active" : "cancelled"}>
                  {company.status}
                </Badge>
                <Badge variant="outline">{company.legalForm?.name?.de || "Unternehmen"}</Badge>
                {company.canton && <Badge variant="default">Canton {company.canton}</Badge>}
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9] italic break-words">
                {company.name}
              </h1>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">UID Number</p>
                  <code className="text-lg font-black bg-zinc-100 dark:bg-zinc-900 px-3 py-1">
                    {company.uid}
                  </code>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">CH-ID</p>
                  <p className="text-lg font-mono font-bold">{company.chid}</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col shrink-0">
               {company.cantonalExcerptWeb && (
                 <a 
                  href={company.cantonalExcerptWeb} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="h-14 px-8 flex items-center justify-center bg-black text-white dark:bg-white dark:text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xl"
                >
                  Commercial Register ↗
                </a>
               )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-16">
            
            {/* Purpose Section */}
            <section>
              <SectionTitle>Company Purpose</SectionTitle>
              <div className="relative">
                <span className="absolute -left-6 top-0 text-6xl font-black text-red-600 dark:text-red-500 select-none">"</span>
                <p className="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-zinc-800 dark:text-zinc-200 italic">
                  {company.purpose || "The commercial purpose for this company has not been provided or is unavailable in the current registry extract."}
                </p>
              </div>
            </section>

            {/* General Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <section>
                <SectionTitle>Legal & Registration</SectionTitle>
                <div className="bg-white dark:bg-black border border-zinc-100 dark:border-zinc-900 p-6">
                  <DataRow label="Legal Form" value={company.legalForm?.name?.de} />
                  <DataRow label="Legal Seat" value={company.legalSeat} />
                  <DataRow label="Legal Seat ID" value={company.legalSeatId?.toString()} mono />
                  <DataRow label="EHRA ID" value={company.ehraid?.toString()} mono />
                  <DataRow label="Registry" value={`Canton ${company.canton || "N/A"}`} />
                </div>
              </section>

              <section>
                <SectionTitle>Capital Structure</SectionTitle>
                <div className="bg-white dark:bg-black border border-zinc-100 dark:border-zinc-900 p-6">
                  <DataRow 
                    label="Nominal Capital" 
                    value={company.capitalNominal ? `${Number(company.capitalNominal).toLocaleString('de-CH', { minimumFractionDigits: 2 })} ${company.capitalCurrency || 'CHF'}` : "Not specified"} 
                    mono 
                  />
                  <DataRow label="Currency" value={company.capitalCurrency || "CHF"} />
                  {company.translation && company.translation.length > 0 && (
                    <DataRow 
                      label="Translations" 
                      value={
                        <div className="flex flex-wrap gap-2 mt-1">
                          {company.translation.map((t, i) => (
                            <span key={i} className="text-[10px] bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded uppercase font-bold">{t}</span>
                          ))}
                        </div>
                      } 
                    />
                  )}
                </div>
              </section>
            </div>

            {/* History Section */}
            {company.oldNames && company.oldNames.length > 0 && (
              <section>
                <SectionTitle>Historical Names</SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-zinc-100 dark:border-zinc-900">
                        <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Previous Name</th>
                        <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Seq</th>
                      </tr>
                    </thead>
                    <tbody>
                      {company.oldNames.map((old, idx) => (
                        <tr key={idx} className="border-b border-zinc-50 dark:border-zinc-900 last:border-0">
                          <td className="py-4 font-bold text-sm uppercase italic">{old.name}</td>
                          <td className="py-4 font-mono text-xs text-zinc-400">{old.sequenceNr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Relationships Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-zinc-100 dark:border-zinc-900">
              <div className="space-y-12">
                <CompanyLinkList title="Head Offices" companies={company.headOffices} />
                <CompanyLinkList title="Further Head Offices" companies={company.furtherHeadOffices} />
                <CompanyLinkList title="Branch Offices" companies={company.branchOffices} />
              </div>
              <div className="space-y-12">
                <CompanyLinkList title="Taken Over" companies={company.hasTakenOver} />
                <CompanyLinkList title="Was Taken Over By" companies={company.wasTakenOverBy} />
                <CompanyLinkList title="Audit Companies" companies={company.auditCompanies} />
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <aside className="lg:col-span-4 space-y-12">
            
            {/* Address Card */}
            <section>
              <SectionTitle>Contact Address</SectionTitle>
              <Card className="rounded-none border-2 border-zinc-950 dark:border-zinc-50 overflow-hidden shadow-2xl">
                <div className="h-2 bg-black dark:bg-white w-full"></div>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Mailing Address</p>
                    <div className="text-lg font-bold uppercase leading-tight italic">
                      {company.address ? (
                        <>
                          {company.address.organisation && <p>{company.address.organisation}</p>}
                          {company.address.careOf && <p className="text-sm not-italic font-normal normal-case text-zinc-500">c/o {company.address.careOf}</p>}
                          <p>{company.address.street} {company.address.houseNumber}</p>
                          {company.address.addon && <p>{company.address.addon}</p>}
                          {company.address.poBox && <p>P.O. Box {company.address.poBox}</p>}
                          <p>{company.address.swissZipCode} {company.address.city}</p>
                        </>
                      ) : (
                        <p className="text-zinc-400">No address on file</p>
                      )}
                    </div>
                  </div>
                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Location Context</p>
                    <p className="text-sm font-black uppercase tracking-tight">
                      {company.legalSeat}, Canton {company.canton || "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* SOGC Publications */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Registry Mutations</SectionTitle>
                <span className="text-[10px] font-mono text-zinc-400">{sortedSogc.length} Entries</span>
              </div>
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                {sortedSogc.length > 0 ? (
                  sortedSogc.map((pub, idx) => (
                    <div key={idx} className="p-4 border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 group hover:border-black dark:hover:border-white transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <time className="text-[10px] font-black font-mono uppercase text-zinc-500">{pub.sogcDate}</time>
                        <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-700">#{pub.sogcId}</span>
                      </div>
                      <p className="text-xs font-bold leading-relaxed uppercase tracking-tight group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                        {pub.message}
                      </p>
                      {pub.mutationTypes && pub.mutationTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {pub.mutationTypes.map((m) => (
                            <span key={m.id} className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {m.key}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 border-2 border-dashed border-zinc-100 dark:border-zinc-900 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">No public records</p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
