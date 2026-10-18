import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { customerArrearsReportText } from "./arrears-report";
import { rupiah } from "./billing";

describe("customer arrears notice", () => {
  const report = {
    name: "ADI SUGENG CAHYANA", code: "PAM08-075",
    items: [
      { month: 8, year: 2026, amount: 101000, paid: false },
      { month: 7, year: 2026, amount: 105000, paid: false },
      { month: 6, year: 2026, amount: 105000, paid: false },
      { month: 5, year: 2026, amount: 85000, paid: true },
    ],
  };
  test("only unpaid entries contribute to the 311000 customer balance", () => {
    const text = customerArrearsReportText(report);
    assert.ok(text.includes(`Total Tunggakan: ${rupiah(311000)}`));
    assert.ok(!text.includes(`Mei 2026: ${rupiah(85000)}`));
  });
  test("print and WhatsApp use identical customer data", () => {
    assert.equal(customerArrearsReportText(report, true).replaceAll("*", "").replaceAll("_", ""),
      customerArrearsReportText(report));
  });
});