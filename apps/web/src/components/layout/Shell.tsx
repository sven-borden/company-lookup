import React from "react";
import Link from "next/link";
import Image from "next/image";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header className="border-b border-zinc-100 dark:border-zinc-900 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Image 
              src="/logo.png" 
              alt="SwissBizHunter Logo" 
              width={24} 
              height={24} 
              className="object-contain"
            />
            <span className="font-bold tracking-tight uppercase text-sm group-hover:text-red-600 transition-colors">
              SwissBizHunter
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/browse" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                Browse
              </Link>
              <Link href="/admin/dashboard" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                Dashboard
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
