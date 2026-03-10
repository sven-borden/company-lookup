import React from "react";
import Link from "next/link";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header className="border-b border-zinc-100 dark:border-zinc-900 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-6 w-6 bg-red-600 flex items-center justify-center text-white font-bold text-xs">
              +
            </div>
            <span className="font-bold tracking-tight uppercase text-sm group-hover:text-red-600 transition-colors">
              Zefix Lookup
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/search" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                Browse
              </Link>
              <Link href="/docs/Branding.md" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                Branding
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
