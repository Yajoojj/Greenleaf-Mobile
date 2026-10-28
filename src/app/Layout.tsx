import { BookOpen, History, House, UserRound, WifiOff, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n';
import { LeafMark } from '../ui';
import { useOnline } from './hooks';
import { useSettings } from './settings';

const NAV: { to: string; label: MessageKey; icon: LucideIcon }[] = [
  { to: '/inicio', label: 'nav.home', icon: House },
  { to: '/historico', label: 'nav.history', icon: History },
  { to: '/saiba-mais', label: 'nav.learn', icon: BookOpen },
  { to: '/perfil', label: 'nav.profile', icon: UserRound },
];

function NavItems() {
  const { t } = useI18n();
  return (
    <>
      {NAV.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <NavLink to={to} className="gl-nav-link">
            <span className="gl-nav-link__icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            {t(label)}
          </NavLink>
        </li>
      ))}
    </>
  );
}

export function DemoBadge() {
  const { t } = useI18n();
  const { settings } = useSettings();
  if (!settings.demoMode) return null;
  return <span className="gl-badge gl-badge--demo">{t('badge.demo')}</span>;
}

/** Leva o foco ao título da nova tela a cada navegação (leitores de tela e teclado). */
function useFocusOnNavigate() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }, [pathname]);
}

/** Moldura das telas: cabeçalho, aviso de conexão e navegação (inferior no celular, no topo no desktop). */
export function Layout({ bare = false }: { bare?: boolean }) {
  const { t } = useI18n();
  const online = useOnline();
  useFocusOnNavigate();
  return (
    <div className="gl-app">
      <a className="skip-link" href="#conteudo">{t('app.skip')}</a>
      <header className="gl-header">
        <div className="gl-header__inner">
          <Link to="/inicio" className="gl-header__brand" aria-label={`${t('app.name')} — ${t('nav.home')}`}>
            <LeafMark className="gl-header__brand-mark" />
            {t('app.name')}
          </Link>
          {!bare && (
            <nav aria-label={t('nav.main')} className="gl-header__nav">
              <ul className="gl-row" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <NavItems />
              </ul>
            </nav>
          )}
          <div className="gl-header__end">
            <DemoBadge />
          </div>
        </div>
      </header>
      {!online && (
        <div className="gl-banner" role="status">
          <WifiOff size={18} aria-hidden="true" />
          {t('offline.banner')}
        </div>
      )}
      <main id="conteudo" className={`gl-main${bare ? ' gl-main--bare' : ''}`}>
        <Outlet />
      </main>
      {!bare && (
        <nav aria-label={t('nav.main')} className="gl-bottom-nav">
          <ul>
            <NavItems />
          </ul>
        </nav>
      )}
    </div>
  );
}
