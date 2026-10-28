import { Eye, EyeOff, UserRoundX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useSettings } from '../app/settings';
import { AuthError } from '../domain/errors';
import { useI18n, type MessageKey } from '../i18n';
import { Button, LeafMark, SegmentedControl, StatusMessage, TextField } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

type Mode = 'signIn' | 'signUp';

/** Entrar / Cadastrar (mock). "Usar sem conta" fica sempre visível. */
export function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { update } = useSettings();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  usePageTitle(t(`auth.title.${mode}`));

  const done = () => {
    update({ authSeen: true, onboardingDone: true });
    navigate('/inicio', { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(name, email, password);
      done();
    } catch (err) {
      setError(err instanceof AuthError ? (`auth.error.${err.kind}` as MessageKey) : 'auth.error.generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="gl-stack" style={{ alignItems: 'flex-start' }}>
        <LeafMark size={56} />
        <div className="gl-page-title">
          <h1>{t(`auth.title.${mode}`)}</h1>
          <p>{t('auth.subtitle')}</p>
        </div>
      </div>

      <SegmentedControl<Mode>
        label={t(`auth.title.${mode}`)}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: 'signIn', label: t('auth.tab.signIn') },
          { value: 'signUp', label: t('auth.tab.signUp') },
        ]}
      />

      <form className="gl-stack" onSubmit={submit} noValidate>
        {mode === 'signUp' && (
          <TextField label={t('auth.name')} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        )}
        <TextField
          label={t('auth.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={120}
        />
        <div className="gl-stack gl-stack--sm">
          <TextField
            label={t('auth.password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === 'signUp' ? t('auth.passwordHint') : undefined}
            required
            minLength={8}
            maxLength={128}
          />
          <Button
            variant="ghost"
            style={{ alignSelf: 'flex-start' }}
            icon={showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
          >
            {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
          </Button>
        </div>

        {error && <StatusMessage tone="error" role="alert">{t(error)}</StatusMessage>}
        <p className="gl-xs gl-muted">{t('auth.mockNotice')}</p>

        <div className="gl-action-bar">
          <Button type="submit" size="lg" block loading={busy}>
            {t(`auth.submit.${mode}`)}
          </Button>
          <Button variant="secondary" block icon={<UserRoundX size={20} aria-hidden="true" />} onClick={done}>
            {t('auth.guest')}
          </Button>
        </div>
      </form>
    </>
  );
}
