"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CANTONS } from "@company-lookup/types";

export function BrowseFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    if (key !== "page") {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Canton</label>
        <select 
          className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-widest px-3 py-2 outline-none focus:border-red-600 transition-colors cursor-pointer"
          value={searchParams.get("canton") || ""}
          onChange={(e) => updateFilters("canton", e.target.value)}
        >
          <option value="">All Cantons</option>
          {CANTONS.sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Sort By</label>
        <select 
          className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-widest px-3 py-2 outline-none focus:border-red-600 transition-colors cursor-pointer"
          value={searchParams.get("sortBy") || "name"}
          onChange={(e) => updateFilters("sortBy", e.target.value)}
        >
          <option value="name">Name</option>
          <option value="uid">UID</option>
          <option value="canton">Canton</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Order</label>
        <select 
          className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-widest px-3 py-2 outline-none focus:border-red-600 transition-colors cursor-pointer"
          value={searchParams.get("sortOrder") || "asc"}
          onChange={(e) => updateFilters("sortOrder", e.target.value)}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
    </div>
  );
}

export function BrowsePagination({ page, totalPages }: { page: number, totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        disabled={page <= 1}
        onClick={() => goToPage(page - 1)}
        className="h-10 px-4 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <div className="flex items-center px-4 h-10 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-widest bg-white dark:bg-black">
        Page {page} / {totalPages}
      </div>
      <button 
        disabled={page >= totalPages}
        onClick={() => goToPage(page + 1)}
        className="h-10 px-4 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}
