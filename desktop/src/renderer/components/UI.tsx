import {
  forwardRef, useId, useRef, useState, useEffect,
  type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes,
  type SelectHTMLAttributes, type HTMLAttributes, type AnchorHTMLAttributes,
  type DialogHTMLAttributes, type TableHTMLAttributes,
} from 'react';
import '../../styles/tokens.css';
import '../../styles/common-ui.css';

export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'accent';

export interface HelpTextProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: 'muted' | 'error' | 'success';
}
export function HelpText({ tone = 'muted', className = '', ...props }: HelpTextProps) {
  return <p {...props} className={`ui-help ui-help--${tone} ${className}`} />;
}

export interface FieldLabelProps {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}
export function FieldLabel({ htmlFor, children, required }: FieldLabelProps) {
  return <label className="ui-label" htmlFor={htmlFor}>{children}{required && <span className="ui-required"> (required)</span>}</label>;
}

interface FieldProps {
  label: string;
  help?: string;
  error?: string;
}
function Field({ id, label, help, error, required, children }: FieldProps & { id: string; required?: boolean; children: ReactNode }) {
  return <div className="ui-field">
    <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
    {children}
    {help && <HelpText id={`${id}-help`}>{help}</HelpText>}
    {error && <HelpText id={`${id}-error`} tone="error">{error}</HelpText>}
  </div>;
}
function description(id: string, help?: string, error?: string, extra?: string) {
  return [extra, help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  label, help, error, id, required, 'aria-describedby': describedBy, ...props
}, ref) {
  const generated = useId();
  const controlId = id ?? generated;
  return <Field id={controlId} label={label} help={help} error={error} required={required}>
    <input {...props} ref={ref} id={controlId} required={required} aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={description(controlId, help, error, describedBy)} />
  </Field>;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({
  label, help, error, id, required, 'aria-describedby': describedBy, ...props
}, ref) {
  const generated = useId();
  const controlId = id ?? generated;
  return <Field id={controlId} label={label} help={help} error={error} required={required}>
    <textarea {...props} ref={ref} id={controlId} required={required} aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={description(controlId, help, error, describedBy)} />
  </Field>;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({
  label, help, error, id, required, children, 'aria-describedby': describedBy, ...props
}, ref) {
  const generated = useId();
  const controlId = id ?? generated;
  return <Field id={controlId} label={label} help={help} error={error} required={required}>
    <select {...props} ref={ref} id={controlId} required={required} aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={description(controlId, help, error, describedBy)}>{children}</select>
  </Field>;
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, FieldProps {
  indeterminate?: boolean;
}
export function Checkbox({ label, help, error, indeterminate = false, id, 'aria-describedby': describedBy, ...props }: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  return <div className="ui-stack ui-choice">
    <label className="ui-check" htmlFor={controlId}><input {...props} ref={input} id={controlId} type="checkbox"
      aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description(controlId, help, error, describedBy)} />{label}</label>
    {help && <HelpText id={`${controlId}-help`}>{help}</HelpText>}
    {error && <HelpText id={`${controlId}-error`} tone="error">{error}</HelpText>}
  </div>;
}

export interface SwitchProps extends Omit<CheckboxProps, 'indeterminate' | 'error' | 'role'> {}
export function Switch(props: SwitchProps) {
  return <div className="ui-switch"><Checkbox {...props} role="switch" /></div>;
}

export interface RadioGroupProps {
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  help?: string;
  onChange?: (value: string) => void;
}
export function RadioGroup({ label, options, value, defaultValue, disabled, help, onChange }: RadioGroupProps) {
  const id = useId();
  return <fieldset disabled={disabled} aria-describedby={help ? `${id}-help` : undefined}>
    <legend>{label}</legend>
    {options.map(option => <label className="ui-check" key={option.value}>
      <input type="radio" name={id} value={option.value} disabled={option.disabled}
        checked={value === undefined ? undefined : value === option.value}
        defaultChecked={value === undefined ? defaultValue === option.value : undefined}
        onChange={event => onChange?.(event.target.value)} />{option.label}
    </label>)}
    {help && <HelpText id={`${id}-help`}>{help}</HelpText>}
  </fieldset>;
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { tone?: Tone }
export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return <span {...props} className={`ui-chip ui-tone--${tone} ${className}`} />;
}

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  title: string;
}
export function Alert({ tone = 'info', title, children, className = '', ...props }: AlertProps) {
  return <div {...props} className={`ui-feedback ui-tone--${tone} ${className}`}>
    <strong>{title}</strong>{children && <div className="ui-alert-body">{children}</div>}
  </div>;
}

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  description?: string;
  footer?: ReactNode;
  variant?: 'default' | 'raised' | 'outlined';
}
export function Card({ title, description, footer, variant = 'default', children, className = '', ...props }: CardProps) {
  const id = useId();
  return <article {...props} className={`ui-state ui-card ui-card--${variant} ${className}`} aria-labelledby={id}>
    <header><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</header>
    {children}
    {footer && <footer className="ui-card-footer">{footer}</footer>}
  </article>;
}

