import type { Ref } from "react";

export function AmountField({
  id,
  value,
  onChange,
  error,
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="amt-wrap">
      <div className="amtrow">
        <label htmlFor={id}>金額</label>
        <span className="cur" aria-hidden="true">
          NT$
        </span>
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
