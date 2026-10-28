import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  sticky?: boolean;
}

type ShowToast = (message: string, options?: { action?: ToastAction; sticky?: boolean }) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Aviso curto no rodapé, anunciado a leitores de tela (role="status"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const seq = useRef(0);

  const show = useCallback<ShowToast>((message, options) => {
    seq.current += 1;
    setToast({ id: seq.current, message, ...options });
  }, []);

  useEffect(() => {
    if (!toast || toast.sticky) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">
        {toast && (
          <div className="gl-toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="gl-button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
