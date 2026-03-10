import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6 text-left">
        <header className="flex items-center gap-2">
          <div className="h-4 w-4 bg-red-600 flex items-center justify-center text-white font-bold text-[10px] select-none">
            +
          </div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Action Required
          </span>
        </header>

        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic italic">
            {title}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            variant={isDestructive ? "primary" : "secondary"}
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 border-zinc-200 dark:border-zinc-800"
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
