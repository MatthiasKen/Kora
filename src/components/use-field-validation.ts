"use client";
import { useState } from "react";
import type { z } from "zod";
export type FieldErrors<T> = Partial<Record<keyof T, string>>;
export function useFieldValidation<T extends object>(
  schema: z.ZodType<T>,
  value: T,
) {
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const result = schema.safeParse(value);
  const allErrors: FieldErrors<T> = {};
  if (!result.success)
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof T;
      if (!allErrors[key]) allErrors[key] = issue.message;
    }
  const errors: FieldErrors<T> = {};
  for (const key of Object.keys(allErrors) as (keyof T)[])
    if (submitted || touched.has(key)) errors[key] = allErrors[key];
  return {
    errors,
    valid: result.success,
    touch: (key: keyof T) =>
      setTouched((current) => new Set([...current, key])),
    validate: () => {
      setSubmitted(true);
      return schema.safeParse(value);
    },
  };
}
