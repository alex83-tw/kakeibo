import type { Ref } from "react";
import { CURRENCIES } from "@/lib/domain/fx";

const SYMBOL: Record<string, string> = { TWD: "NT$" };

export function AmountField({
  id,
  value,
  onChange,
  error,
  inputRef,
  currency,
  onCurrency,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** With both, the NT$ label becomes a picker; `onCurrency` null keeps it fixed on 台幣 (a transfer). */
  currency?: string;
  onCurrency?: ((c: string) => void) | null;
}) {
  return (
    <div className="amt-wrap">
      <div className="amtrow">
        <label htmlFor={id}>金額</label>
        {currency !== undefined && onCurrency !== undefined ? (
          <select
            id={`${id}-cur`}
            className="cur"
            aria-label="幣別"
            value={currency}
            disabled={onCurrency === null}
            onChange={(e) => onCurrency?.(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {SYMBOL[c] ?? c}
              </option>
            ))}
          </select>
        ) : (
          <span className="cur" aria-hidden="true">
            NT$
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-err`}
        />
      </div>
      <p id={`${id}-err`} className="fld-err" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
