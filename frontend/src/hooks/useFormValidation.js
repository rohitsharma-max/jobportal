import { useState, useCallback } from 'react';

/**
 * Reusable form-validation hook.
 *
 * @param {Object} validators — { fieldName: (value, allValues) => errorString | '' }
 * @returns {{ errors, validate, validateField, clearFieldError, setFieldError }}
 */
export default function useFormValidation(validators) {
  const [errors, setErrors] = useState({});

  // Validate a single field (e.g. on blur).
  const validateField = useCallback(
    (name, value, allValues) => {
      const fn = validators[name];
      if (!fn) return '';
      const error = fn(value, allValues);
      setErrors((prev) => ({ ...prev, [name]: error }));
      return error;
    },
    [validators],
  );

  // Validate all fields at once (on submit). Returns true if valid.
  const validate = useCallback(
    (values) => {
      const next = {};
      let valid = true;
      for (const [name, fn] of Object.entries(validators)) {
        const error = fn(values[name], values);
        if (error) {
          next[name] = error;
          valid = false;
        }
      }
      setErrors(next);
      return valid;
    },
    [validators],
  );

  // Clear one field's error (on change / focus).
  const clearFieldError = useCallback((name) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  }, []);

  // Manually set an error on a field (e.g. server-side duplicate email).
  const setFieldError = useCallback((name, message) => {
    setErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  return { errors, validate, validateField, clearFieldError, setFieldError };
}
