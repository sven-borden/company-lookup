"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const success = useCallback((msg: string) => addToast(msg, "success"), [addToast]);
  const error = useCallback((msg: string) => addToast(msg, "error"), [addToast]);
  const info = useCallback((msg: string) => addToast(msg, "info"), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`
                  pointer-events-auto flex items-center gap-3 p-4 border animate-in slide-in-from-right-5 fade-in duration-300
                  ${t.type === "success" ? "bg-white dark:bg-black border-emerald-500/20 text-emerald-600 dark:text-emerald-500" : ""}
                  ${t.type === "error" ? "bg-white dark:bg-black border-red-500/20 text-red-600 dark:text-red-500" : ""}
                  ${t.type === "info" ? "bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50" : ""}
                `}
              >
                <div className={`h-2 w-2 shrink-0 ${
                  t.type === "success" ? "bg-emerald-500" : 
                  t.type === "error" ? "bg-red-600" : 
                  "bg-zinc-400"
                }`} />
                <span className="text-xs font-bold uppercase tracking-widest leading-none">
                  {t.message}
                </span>
                <button 
                  onClick={() => removeToast(t.id)}
                  className="ml-auto text-[10px] font-black uppercase tracking-tighter opacity-50 hover:opacity-100"
                >
                  Close
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
