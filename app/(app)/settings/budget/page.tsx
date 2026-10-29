import { permanentRedirect } from "next/navigation";

/** 預算 moved to a main bookmark. */
export default function OldBudget() {
  permanentRedirect("/budget");
}
