import assert from "node:assert/strict";
import test from "node:test";
import { changeStatusPreserving, getBalanceCountdown } from "../lib/domain.ts";

const localNow = new Date(2026, 7, 4, 23, 58);

test("没有补款截止日期时不显示倒计时", () => {
  assert.equal(getBalanceCountdown(undefined, localNow), null);
});

test("按用户本地日期计算今天、未来和逾期", () => {
  assert.equal(getBalanceCountdown("2026-08-04", localNow), "今天截止");
  assert.equal(getBalanceCountdown("2026-08-09", localNow), "距离补款截止还有 5 天");
  assert.equal(getBalanceCountdown("2026-08-01", localNow), "已逾期 3 天");
});

test("状态切换保留历史字段", () => {
  const before = {
    status: "balance_due",
    balanceAmount: 1200,
    balanceDueDate: "2026-08-09",
    estimatedShipping: "九月",
  };
  const after = changeStatusPreserving(before, "paid_waiting_receipt");
  assert.equal(after.status, "paid_waiting_receipt");
  assert.equal(after.balanceAmount, 1200);
  assert.equal(after.balanceDueDate, "2026-08-09");
  assert.equal(after.estimatedShipping, "九月");
});
