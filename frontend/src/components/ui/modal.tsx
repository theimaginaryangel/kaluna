"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  showCloseButton = true,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  // Apple spring easing curve [0.25, 0.1, 0.25, 1]
  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  if (!mounted) {
    return null;
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: appleSpringEase }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Dialog Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.35, ease: appleSpringEase }}
            className={cn(
              "relative w-full z-10 rounded-3xl bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-soft overflow-hidden flex flex-col max-h-[90vh]",
              maxWidthClasses[maxWidth],
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
                <div>
                  {title && (
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-200 ring-pink-focus"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="p-6 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
