"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Shell } from "@/components/layout/Shell";

export default function Home() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <Shell>
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 bg-white dark:bg-black">
        <main className="w-full max-w-2xl text-left">
          {/* Hero Section */}
          <section className="space-y-4 mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight italic uppercase">
              Swiss Company <br /> Registry Lookup
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium max-w-lg">
              Access augmented commercial data for any business in Switzerland 
              using official Zefix PublicREST records.
            </p>
          </section>

          {/* Search Input Container */}
          <form onSubmit={handleSearch} className="relative group">
            <Input
              variant="bottom"
              placeholder="Search by company name, UID, or Canton..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="absolute right-0 bottom-6 flex items-center gap-4">
              <span className="hidden md:block text-xs font-bold text-zinc-300 uppercase tracking-widest">
                Press Enter
              </span>
              <Button type="submit" size="sm" variant="secondary">
                Search
              </Button>
            </div>
          </form>

          {/* Quick Filters / Recent Searches */}
          <footer className="mt-12 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Recent:
            </span>
            <div className="flex gap-2">
              {["NVIDIA", "Rolex", "Nestlé", "ABB"].map((name) => (
                <button
                  key={name}
                  onClick={() => router.push(`/search?q=${name}`)}
                  className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 border border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </footer>
        </main>
      </div>
    </Shell>
  );
}
