import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { ConfirmDialog } from '../ui';
import { useAuth } from './auth';
import { useServices } from './services';
import { useToast } from './toast';

const askedKey = (userId: string) => `gl.sync.asked.${userId}`;

function alreadyAsked(userId: string): boolean {
  try {
    return localStorage.getItem(askedKey(userId)) === '1';
  } catch {
    return false;
  }
}

function rememberAsked(userId: string): void {
  try {
    localStorage.setItem(askedKey(userId), '1');
  } catch {
    /* armazenamento indisponível: pergunta de novo no próximo login */
  }
}

/**
 * Primeiro login com histórico neste aparelho: oferece enviar as análises para a conta (sim / agora não).
 * Só aparece com o back-end real (`historySync`) e uma vez por conta neste aparelho. Demonstrações nunca sobem.
 * Único ajuste de interface da integração com o Supabase (docs/decisoes.md).
 */
export function HistorySyncPrompt() {
  const { t } = useI18n();
  const toast = useToast();
  const { historySync } = useServices();
  const { user } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setPending(0);
    if (!historySync || !user || alreadyAsked(user.id)) return;
    let alive = true;
    historySync.pendingLocal().then(
      (n) => {
        if (!alive) return;
        if (n > 0) setPending(n);
        else rememberAsked(user.id);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [historySync, user]);

  if (!historySync || !user || pending === 0) return null;

  const close = () => {
    rememberAsked(user.id);
    setPending(0);
  };

  const upload = async () => {
    close();
    try {
      await historySync.uploadLocal();
      toast(t('sync.done'));
    } catch {
      toast(t('sync.failed'));
    }
  };

  return (
    <ConfirmDialog
      open
      message={t('sync.question', { n: pending })}
      confirmLabel={t('sync.yes')}
      cancelLabel={t('sync.no')}
      onConfirm={upload}
      onCancel={close}
    />
  );
}
