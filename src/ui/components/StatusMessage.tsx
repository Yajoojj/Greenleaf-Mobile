import { CircleCheck, CircleAlert, Info, TriangleAlert, WifiOff, Moon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type StatusTone = 'info' | 'success' | 'warning' | 'error';
export type StatusIcon = 'info' | 'success' | 'warning' | 'error' | 'offline' | 'sleeping';

const ICONS: Record<StatusIcon, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  offline: WifiOff,
  sleeping: Moon,
};

const ICON_COLOR: Record<StatusTone, string> = {
  info: 'var(--color-green-700)',
  success: 'var(--color-green-700)',
  warning: 'var(--color-amber-800)',
  error: 'var(--color-red-700)',
};

export interface StatusMessageProps {
  tone?: StatusTone;
  icon?: StatusIcon;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  centered?: boolean;
  /** "alert" para erros que surgem após uma ação; padrão é nenhum papel. */
  role?: 'alert' | 'status';
}

/**
 * Figma: StatusMessage / {Info|Success|Warning|Error} — usado para os estados
 * vazio, carregando, erro de rede, sem conexão, imagem inválida e servidor dormindo.
 */
export function StatusMessage({ tone = 'info', icon, title, children, actions, centered, role }: StatusMessageProps) {
  const Icon = ICONS[icon ?? tone];
  return (
    <div className={`gl-status gl-status--${tone}${centered ? ' gl-status--centered' : ''}`} role={role}>
      <Icon className="gl-status__icon" aria-hidden="true" size={centered ? 40 : 24} color={ICON_COLOR[tone]} strokeWidth={2.25} />
      <div className="gl-status__body">
        {title && <p className="gl-status__title">{title}</p>}
        {children && <div>{children}</div>}
        {actions && <div className="gl-status__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="gl-status gl-status--info gl-status--centered" role="status">
      <span className="gl-spinner" aria-hidden="true" style={{ width: 32, height: 32, color: 'var(--color-green-700)' }} />
      <p className="gl-status__title">{label}</p>
    </div>
  );
}
