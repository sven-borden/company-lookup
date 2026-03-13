import React from "react";
import { Shell } from "@/components/layout/Shell";
import { SearchForm } from "@/components/search/SearchForm";
import { getRecentSearches } from "@/lib/data/searches";

export default async function Home() {
  const recent = await getRecentSearches().catch(() => []);
  const recentTerms = recent.map((r) => r.term);

  return (
    <Shell>
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 bg-white dark:bg-black">
        <main className="w-full max-w-2xl text-left">
          {/* Hero Section */}
          <section className="space-y-4 mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight italic uppercase">
              Swiss Business <br /> Acquisition Intelligence
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium max-w-lg">
              Identify and evaluate Swiss companies with augmented Zefix data,
              scraping intelligence, and AI-driven growth analysis.
            </p>
          </section>

          <SearchForm recentSearches={recentTerms} />
        </main>
      </div>
    </Shell>
  );
}
