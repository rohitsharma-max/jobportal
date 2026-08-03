/**
 * Reusable form field wrapper — renders label, input (or any child), error,
 * and optional character count. Applies `.field-invalid` on error for red
 * border + shake animation.
 *
 * The error node carries id `${name}-error` so inputs can point at it with
 * aria-describedby, which is what makes a screen reader announce the message.
 * The `*` alone is decorative — inputs must also set `required` and
 * `aria-invalid` themselves (see `fieldProps` below for the shorthand).
 */
export default function FormField({
  label,
  name,
  error,
  required,
  charCount,
  maxLength,
  hint,
  children,
}) {
  const showCount = maxLength != null && charCount != null;
  const overLimit = showCount && charCount > maxLength;

  return (
    <div className="field">
      {label && (
        <label htmlFor={name}>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {children}
      <div className="field-footer">
        {error && (
          <span className="field-error" id={`${name}-error`} role="alert">
            {error}
          </span>
        )}
        {hint && !error && (
          <span className="field-hint" id={`${name}-hint`}>
            {hint}
          </span>
        )}
        {showCount && (
          <span className={`char-count${overLimit ? ' char-count-over' : ''}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Props every input inside a FormField should spread, so "required" is a real
 * constraint rather than a red asterisk and errors are announced properly.
 *
 *   <input id="email" name="email" {...fieldProps('email', errors.email, true)} … />
 */
// eslint-disable-next-line react-refresh/only-export-components
export function fieldProps(name, error, isRequired = false, hasHint = false) {
  return {
    required: isRequired || undefined,
    'aria-required': isRequired || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${name}-error` : hasHint ? `${name}-hint` : undefined,
    className: error ? 'field-invalid' : '',
  };
}
