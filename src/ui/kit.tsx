import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { fmtNum, parseNum } from '../lib/format';
import type { Tone } from '../domain/types';

export function Card({ title, aside, children, class: cls = '' }: { title?: ComponentChildren; aside?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={`card ${cls}`}>
      {(title || aside) && (
        <header class="card-header">
          <span>{title}</span>
          {aside && <span class="card-aside">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

const show = (v: number | undefined) => (v === undefined ? '' : fmtNum(v).replace(/\./g, ''));

/** Campo numérico que aceita vírgula e não briga com o cursor enquanto digita. */
export function NumField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(show(value));
  useEffect(() => {
    if (parseNum(text) !== value) setText(show(value));
  }, [value]);
  return (
    <label class="field">
      <span>{label}</span>
      <div class="input-wrap">
        <input
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onInput={(e) => {
            const t = e.currentTarget.value;
            setText(t);
            onChange(parseNum(t));
          }}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

export function Stepper({ label, value, step, onChange }: { label: string; value: number | undefined; step: number; onChange: (v: number | undefined) => void }) {
  const bump = (d: number) => onChange(Math.max(0, Math.round(((value ?? 0) + d) * 100) / 100));
  return (
    <div class="stepper">
      <button type="button" aria-label={`Diminuir ${label}`} onClick={() => bump(-step)}>
        −
      </button>
      <NumField label={label} value={value} onChange={onChange} />
      <button type="button" aria-label={`Aumentar ${label}`} onClick={() => bump(step)}>
        +
      </button>
    </div>
  );
}

export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  cols = 2,
}: {
  label?: string;
  options: { value: T; label: string; hint?: string; badge?: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div class="field">
      {label && <span>{label}</span>}
      <div class="choice-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            class={`choice ${o.value === value ? 'on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            <strong>
              {o.label}
              {o.badge && <i class="choice-badge">{o.badge}</i>}
            </strong>
            {o.hint && <small>{o.hint}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chips<T extends string>({
  label,
  options,
  values,
  onChange,
  accent,
}: {
  label: string;
  options: { value: T; label: string }[];
  values: T[];
  onChange: (v: T[]) => void;
  /** Laranja (seleção) em vez de vermelho (alerta). */
  accent?: boolean;
}) {
  const toggle = (v: T) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div class="field">
      <span>{label}</span>
      <div class="chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={values.includes(o.value)}
            class={`chip ${accent ? 'accent' : ''} ${values.includes(o.value) ? 'on' : ''}`}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Rating({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div class="field">
      <span>
        {label}
        <small class="muted">
          {' '}
          · 1 = {low}, 5 = {high}
        </small>
      </span>
      <div class="rating" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={n === value} class={n === value ? 'on' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="toggle-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
    </label>
  );
}

export function Notice({ tone, title, children }: { tone: Tone; title?: string; children: ComponentChildren }) {
  return (
    <div class={`notice ${tone}`}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function Kpi({ value, label, delta, goodWhen }: { value: string; label: string; delta?: number; goodWhen?: 'up' | 'down' }) {
  const showDelta = delta !== undefined && Math.abs(delta) >= 0.05;
  const good = showDelta && goodWhen ? (goodWhen === 'up' ? delta! > 0 : delta! < 0) : null;
  return (
    <div class="kpi">
      <div class="kpi-val">{value}</div>
      <div class="kpi-lbl">{label}</div>
      {showDelta && (
        <div class={`kpi-delta ${good === null ? '' : good ? 'good' : 'bad'}`}>
          {delta! > 0 ? '▲' : '▼'} {fmtNum(Math.abs(Math.round(delta! * 10) / 10))}
        </div>
      )}
    </div>
  );
}
