import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface CommonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
}

function classes({ variant = 'primary', size = 'md', block }: CommonProps, extra?: string) {
  return ['gl-button', `gl-button--${variant}`, size === 'lg' && 'gl-button--lg', block && 'gl-button--block', extra]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends CommonProps, ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
}

/** Figma: Button / {Primary|Secondary|Ghost|Danger} / {Default|Pressed|Disabled|Loading} */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, icon, loading, loadingLabel, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="gl-spinner" aria-hidden="true" /> : icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});

export function ButtonLink({ variant, size, block, icon, children, className, ...rest }: CommonProps & LinkProps) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
