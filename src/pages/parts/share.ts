import type { Analysis } from '../../domain/types';
import type { Translate } from '../../i18n';
import { toPercent } from '../../domain/Diagnosis';

/** Converte data URL em Blob sem fetch (a CSP não libera connect-src para data:). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2);
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Compartilha o resumo (e a imagem destacada, quando o aparelho permite). */
export async function shareAnalysis(a: Analysis, t: Translate): Promise<'shared' | 'copied' | 'failed'> {
  const text = t('result.shareText', { state: t(`state.${a.state}`), p: toPercent(a.probability) });
  try {
    if (navigator.share) {
      let files: File[] | undefined;
      try {
        const blob = dataUrlToBlob(a.overlayDataUrl);
        const file = new File([blob], 'greenleaf-folha.png', { type: blob.type || 'image/png' });
        if (navigator.canShare?.({ files: [file] })) files = [file];
      } catch {
        files = undefined;
      }
      await navigator.share({ title: 'GreenLeaf', text, ...(files ? { files } : {}) });
      return 'shared';
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
  }
  return 'failed';
}
