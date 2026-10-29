export type EntryType = "income" | "expense" | "transfer";
export type AccountKind = "cash" | "bank" | "e_wallet" | "credit_card";

export interface Entry {
  id: string;
  entry_type: EntryType;
  main_category: string;
  sub_category: string | null;
  amount: number;
  currency: string;
  /** YYYY-MM-DD, Taiwan calendar date */
  entry_date: string;
  notes: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  deleted_at: string | null;
  is_recurring: boolean;
  /** Set when `amount`/`currency` above were converted to TWD at the entry-date rate; holds what is stored. */
  foreign?: { currency: string; amount: number; rate: number };
}

export interface LedgerAccount {
  id: string;
  kind: AccountKind;
  name: string;
  opening_balance: number;
  /** only movements on or after this date count toward the balance */
  opening_date: string;
  sort_order: number;
  archived: boolean;
}
