import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';

/** Figma: ConfirmDialog — usa <dialog> nativo (foco preso e Esc para fechar). */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel: string;
  /** Padrão: "Cancelar". */
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog ref={ref} className="gl-dialog" aria-labelledby="gl-dialog-msg" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <h2 className="visually-hidden">{t('dialog.title')}</h2>
        <p id="gl-dialog-msg" style={{ fontWeight: 600 }}>{message}</p>
        <div className="gl-stack gl-stack--sm">
          <Button variant={danger ? 'danger' : 'primary'} block onClick={onConfirm}>{confirmLabel}</Button>
          <Button variant="ghost" block onClick={onCancel}>{cancelLabel ?? t('common.cancel')}</Button>
        </div>
      </form>
    </dialog>
  );
}
