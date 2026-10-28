import type { DiagnosisState } from '../domain/types';
import cases from '../services/fixtures/demo-cases.json';

/** Folhas de exemplo do modo demonstração (imagens em /public/demo, pré-carregadas no cache). */
export const DEMO_EXAMPLES: { id: DiagnosisState; image: string }[] = (cases as { id: DiagnosisState; image: string }[]).map(
  ({ id, image }) => ({ id, image }),
);
