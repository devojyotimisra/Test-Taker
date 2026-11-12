import * as React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastItem {
  id: string;
  type?: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ type = "info", title, description, duration = 5000 }: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, description, duration }]);

      if (duration > 0) {
        window.setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none p-3 sm:p-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200",
              t.type === "error" &&
                "bg-red-500/10 border-red-500/30 text-foreground dark:bg-red-950/40 dark:border-red-500/40 shadow-red-500/5",
              t.type === "success" &&
                "bg-emerald-500/10 border-emerald-500/30 text-foreground dark:bg-emerald-950/40 dark:border-emerald-500/40 shadow-emerald-500/5",
              t.type === "warning" &&
                "bg-amber-500/10 border-amber-500/30 text-foreground dark:bg-amber-950/40 dark:border-amber-500/40 shadow-amber-500/5",
              t.type === "info" &&
                "bg-card/95 border-border text-card-foreground"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "error" && (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              {t.type === "success" && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
              {t.type === "warning" && (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              {t.type === "info" && (
                <Info className="h-5 w-5 text-primary" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h5 className="font-semibold text-sm tracking-tight leading-snug">
                {t.title}
              </h5>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                  {t.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-1 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
