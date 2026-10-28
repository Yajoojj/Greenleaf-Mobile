import { Check } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
}

/** Figma: ProgressSteps / Step {Pending|Active|Done} */
export function ProgressSteps({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="gl-steps">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'pending';
        return (
          <li key={s.id} className="gl-step" data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="gl-step__marker" aria-hidden="true">
              {state === 'done' ? <Check size={22} strokeWidth={3} /> : state === 'active' ? <span className="gl-spinner" /> : i + 1}
            </span>
            <span>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
