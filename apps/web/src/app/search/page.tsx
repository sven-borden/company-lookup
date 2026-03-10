import React from "react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { searchCompanies } from "@/lib/data/companies";
import { MOCK_COMPANIES } from "@/lib/data/mock-companies";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SearchResultsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  
  // Fetch real companies from Firestore
  let companies = await searchCompanies(query);

  // If no results are found in Firestore, we fallback to mock for demo purposes,
  // or show an empty state. Let's show real data if available, 
  // but for the sake of the demo, let's keep mock as fallback.
  const isMock = companies.length === 0 && !query;
  const displayCompanies = companies.length > 0 ? companies : (query ? [] : MOCK_COMPANIES);

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-extrabold tracking-tighter italic uppercase">
              Search Results
            </h1>
            {query && (
              <Badge variant="accent">"{query}"</Badge>
            )}
          </div>
          <p className="text-zinc-500 font-medium">
            Found {displayCompanies.length} companies matching your criteria.
          </p>
        </header>

        {displayCompanies.length > 0 ? (
          <div className="grid gap-px bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900">
            {displayCompanies.map((company) => (
              <Link
                key={company.uid}
                href={`/company/${encodeURIComponent(company.uid)}`}
                className="group block bg-white dark:bg-black p-6 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight group-hover:text-red-600 transition-colors">
                      {company.name}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-400">
                        {company.uid}
                      </span>
                      <Badge variant="outline">{company.legalSeat}</Badge>
                      <Badge variant="outline">{company.legalForm?.shortName?.de || "GmbH"}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={company.status === "ACTIVE" ? "active" : "cancelled"}>
                      {company.status}
                    </Badge>
                    <span className="text-zinc-300 dark:text-zinc-700 hidden md:block">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-900">
            <p className="text-xl font-bold text-zinc-400 uppercase tracking-widest italic">
              No results found for "{query}"
            </p>
            <Link href="/" className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-red-600 hover:underline">
              Try another search
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
