import { Camera, Check, ImageUp, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../app/services';
import { useSession } from '../app/session';
import { useSettings } from '../app/settings';
import { DEMO_EXAMPLES } from '../config/demoExamples';
import { PredictionError } from '../domain/errors';
import type { AnalysisSource } from '../domain/types';
import { useI18n } from '../i18n';
import { Button, CassavaLeafOutline, StatusMessage } from '../ui';
import { BackLink } from './parts/BackLink';
import { usePageTitle } from './parts/usePageTitle';

type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable';

function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      stop();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, [stop]);

  useEffect(() => {
    if (enabled) void start();
    return stop;
  }, [enabled, start, stop]);

  const snapshot = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  return { videoRef, state, start, stop, snapshot };
}

export function CapturePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { images } = useServices();
  const { settings } = useSettings();
  const { capture, setCapture, clearCapture } = useSession();
  const [error, setError] = useState<PredictionError['kind'] | null>(null);
  const [showOwn, setShowOwn] = useState(!settings.demoMode);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const nativeCamRef = useRef<HTMLInputElement>(null);
  const previewing = Boolean(capture && capture.source !== 'demo');
  const camera = useCamera(showOwn && !previewing);
  usePageTitle(t('capture.title'));

  // Ao entrar na tela, descarta uma foto de exemplo esquecida na sessão.
  useEffect(() => {
    if (capture?.source === 'demo') clearCapture();
  }, []);

  const accept = (file: Blob, source: AnalysisSource) => {
    try {
      images.validate(file);
      setError(null);
      camera.stop();
      setCapture(file, source);
    } catch (err) {
      setError(err instanceof PredictionError ? err.kind : 'invalid_format');
    }
  };

  const onFile = (source: AnalysisSource) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) accept(file, source);
  };

  const shoot = async () => {
    const blob = await camera.snapshot();
    if (blob) accept(blob, 'camera');
  };

  const pickDemo = async (id: string, url: string) => {
    setLoadingDemo(id);
    try {
      const blob = await (await fetch(url)).blob();
      setCapture(blob, 'demo');
      navigate('/processando');
    } catch {
      setError('network');
    } finally {
      setLoadingDemo(null);
    }
  };

  const retake = () => {
    clearCapture();
    setError(null);
  };

  const hiddenInputs = (
    <>
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png" hidden onChange={onFile('gallery')} />
      <input ref={nativeCamRef} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={onFile('camera')} />
    </>
  );

  const errorBox = error && (
    <StatusMessage tone="error" role="alert" title={t('error.title')}>
      {t(`error.${error}`)}
    </StatusMessage>
  );

  if (previewing && capture) {
    return (
      <>
        <div className="gl-page-title">
          <h1>{t('capture.previewTitle')}</h1>
          <p>{t('capture.previewCheck')}</p>
        </div>
        <div className="gl-camera">
          <img src={capture.previewUrl} alt={t('capture.previewAlt')} />
        </div>
        {errorBox}
        <div className="gl-action-bar">
          <Button size="lg" block icon={<Check size={24} aria-hidden="true" />} onClick={() => navigate('/processando')}>
            {t('capture.use')}
          </Button>
          <Button variant="secondary" block icon={<RotateCcw size={20} aria-hidden="true" />} onClick={retake}>
            {t('capture.retake')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink to="/inicio" />
      {hiddenInputs}

      {settings.demoMode && (
        <section className="gl-stack" aria-labelledby="demo-title">
          <div className="gl-page-title">
            <h1 id="demo-title">{t('capture.demoTitle')}</h1>
            <p>{t('capture.demoBody')}</p>
          </div>
          <div className="gl-demo-grid">
            {DEMO_EXAMPLES.map((ex, i) => {
              const state = ex.otherDisease ? t('state.semBacteriose') : t(`state.${ex.state}`);
              return (
              <button
                key={ex.id}
                type="button"
                className="gl-demo-tile"
                onClick={() => pickDemo(ex.id, ex.image)}
                aria-busy={loadingDemo === ex.id || undefined}
                disabled={loadingDemo !== null}
              >
                <img src={ex.image} alt={t('capture.demoAlt', { n: i + 1, state })} />
                <span>{t('capture.demoExample', { n: i + 1, state })}</span>
              </button>
              );
            })}
          </div>
          <p className="gl-xs gl-muted">{t('capture.demoIllustration')}</p>
          {errorBox}
          {!showOwn && (
            <Button variant="secondary" icon={<Camera size={20} aria-hidden="true" />} onClick={() => setShowOwn(true)}>
              {t('capture.orUseCamera')}
            </Button>
          )}
        </section>
      )}

      {showOwn && (
        <section className="gl-stack" aria-labelledby="cam-title">
          <div className="gl-page-title">
            {settings.demoMode ? <h2 id="cam-title">{t('capture.title')}</h2> : <h1 id="cam-title">{t('capture.title')}</h1>}
            <p>{t('capture.subtitle')}</p>
          </div>

          {(camera.state === 'live' || camera.state === 'starting') && (
            <div className="gl-camera">
              <video ref={camera.videoRef} playsInline muted aria-label={t('capture.hint')} />
              <div className="gl-camera__guide">
                <CassavaLeafOutline stroke="rgb(255 255 255 / .85)" strokeWidth={1.6} />
              </div>
              <span className="gl-camera__hint">{camera.state === 'starting' ? t('capture.cameraLoading') : t('capture.hint')}</span>
            </div>
          )}
          {camera.state === 'idle' && <video ref={camera.videoRef} hidden playsInline muted />}

          {(camera.state === 'denied' || camera.state === 'unavailable') && (
            <StatusMessage tone="warning" icon="warning">
              {camera.state === 'denied' ? t('capture.cameraDenied') : t('capture.cameraUnavailable')}
            </StatusMessage>
          )}

          {!settings.demoMode && errorBox}

          <details className="gl-accordion">
            <summary>
              {t('capture.tips.title')}
            </summary>
            <div className="gl-accordion__content">
              <ul className="gl-tips">
                {(['1', '2', '3', '4'] as const).map((n) => (
                  <li key={n}><Check size={18} aria-hidden="true" />{t(`capture.tips.${n}`)}</li>
                ))}
              </ul>
            </div>
          </details>

          <div className="gl-action-bar">
            {camera.state === 'live' ? (
              <div className="gl-row" style={{ justifyContent: 'center', gap: 'var(--space-4)' }}>
                <button type="button" className="gl-shutter" onClick={shoot} aria-label={t('capture.shoot')}>
                  <Camera size={30} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Button size="lg" block icon={<Camera size={24} aria-hidden="true" />} onClick={() => nativeCamRef.current?.click()}>
                {t('capture.useNativeCamera')}
              </Button>
            )}
            <Button variant="secondary" block icon={<ImageUp size={20} aria-hidden="true" />} onClick={() => galleryRef.current?.click()}>
              {t('capture.gallery')}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
