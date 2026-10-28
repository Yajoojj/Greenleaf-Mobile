import { Camera, PlayCircle, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../app/services';
import { useSession } from '../app/session';
import { useSettings } from '../app/settings';
import { AnalysisBuilder } from '../domain/AnalysisBuilder';
import { PredictionError, type PredictionErrorKind } from '../domain/errors';
import { useI18n } from '../i18n';
import { Button, ButtonLink, ProgressSteps, StatusMessage } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

const SLOW_AFTER_S = 5; // meta RNF2: resposta em até 5 s
const SLEEPING_AFTER_S = 12;

export function ProcessingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const services = useServices();
  const { update } = useSettings();
  const { capture, clearCapture, setResult } = useSession();
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<PredictionErrorKind | null>(null);
  const [run, setRun] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  usePageTitle(t('processing.title'));

  useEffect(() => {
    if (!capture) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    setStep(0);
    setElapsed(0);
    setError(null);

    (async () => {
      try {
        // Exemplos da demonstração já são leves e sem EXIF; os demais são preparados no aparelho.
        const blob = capture.source === 'demo' ? capture.blob : await services.images.prepare(capture.blob);
        if (controller.signal.aborted) return;
        const result = await services.prediction.predict(blob, controller.signal, { onUploaded: () => setStep(1) });
        setStep(2);
        const [imageDataUrl, position] = await Promise.all([
          services.images.toDataUrl(blob),
          services.location.getPosition().catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        setResult(
          AnalysisBuilder.build({
            result,
            imageDataUrl,
            source: capture.source,
            simulated: services.predictionMode !== 'api',
            position,
          }),
        );
        navigate('/resultado', { replace: true });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof PredictionError ? err.kind : 'server');
      } finally {
        clearInterval(timer);
      }
    })();

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [capture, run, services, setResult, navigate]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    navigate('/analisar', { replace: true });
  }, [navigate]);

  if (!capture) {
    return (
      <StatusMessage centered title={t('error.noImage')} actions={<ButtonLink to="/analisar">{t('home.analyze')}</ButtonLink>} />
    );
  }

  if (error) {
    const isConnection = error === 'offline' || error === 'network' || error === 'sleeping' || error === 'timeout';
    const isImage = ['invalid_format', 'too_large', 'low_quality', 'invalid_image'].includes(error);
    return (
      <>
        <h1>{t('error.title')}</h1>
        <StatusMessage
          tone={isImage ? 'warning' : 'error'}
          icon={error === 'offline' ? 'offline' : error === 'sleeping' ? 'sleeping' : isImage ? 'warning' : 'error'}
          role="alert"
        >
          {t(`error.${error}`)}
        </StatusMessage>
        <div className="gl-action-bar">
          {!isImage && (
            <Button size="lg" block icon={<RotateCcw size={22} aria-hidden="true" />} onClick={() => setRun((n) => n + 1)}>
              {t('common.retry')}
            </Button>
          )}
          <Button
            variant={isImage ? 'primary' : 'secondary'}
            size={isImage ? 'lg' : 'md'}
            block
            icon={<Camera size={20} aria-hidden="true" />}
            onClick={() => {
              clearCapture();
              navigate('/analisar', { replace: true });
            }}
          >
            {t('error.newPhoto')}
          </Button>
          {isConnection && services.predictionMode !== 'demo' && (
            <Button
              variant="ghost"
              block
              icon={<PlayCircle size={20} aria-hidden="true" />}
              onClick={() => {
                clearCapture();
                update({ demoMode: true });
                navigate('/analisar', { replace: true });
              }}
            >
              {t('error.useDemo')}
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{t('processing.title')}</h1>
      <div className="gl-scan" aria-hidden="true">
        <img src={capture.previewUrl} alt="" />
      </div>
      <div role="status" aria-live="polite" className="gl-stack">
        <ProgressSteps
          current={step}
          steps={[
            { id: 'send', label: t('processing.step.send') },
            { id: 'analyze', label: t('processing.step.analyze') },
            { id: 'prepare', label: t('processing.step.prepare') },
          ]}
        />
        {elapsed >= SLEEPING_AFTER_S && services.predictionMode === 'api' ? (
          <StatusMessage tone="warning" icon="sleeping">{t('processing.sleeping')}</StatusMessage>
        ) : elapsed >= SLOW_AFTER_S ? (
          <StatusMessage tone="warning" icon="info">{t('processing.slow')}</StatusMessage>
        ) : null}
      </div>
      <p className="gl-muted gl-small" aria-hidden="true">{t('processing.elapsed', { s: elapsed })}</p>
      <div className="gl-action-bar gl-push-down">
        <Button variant="secondary" block icon={<X size={20} aria-hidden="true" />} onClick={cancel}>
          {t('processing.cancel')}
        </Button>
      </div>
    </>
  );
}
