import { Angry, Frown, Laugh, Meh, Send, Smile, type LucideIcon } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useAuth } from '../app/auth';
import { useServices } from '../app/services';
import type { Feedback } from '../domain/types';
import { useI18n } from '../i18n';
import { Button, StatusMessage, TextArea, TextField } from '../ui';
import { BackLink } from './parts/BackLink';
import { usePageTitle } from './parts/usePageTitle';

const FACES: LucideIcon[] = [Angry, Frown, Meh, Smile, Laugh];
const TOPICS: Feedback['topic'][] = ['duvida', 'problema', 'sugestao', 'elogio'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function SupportPage() {
  const { t } = useI18n();
  const { feedback, accountMode } = useServices();
  const { user } = useAuth();
  const [rating, setRating] = useState<number | undefined>();
  const [topic, setTopic] = useState<Feedback['topic']>('duvida');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<{ message?: string; email?: string; form?: string }>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const groupId = useId();
  usePageTitle(t('support.title'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!message.trim()) next.message = t('support.error.message');
    if (email.trim() && !EMAIL.test(email.trim())) next.email = t('support.error.email');
    setErrors(next);
    if (Object.keys(next).length) return;
    setState('sending');
    try {
      await feedback.send({ topic, message, rating, contactEmail: email.trim() || undefined });
      setState('sent');
    } catch {
      setErrors({ form: t('support.error.generic') });
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <>
        <BackLink to="/perfil" />
        <h1 className="visually-hidden">{t('support.title')}</h1>
        <StatusMessage
          centered
          tone="success"
          role="status"
          title={t('support.sent')}
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                setMessage('');
                setRating(undefined);
                setState('idle');
              }}
            >
              {t('support.another')}
            </Button>
          }
        >
          {t(accountMode === 'cloud' ? 'support.sentBody.cloud' : 'support.sentBody')}
        </StatusMessage>
      </>
    );
  }

  return (
    <>
      <BackLink to="/perfil" />
      <div className="gl-page-title">
        <h1>{t('support.title')}</h1>
        <p>{t('support.subtitle')}</p>
      </div>
      <form className="gl-stack gl-stack--lg" onSubmit={submit} noValidate>
        <fieldset className="gl-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 8 }}>{t('support.rating')} <span className="gl-muted">{t('common.optional')}</span></legend>
          <div className="gl-rating">
            {FACES.map((Face, i) => {
              const v = i + 1;
              const id = `${groupId}-r${v}`;
              return (
                <span key={v}>
                  <input type="radio" id={id} name="rating" value={v} checked={rating === v} onChange={() => setRating(v)} />
                  <label htmlFor={id}>
                    <Face size={28} aria-hidden="true" />
                    {t(`support.rating.${v as 1 | 2 | 3 | 4 | 5}`)}
                  </label>
                </span>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="gl-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 8 }}>{t('support.topic')}</legend>
          <div className="gl-chips" style={{ flexWrap: 'wrap' }}>
            {TOPICS.map((tp) => (
              <button key={tp} type="button" className="gl-chip" aria-pressed={topic === tp} onClick={() => setTopic(tp)}>
                {t(`support.topic.${tp}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <TextArea
          label={t('support.message')}
          hint={t('support.messageHint')}
          error={errors.message}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          required
        />
        <TextField
          label={<>{t('support.email')} <span className="gl-muted">{t('common.optional')}</span></>}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={120}
        />
        {errors.form && <StatusMessage tone="error" role="alert">{errors.form}</StatusMessage>}
        <div className="gl-action-bar gl-action-bar--static">
          <Button type="submit" size="lg" block loading={state === 'sending'} loadingLabel={t('support.sending')} icon={<Send size={22} aria-hidden="true" />}>
            {t('support.send')}
          </Button>
        </div>
      </form>
    </>
  );
}
