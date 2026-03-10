import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "bottom";
}

export function Input({
  variant = "default",
  className = "",
  ...props
}: InputProps) {
  const baseStyles =
    "w-full bg-transparent outline-none transition-all duration-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-700";
  
  const variants = {
    default: "h-12 border border-zinc-200 dark:border-zinc-800 focus:border-red-600 dark:focus:border-red-500 px-4 rounded-none",
    bottom: "h-20 text-xl md:text-2xl font-medium border-b-2 border-zinc-200 dark:border-zinc-800 focus:border-red-600 dark:focus:border-red-500 pb-2",
  };

  return (
    <input
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
