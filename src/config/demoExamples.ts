import { mapPrediction } from '../domain/Diagnosis';
import type { DiagnosisState, PredictionResult } from '../domain/types';
import cases from '../services/fixtures/demo-cases.json';

export interface DemoExampleTile {
  id: string;
  image: string;
  /** Resultado real da IA v2 para a foto (o rótulo do botão vem dele, não do nome do arquivo). */
  state: DiagnosisState;
  otherDisease: boolean;
}

/** Folhas de exemplo do modo demonstração (imagens em /public/demo, pré-carregadas no cache). */
export const DEMO_EXAMPLES: DemoExampleTile[] = (cases as { id: string; image: string; response: PredictionResult }[]).map(({ id, image, response }) => {
  const d = mapPrediction(response);
  return { id, image, state: d.state, otherDisease: d.otherDisease !== null };
});
