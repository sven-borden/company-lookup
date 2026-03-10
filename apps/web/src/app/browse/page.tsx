import React, { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { browseCompanies } from "@/lib/data/companies";
import { BrowseFilters, BrowsePagination } from "./BrowseComponents";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = typeof params.page === "string" ? parseInt(params.page) : 1;
  const pageSize = typeof params.pageSize === "string" ? parseInt(params.pageSize) : 20;
  const canton = typeof params.canton === "string" ? params.canton : undefined;
  const sortBy = (typeof params.sortBy === "string" ? params.sortBy : "name") as "name" | "uid" | "canton" | "status";
  const sortOrder = (typeof params.sortOrder === "string" ? params.sortOrder : "asc") as "asc" | "desc";

  const { companies: displayCompanies, total: totalItems, totalPages } = await browseCompanies({
    page,
    pageSize,
    canton,
    sortBy,
    sortOrder,
  });

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12 border-b border-zinc-100 dark:border-zinc-900 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tighter italic uppercase">
              Browse Registry
            </h1>
            <p className="text-zinc-500 font-medium">
              Explore the complete Swiss commercial registry data.
            </p>
          </div>
          <Suspense fallback={<div className="h-12 w-64 bg-zinc-100 animate-pulse" />}>
            <BrowseFilters />
          </Suspense>
        </header>

        <div className="grid gap-px bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900 mb-8">
          {displayCompanies.map((company) => (
            <Link
              key={company.uid}
              href={`/company/${encodeURIComponent(company.uid)}`}
              className="group block bg-white dark:bg-black p-6 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight group-hover:text-red-600 transition-colors">
                      {company.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400">
                      {company.uid}
                    </span>
                    <Badge variant="outline">{company.legalSeat}</Badge>
                    <Badge variant="outline" className="opacity-60">{company.legalForm?.shortName?.de || "GmbH"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={company.status === "ACTIVE" ? "active" : "cancelled"}>
                    {company.status}
                  </Badge>
                  <span className="text-zinc-300 dark:text-zinc-700 hidden md:block group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <footer className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-zinc-100 dark:border-zinc-900 pt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Showing <span className="text-zinc-950 dark:text-zinc-50">{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalItems)}</span> of <span className="text-zinc-950 dark:text-zinc-50">{totalItems}</span> companies
          </div>
          
          <Suspense fallback={<div className="h-10 w-48 bg-zinc-100 animate-pulse" />}>
            <BrowsePagination page={page} totalPages={totalPages} />
          </Suspense>
        </footer>
      </div>
    </Shell>
  );
}

