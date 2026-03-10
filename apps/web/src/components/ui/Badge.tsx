import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "outline" | "active" | "cancelled";
}

export function Badge({ variant = "default", className = "", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors uppercase tracking-wider";
  
  const variants = {
    default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
    accent: "bg-red-500/10 text-red-600 dark:text-red-500",
    outline: "border border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500",
    cancelled: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
