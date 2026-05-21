const assert = require("assert");
const path = require("path");

const dataModulePath = path.join(__dirname, "..", "assets", "scripts", "data.cjs");
const browserModulePath = path.join(__dirname, "..", "assets", "scripts", "data.js");
delete globalThis.FakeBankData;
delete require.cache[require.resolve(dataModulePath)];
delete require.cache[require.resolve(browserModulePath)];

const data = require(dataModulePath);
const schedule = require(path.join(__dirname, "..", "assets", "data", "repayment_schedule.json"));

assert.equal(globalThis.FakeBankData, undefined);

globalThis.FakeBankData = "__sentinel__";
delete require.cache[require.resolve(dataModulePath)];
delete require.cache[require.resolve(browserModulePath)];
require(dataModulePath);
assert.equal(globalThis.FakeBankData, "__sentinel__");
delete globalThis.FakeBankData;

assert.equal(
  data.calculateOutstandingPrincipal("2026-05-24", schedule),
  1199601.82
);

assert.equal(
  data.calculateOutstandingPrincipal("2026-05-25", schedule),
  699601.82
);
assert.throws(
  function () {
    data.calculateOutstandingPrincipal(new Date(2026, 4, 25), schedule);
  },
  /日期必须是 YYYY-MM-DD 字符串/
);
assert.throws(
  function () {
    data.filterRecentMonths(schedule, new Date(2026, 7, 15), 3);
  },
  /日期必须是 YYYY-MM-DD 字符串/
);

const recentThreeMonths = data.filterRecentMonths(schedule, "2026-08-15", 3);
assert.equal(recentThreeMonths.length, 3);
assert.deepEqual(
  recentThreeMonths.map((item) => item.repayDate),
  ["2026-06-01", "2026-07-01", "2026-08-01"]
);
assert.ok(recentThreeMonths.every((item) => schedule.includes(item)));
assert.ok(recentThreeMonths.every((item) => !("isPlaceholder" in item)));

const recentTwelveMonths = data.filterRecentMonths(schedule, "2026-05-19", 12);
assert.equal(recentTwelveMonths.length, 0);
assert.ok(recentTwelveMonths.every((item) => schedule.includes(item)));
assert.ok(recentTwelveMonths.every((item) => !("isPlaceholder" in item)));

console.log("assert-data.js ok");
