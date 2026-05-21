const fs = require("fs");
const path = require("path");
const assert = require("assert");

const schedulePath = path.join(__dirname, "..", "assets", "data", "repayment_schedule.json");
const usagePath = path.join(__dirname, "..", "assets", "data", "usage_records.json");

assert.ok(fs.existsSync(schedulePath), `缺少文件: ${schedulePath}`);
assert.ok(fs.existsSync(usagePath), `缺少文件: ${usagePath}`);

const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
const usageRecords = JSON.parse(fs.readFileSync(usagePath, "utf8"));

function parseIsoTimestamp(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, `occurAt 不是 ISO 8601: ${value}`);
  const timestamp = Date.parse(`${value}Z`);
  assert.ok(Number.isFinite(timestamp), `occurAt 无法安全解析: ${value}`);
  return timestamp;
}

assert.ok(Array.isArray(schedule) && schedule.length > 0, "repayment_schedule.json 必须为非空数组");
assert.ok(Array.isArray(usageRecords) && usageRecords.length > 0, "usage_records.json 必须为非空数组");

assert.strictEqual(schedule[0].contractNo, "22810157800034988", "贷款合约号错误");
assert.strictEqual(schedule[0].repayDate, "2026-06-01", "首期还款日错误");
assert.strictEqual(schedule[0].penalty, 0, "首期 penalty 必须为 0");
assert.strictEqual(schedule[0].compoundInterest, 0, "首期 compoundInterest 必须为 0");
assert.ok("payment" in schedule[0], "首期缺少 payment 字段");
assert.ok("remainingPrincipalAfterPayment" in schedule[0], "首期缺少 remainingPrincipalAfterPayment 字段");

for (const item of schedule) {
  assert.strictEqual(item.penalty, 0, `计划表 penalty 非 0: ${item.repayDate}`);
  assert.strictEqual(item.compoundInterest, 0, `计划表 compoundInterest 非 0: ${item.repayDate}`);
}

for (const item of usageRecords) {
  assert.strictEqual(item.title, "还款", `使用记录 title 错误: ${item.occurAt}`);
  parseIsoTimestamp(item.occurAt);
  assert.strictEqual(item.penalty, 0, `使用记录 penalty 非 0: ${item.occurAt}`);
  assert.strictEqual(item.compoundInterest, 0, `使用记录 compoundInterest 非 0: ${item.occurAt}`);
  assert.notStrictEqual(item.amount, 500000, "使用记录不应包含提前还款 500000");
}

for (let index = 1; index < usageRecords.length; index += 1) {
  const previous = parseIsoTimestamp(usageRecords[index - 1].occurAt);
  const current = parseIsoTimestamp(usageRecords[index].occurAt);
  assert.ok(previous >= current, "usage_records.json 必须按时间倒序输出");
}

console.log("assert-repayment: ok");