export interface DisclosureProps extends HTMLAttributes<HTMLDetailsElement> {
  summary: string;
  open?: boolean;
}
export function Disclosure({ summary, children, className = '', ...props }: DisclosureProps) {
  return <details {...props} className={`ui-disclosure ${className}`}><summary>{summary}</summary><div className="ui-disclosure-body">{children}</div></details>;
}

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
  title: string;
  description?: string;
}
export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(function Dialog({ title, description, children, className = '', ...props }, ref) {
  const id = useId();
  return <dialog {...props} ref={ref} className={`ui-dialog ${className}`} aria-labelledby={`${id}-title`}
    aria-describedby={description ? `${id}-description` : undefined}>
    <h2 id={`${id}-title`}>{title}</h2>
    {description && <p id={`${id}-description`}>{description}</p>}
    {children}
  </dialog>;
});

export interface TabsProps {
  label: string;
  items: { label: string; content: ReactNode; disabled?: boolean }[];
}
export function Tabs({ label, items }: TabsProps) {
  const id = useId();
  const [active, setSelected] = useState(() => items.findIndex(item => !item.disabled));
  const selected = items[active] && !items[active].disabled ? active : items.findIndex(item => !item.disabled);
  const list = useRef<HTMLDivElement>(null);
  return <div className="ui-stack">
    <div ref={list} className="ui-row ui-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => <button key={item.label} type="button" className="ui-button ui-button--ghost" role="tab"
        id={`${id}-tab-${index}`} disabled={item.disabled} aria-selected={selected === index}
        aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1}
        onClick={() => setSelected(index)} onKeyDown={event => {
          const enabled = items.flatMap((entry, position) => entry.disabled ? [] : [position]);
          const position = enabled.indexOf(index);
          const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1]
            : event.key === 'ArrowRight' ? enabled[(position + 1) % enabled.length]
              : event.key === 'ArrowLeft' ? enabled[(position + enabled.length - 1) % enabled.length] : undefined;
          if (next === undefined) return;
          event.preventDefault();
          setSelected(next);
          list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{item.label}</button>)}
    </div>
    {items.map((item, index) => <div key={item.label} role="tabpanel" id={`${id}-panel-${index}`}
      aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0}>{item.content}</div>)}
  </div>;
}

export function Link({ className = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={`ui-link ${className}`} />;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="ui-row" role="status"><span className="ui-spinner" aria-hidden="true" />{label}</span>;
}
export function Skeleton({ shape = 'text' }: { shape?: 'text' | 'circle' | 'card' }) {
  return <div className={`ui-skeleton ui-skeleton--${shape}`} aria-hidden="true" />;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="ui-state ui-empty"><h2>{title}</h2>{children && <p>{children}</p>}{action}</section>;
}
export function Table({ caption, children, ...props }: TableHTMLAttributes<HTMLTableElement> & { caption: string }) {
  return <div className="ui-table" role="region" aria-label={caption} tabIndex={0}><table {...props}><caption>{caption}</caption>{children}</table></div>;
}
export function Divider() {
  return <hr className="ui-divider" />;
}
