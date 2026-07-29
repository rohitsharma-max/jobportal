/**
 * Reusable form field wrapper — renders label, input (or any child), error,
 * and optional character count. Applies `.field-invalid` on error for red
 * border + shake animation.
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
          {required && <span className="req"> *</span>}
        </label>
      )}
      {children}
      <div className="field-footer">
        {error && <span className="field-error">{error}</span>}
        {hint && !error && <span className="field-hint">{hint}</span>}
        {showCount && (
          <span className={`char-count${overLimit ? ' char-count-over' : ''}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
