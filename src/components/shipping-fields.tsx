"use client";
import type { ShippingAddress } from "@/lib/types";
import { NIGERIAN_STATES } from "@/lib/utils";
export type ShippingErrors = Partial<Record<keyof ShippingAddress, string>>;
export function ShippingFields({
  value,
  onChange,
  errors = {},
  includeNotes = true,
  onBlur,
}: {
  value: ShippingAddress;
  onChange: (value: ShippingAddress) => void;
  errors?: ShippingErrors;
  includeNotes?: boolean;
  onBlur?: (key: keyof ShippingAddress) => void;
}) {
  const field = (
    key: keyof ShippingAddress,
    label: string,
    placeholder: string,
    type = "text",
    autocomplete?: string,
    wide = false,
  ) => (
    <div key={key} className={`form-field ${wide ? "form-wide" : ""}`}>
      <label htmlFor={`shipping-${key}`}>
        {label}
        <span>*</span>
      </label>
      <input
        id={`shipping-${key}`}
        type={type}
        value={value[key] || ""}
        placeholder={placeholder}
        autoComplete={autocomplete}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        onBlur={() => onBlur?.(key)}
        required
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `error-${key}` : undefined}
        maxLength={key === "address" ? 300 : key === "email" ? 254 : 100}
      />
      {errors[key] && (
        <small id={`error-${key}`} className="field-error">
          {errors[key]}
        </small>
      )}
    </div>
  );
  return (
    <div className="form-grid">
      {field(
        "fullName",
        "Full name",
        "Your first and last name",
        "text",
        "name",
      )}
      {field("email", "Email address", "you@example.com", "email", "email")}
      {field("phone", "Phone number", "08012345678", "tel", "tel", true)}
      {field(
        "address",
        "Delivery address",
        "House number, street, and area",
        "text",
        "street-address",
        true,
      )}
      {field("city", "City", "e.g. Ikeja", "text", "address-level2")}
      <div className="form-field">
        <label htmlFor="shipping-state">
          State<span>*</span>
        </label>
        <select
          id="shipping-state"
          value={value.state}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          onBlur={() => onBlur?.("state")}
          aria-invalid={!!errors.state}
          aria-describedby={errors.state ? "error-state" : undefined}
          autoComplete="address-level1"
          required
        >
          {NIGERIAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        {errors.state && (
          <small id="error-state" className="field-error">
            {errors.state}
          </small>
        )}
      </div>
      {includeNotes && (
        <div className="form-field form-wide">
          <label htmlFor="shipping-notes">
            A little note for us <small>(optional)</small>
          </label>
          <textarea
            id="shipping-notes"
            rows={3}
            maxLength={500}
            value={value.notes || ""}
            placeholder="Delivery instructions, preferred sizes, or anything we should know."
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            onBlur={() => onBlur?.("notes")}
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? "error-notes" : undefined}
          />
          {errors.notes && (
            <small id="error-notes" className="field-error">
              {errors.notes}
            </small>
          )}
        </div>
      )}
    </div>
  );
}
