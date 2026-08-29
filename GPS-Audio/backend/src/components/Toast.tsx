import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="pointer-events-auto flex items-start gap-3 p-3.5 bg-neutral-950 text-neutral-100 dark:bg-white dark:text-neutral-950 rounded-lg shadow-2xl border border-neutral-800 dark:border-neutral-200"
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-neutral-400 dark:text-neutral-600 shrink-0 mt-0.5" />}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-wider uppercase font-mono">{t.title}</p>
              {t.message && (
                <p className="text-xs font-medium text-neutral-300 dark:text-neutral-700 mt-0.5 leading-relaxed break-words">
                  {t.message}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="text-neutral-400 hover:text-neutral-100 dark:text-neutral-500 dark:hover:text-neutral-900 transition-colors p-1"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
