'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { AppIcon } from '@/components/AppIcon';

// The one password input for the whole account area (sign-in, sign-up,
// reset-password, and the dashboard's Change Password panel). Before this
// existed the site had three different treatments — an eye toggle, a text
// "Show/Hide" button in a bordered segment, and no toggle at all — and the
// text-button variant also used a different padding/font-size than the email
// field sitting directly above it. Route new password fields through here.
//
// Visual/behavioural details live in the `.password-field` utility in
// globals.css (right padding so long values never slide under the button,
// suppressed Edge ::-ms-reveal, 36px tap target, focus ring).

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Spanish labels for the toggle; the caller owns the visible field label. */
  isEs?: boolean;
  /**
   * Marks the "confirm password" field so its toggle announces itself
   * distinctly — two buttons both labelled "Show password" are ambiguous to a
   * screen-reader user moving between them.
   */
  confirm?: boolean;
}

export default function PasswordInput({
  isEs = false,
  confirm = false,
  id,
  className,
  ...inputProps
}: Props) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const label = visible
    ? (confirm
      ? (isEs ? 'Ocultar confirmación' : 'Hide confirm password')
      : (isEs ? 'Ocultar contraseña' : 'Hide password'))
    : (confirm
      ? (isEs ? 'Mostrar confirmación' : 'Show confirm password')
      : (isEs ? 'Mostrar contraseña' : 'Show password'));

  return (
    <div className="password-field">
      <input
        {...inputProps}
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={`form-field w-full${className ? ` ${className}` : ''}`}
      />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible((current) => !current)}
        // aria-pressed carries the state, so the label never claims the
        // password is visible when it is not.
        aria-pressed={visible}
        aria-controls={inputId}
        aria-label={label}
        title={label}
      >
        <AppIcon
          name={visible ? 'visibility_off' : 'visibility'}
          className="text-[1.05rem] leading-none"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
