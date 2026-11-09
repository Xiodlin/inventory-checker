import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import '../../styles/tokens.css';
import '../../styles/common-ui.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...props
}, ref) {
  return <button {...props} ref={ref} type={type} className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
    disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className="ui-spinner" aria-hidden="true" />}
    {children}
  </button>;
});

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'aria-label'> {
  label: string;
  icon: ReactNode;
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  label, icon, className = '', ...props
}, ref) {
  return <Button {...props} ref={ref} aria-label={label} className={`ui-icon-button ${className}`}>
    <span aria-hidden="true">{icon}</span>
  </Button>;
});
