const fs = require("fs");
const path = require("path");

const CONTRACT_NO = "22810157800034988";
const START_REPAY_DATE = "2026-06-01";
const RECORD_TIME = "01:12:00";
const MONTHLY_RATE = 0.032 / 12;
const MONTHLY_PAYMENT = 5715.71;
const START_PRINCIPAL = 699601.82;
const MAX_PERIODS = 1000;

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function nextMonthDate(dateText) {
  const [yearText, monthText, dayText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const currentDate = new Date(Date.UTC(year, month - 1, day));

  if (
    currentDate.getUTCFullYear() !== year ||
    currentDate.getUTCMonth() + 1 !== month ||
    currentDate.getUTCDate() !== day
  ) {
    throw new Error(`输入日期无效: ${dateText}`);
  }

  const nextDate = new Date(currentDate.getTime());
  nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);

  if (nextDate.getUTCDate() !== day) {
    throw new Error(`无法稳妥推进到下个月: ${dateText}`);
  }

  return nextDate.toISOString().slice(0, 10);
}

function buildRepaymentSchedule() {
  const schedule = [];
  let repayDate = START_REPAY_DATE;
  let remainingPrincipal = START_PRINCIPAL;
  let period = 0;

  while (remainingPrincipal > 0) {
    period += 1;
    if (period > MAX_PERIODS) {
      throw new Error(`还款期数超过最大限制 ${MAX_PERIODS}，请检查配置`);
    }

    const interest = roundCurrency(remainingPrincipal * MONTHLY_RATE);
    const scheduledPrincipal = roundCurrency(MONTHLY_PAYMENT - interest);
    if (scheduledPrincipal <= 0) {
      throw new Error(
        `月供不足以覆盖利息，无法推进还款计划: monthlyPayment=${MONTHLY_PAYMENT}, interest=${interest}, repayDate=${repayDate}`
      );
    }
    const isLastPeriod = scheduledPrincipal >= remainingPrincipal;
    const principal = isLastPeriod ? roundCurrency(remainingPrincipal) : scheduledPrincipal;
    const payment = isLastPeriod
      ? roundCurrency(principal + interest)
      : roundCurrency(MONTHLY_PAYMENT);
    const remainingPrincipalAfterPayment = roundCurrency(remainingPrincipal - principal);

    schedule.push({
      contractNo: CONTRACT_NO,
      repayDate,
      principal,
      interest,
      penalty: 0,
      compoundInterest: 0,
      payment,
      remainingPrincipalAfterPayment,
    });

    remainingPrincipal = remainingPrincipalAfterPayment;
    repayDate = nextMonthDate(repayDate);
  }

  return schedule;
}

function buildUsageRecords(schedule) {
  return schedule
    .map((item) => ({
      title: "还款",
      amount: item.payment,
      occurAt: `${item.repayDate}T${RECORD_TIME}`,
      principal: item.principal,
      interest: item.interest,
      penalty: 0,
      compoundInterest: 0,
    }))
    .reverse();
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function generateRepaymentData() {
  const schedule = buildRepaymentSchedule();
  const usageRecords = buildUsageRecords(schedule);

  return { schedule, usageRecords };
}

function writeRepaymentData(options = {}) {
  const assetDataDir = path.join(__dirname, "..", "data");
  const schedulePath = path.join(assetDataDir, "repayment_schedule.json");
  const usagePath = path.join(assetDataDir, "usage_records.json");
  const { schedule, usageRecords } = generateRepaymentData();

  writeJson(schedulePath, schedule);
  writeJson(usagePath, usageRecords);

  if (options.compatScheduleOutputPath) {
    writeJson(options.compatScheduleOutputPath, schedule);
  }

  return {
    schedule,
    usageRecords,
    schedulePath,
    usagePath,
  };
}

if (require.main === module) {
  const result = writeRepaymentData();
  console.log(`repayment_schedule: ${result.schedulePath}`);
  console.log(`usage_records: ${result.usagePath}`);
  console.log(`first_period: ${JSON.stringify(result.schedule[0])}`);
  console.log(`last_period: ${JSON.stringify(result.schedule[result.schedule.length - 1])}`);
  console.log(`total_periods: ${result.schedule.length}`);
}

module.exports = {
  CONTRACT_NO,
  MONTHLY_PAYMENT,
  MONTHLY_RATE,
  START_PRINCIPAL,
  START_REPAY_DATE,
  buildRepaymentSchedule,
  buildUsageRecords,
  generateRepaymentData,
  writeRepaymentData,
};
