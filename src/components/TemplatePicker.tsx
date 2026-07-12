import { useEffect, useRef } from 'react';
import { TEMPLATES, type Template } from '../templates/templates';

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (template: Template) => void;
}

/** Dialog offering the 6 chart templates (Blank + 5 domain templates). */
export function TemplatePicker({ open, onClose, onPick }: TemplatePickerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal-overlay"
      aria-label="Choose a template"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal modal--wide">
        <div className="modal__header">
          <h2 className="modal__title">New chart</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="modal__hint">
          Every template pre-fills 8 pillar names and leaves all 64 actions empty — rename
          anything afterwards.
        </p>
        <ul className="template-list">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <button type="button" className="template-card" onClick={() => onPick(t)}>
                <span
                  className="template-card__swatch"
                  data-theme={t.defaultThemeId}
                  aria-hidden="true"
                />
                <span className="template-card__body">
                  <span className="template-card__label">{t.label}</span>
                  <span className="template-card__desc">{t.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
