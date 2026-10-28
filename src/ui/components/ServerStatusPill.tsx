import type { ServerState } from '../../app/hooks';
import type { Services } from '../../domain/services';
import { useI18n, type MessageKey } from '../../i18n';

/** Figma: ServerStatus / {Ok|Waking|Down|Offline|Mock|Demo} */
export function ServerStatusPill({ state, mode }: { state: ServerState; mode: Services['predictionMode'] }) {
  const { t } = useI18n();
  let key: MessageKey;
  let dot: 'ok' | 'wait' | 'off' | 'neutral';
  if (mode === 'demo') {
    key = 'server.demo';
    dot = 'ok';
  } else if (mode === 'mock') {
    key = 'server.mock';
    dot = 'neutral';
  } else {
    switch (state.kind) {
      case 'ok':
        key = state.health.model_loaded ? 'server.ok' : 'server.okColorOnly';
        dot = 'ok';
        break;
      case 'checking':
        key = 'server.checking';
        dot = 'neutral';
        break;
      case 'sleeping':
        key = 'server.sleeping';
        dot = 'wait';
        break;
      case 'offline':
        key = 'server.offline';
        dot = 'off';
        break;
      default:
        key = 'server.down';
        dot = 'off';
    }
  }
  return (
    <span className="gl-server-pill" role="status">
      <span className={`gl-dot gl-dot--${dot}`} aria-hidden="true" />
      {t(key)}
    </span>
  );
}
