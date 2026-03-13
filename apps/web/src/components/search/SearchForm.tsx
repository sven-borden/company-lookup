"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { saveSearchAction } from "@/app/actions/searches";

interface SearchFormProps {
  recentSearches: string[];
}

export function SearchForm({ recentSearches }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const navigate = (term: string) => {
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    await saveSearchAction(term);
    navigate(term);
  };

  const handleRecentClick = async (term: string) => {
    await saveSearchAction(term);
    navigate(term);
  };

  return (
    <>
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

      {recentSearches.length > 0 && (
        <footer className="mt-12 flex flex-wrap gap-4 items-center">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Recent:
          </span>
          <div className="flex gap-2 flex-wrap">
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleRecentClick(term)}
                className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 border border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </footer>
      )}
    </>
  );
}
