import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Analysis, AnalysisSource } from '../domain/types';

export interface Capture {
  blob: Blob;
  previewUrl: string;
  source: AnalysisSource;
}

interface SessionValue {
  capture: Capture | null;
  setCapture: (blob: Blob, source: AnalysisSource) => void;
  clearCapture: () => void;
  /** Resultado atual, ainda não necessariamente salvo. */
  result: Analysis | null;
  resultSaved: boolean;
  setResult: (a: Analysis | null) => void;
  markSaved: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Estado da análise em andamento (só em memória: nada é gravado sem o produtor pedir). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [capture, setCaptureState] = useState<Capture | null>(null);
  const [result, setResultState] = useState<Analysis | null>(null);
  const [resultSaved, setResultSaved] = useState(false);

  const setCapture = useCallback((blob: Blob, source: AnalysisSource) => {
    setCaptureState((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { blob, source, previewUrl: URL.createObjectURL(blob) };
    });
  }, []);

  const clearCapture = useCallback(() => {
    setCaptureState((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const setResult = useCallback((a: Analysis | null) => {
    setResultState(a);
    setResultSaved(false);
  }, []);

  const markSaved = useCallback(() => setResultSaved(true), []);

  const value = useMemo(
    () => ({ capture, setCapture, clearCapture, result, resultSaved, setResult, markSaved }),
    [capture, setCapture, clearCapture, result, resultSaved, setResult, markSaved],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
