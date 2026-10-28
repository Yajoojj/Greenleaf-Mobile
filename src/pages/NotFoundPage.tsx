import { useI18n } from '../i18n';
import { ButtonLink, StatusMessage } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

export function NotFoundPage() {
  const { t } = useI18n();
  usePageTitle(t('notFound.title'));
  return (
    <>
      <h1 className="visually-hidden">{t('notFound.title')}</h1>
      <StatusMessage centered tone="warning" title={t('notFound.title')} actions={<ButtonLink to="/inicio">{t('notFound.back')}</ButtonLink>} />
    </>
  );
}
