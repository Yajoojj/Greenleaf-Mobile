import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

/** Figma: TextField / {Default|Focus|Error} */
export function TextField({ label, hint, error, id, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errId = error ? `${fieldId}-err` : undefined;
  return (
    <div className="gl-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        className="gl-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
        {...input}
      />
      {hint && <span id={hintId} className="gl-field__hint">{hint}</span>}
      {error && <span id={errId} className="gl-field__error">{error}</span>}
    </div>
  );
}

export function TextArea({ label, hint, error, id, ...input }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errId = error ? `${fieldId}-err` : undefined;
  return (
    <div className="gl-field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        className="gl-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
        {...input}
      />
      {hint && <span id={hintId} className="gl-field__hint">{hint}</span>}
      {error && <span id={errId} className="gl-field__error">{error}</span>}
    </div>
  );
}

/** Figma: Switch / {On|Off} — checkbox nativo com papel de interruptor. */
export function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="gl-switch" htmlFor={id}>
      <span className="gl-switch__text">
        <span className="gl-switch__label">{label}</span>
        {description && <span className="gl-muted gl-small">{description}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="gl-switch__track" aria-hidden="true" />
    </label>
  );
}
