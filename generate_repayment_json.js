const { writeRepaymentData } = require("./assets/scripts/generate-repayment");

const result = writeRepaymentData();

console.log(`repayment_schedule: ${result.schedulePath}`);
console.log(`usage_records: ${result.usagePath}`);
console.log(`first_period: ${JSON.stringify(result.schedule[0])}`);
console.log(`last_period: ${JSON.stringify(result.schedule[result.schedule.length - 1])}`);
console.log(`total_periods: ${result.schedule.length}`);
