/**
 * Dependency-free request validation.
 * Every string that reaches the database passes through here.
 */

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function requiredString(
  value: unknown,
  field: string,
  { min = 1, max = 5000, label }: { min?: number; max?: number; label?: string } = {},
): string {
  const name = label ?? field;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(field, `${name} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(field, `${name} must be at least ${min} characters`);
  }
  if (trimmed.length > max) {
    throw new ValidationError(field, `${name} must be under ${max} characters`);
  }
  return trimmed;
}

export function optionalString(
  value: unknown,
  field: string,
  { max = 500, label }: { max?: number; label?: string } = {},
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new ValidationError(field, `${label ?? field} must be under ${max} characters`);
  }
  return trimmed;
}

export function emailString(value: unknown, field = 'email'): string {
  const email = requiredString(value, field, { max: 254, label: 'Email' }).toLowerCase();
  if (!isEmail(email)) throw new ValidationError(field, 'Enter a valid email address');
  return email;
}

export function numberValue(
  value: unknown,
  field: string,
  { min = -Infinity, max = Infinity, label, required = false }: {
    min?: number;
    max?: number;
    label?: string;
    required?: boolean;
  } = {},
): number | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ValidationError(field, `${label ?? field} is required`);
    return null;
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) {
    throw new ValidationError(field, `${label ?? field} must be a number`);
  }
  if (num < min || num > max) {
    throw new ValidationError(field, `${label ?? field} must be between ${min} and ${max}`);
  }
  return num;
}

export function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'on' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 'off' || value === 0 || value === '0') return false;
  return fallback;
}

/** Password policy — deliberately simple but strict enough for a public form. */
export function passwordString(value: unknown, field = 'password'): string {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ValidationError(field, 'Password must be at least 8 characters');
  }
  if (value.length > 200) {
    throw new ValidationError(field, 'Password must be under 200 characters');
  }
  return value;
}

export interface FounderInput {
  name: string;
  email: string;
  phone: string | null;
  school_year: string | null;
}

export function parseFounders(value: unknown): FounderInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('founders', 'Add at least one founder (team member)');
  }
  if (value.length > 12) {
    throw new ValidationError('founders', 'A team can have at most 12 founders');
  }
  return value.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      name: requiredString(item.name, `founders[${index}].name`, {
        max: 120,
        label: `Founder ${index + 1} name`,
      }),
      email: emailString(item.email, `founders[${index}].email`),
      phone: optionalString(item.phone, 'phone', { max: 40, label: 'Phone' }),
      school_year: optionalString(item.school_year, 'school_year', {
        max: 40,
        label: 'Year / level',
      }),
    };
  });
}

/** Normalises untrusted JSON bodies into a plain object. */
export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
