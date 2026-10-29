import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_USER, fixtureClient, fixturesEnabled, resetFixtures } from "./fixtures";
import { listEntries, setEntryDeleted } from "../repos/entries";
import { listAccounts } from "../repos/accounts";

beforeEach(() => resetFixtures());

describe("fixturesEnabled", () => {
  it("only in development with the flag", () => {
    expect(fixturesEnabled({ NODE_ENV: "development", KAKEIBO_DEV_FIXTURES: "1" })).toBe(true);
    expect(fixturesEnabled({ NODE_ENV: "production", KAKEIBO_DEV_FIXTURES: "1" })).toBe(false);
    expect(fixturesEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(fixturesEnabled({ NODE_ENV: "test", KAKEIBO_DEV_FIXTURES: "1" })).toBe(false);
  });
});

describe("fixture client through the real repositories", () => {
  it("scopes by user and hides soft-deleted rows", async () => {
    const c = fixtureClient();
    const all = await listEntries(c, FIXTURE_USER, { start: "2000-01-01", end: "2999-12-31" });
    expect(all.length).toBeGreaterThan(5);
    expect(await listEntries(c, "someone-else", { start: "2000-01-01", end: "2999-12-31" })).toEqual([]);
    expect(await setEntryDeleted(c, FIXTURE_USER, all[0].id, true)).toBe(true);
    const after = await listEntries(c, FIXTURE_USER, { start: "2000-01-01", end: "2999-12-31" });
    expect(after).toHaveLength(all.length - 1);
    expect(await setEntryDeleted(c, "someone-else", all[1].id, true)).toBe(false);
  });
  it("converts a foreign entry to TWD with the exchange_rates row, keeping what is stored", async () => {
    const all = await listEntries(fixtureClient(), FIXTURE_USER, { start: "2000-01-01", end: "2999-12-31" });
    const yen = all.find((e) => e.foreign);
    expect(yen).toMatchObject({ currency: "TWD", amount: 5, foreign: { currency: "JPY", amount: 25, rate: 0.21 } }); // 25 × 0.21 = 5.25
  });
  it("lists accounts in order", async () => {
    expect((await listAccounts(fixtureClient(), FIXTURE_USER)).map((a) => a.name)).toEqual(["現金", "銀行", "信用卡"]);
  });
});
