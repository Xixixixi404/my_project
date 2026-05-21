(function (globalScope, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  if (globalScope && typeof globalScope === "object") {
    globalScope.FakeBankData = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const contractSummary = {
    contractNo: "22810045400029440",
    loanContractNo: "22810157800034988",
    loanVoucherNo: "510220210856725",
    currentDateOverride: "",
    totalAmount: 1300000,
    usedAmount: 1300000,
    availableAmount: 0,
    annualRate: 3.2,
    loanIssuedDate: "2022-01-01",
    prepaymentLoanDueDate: "2051-12-31",
    originalRemainingPrincipal: 1199601.82,
    prepaymentAmount: 500000,
    prepaymentDate: "2026-05-25",
    firstRepaymentDate: "2026-06-01",
  };

  function roundCurrency(value) {
    return Number(Number(value || 0).toFixed(2));
  }

  function parseDate(dateText) {
    if (typeof dateText !== "string") {
      throw new Error("日期必须是 YYYY-MM-DD 字符串");
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
    if (!match) {
      throw new Error(`日期格式无效: ${dateText}`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error(`日期值无效: ${dateText}`);
    }

    return parsed;
  }

  function formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function monthStart(dateInput) {
    const date = parseDate(dateInput);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  function monthStartFromParsedDate(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  function addMonths(date, delta) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
  }

  function findScheduleByRepayDate(schedule, repayDate) {
    return schedule.find(function (item) {
      return item && item.repayDate === repayDate;
    });
  }

  function formatCurrency(value) {
    return roundCurrency(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function calculateOutstandingPrincipal(today, schedule) {
    const effectiveToday = parseDate(today);
    const prepaymentDate = parseDate(contractSummary.prepaymentDate);
    const normalizedSchedule = Array.isArray(schedule) ? schedule : [];

    let outstanding = contractSummary.originalRemainingPrincipal;

    if (effectiveToday >= prepaymentDate) {
      outstanding -= contractSummary.prepaymentAmount;
    }

    for (let index = 0; index < normalizedSchedule.length; index += 1) {
      const item = normalizedSchedule[index];
      if (!item || typeof item.repayDate !== "string") {
        continue;
      }

      if (parseDate(item.repayDate) < effectiveToday) {
        outstanding -= Number(item.principal || 0);
      }
    }

    return roundCurrency(Math.max(outstanding, 0));
  }

  function filterRecentMonths(schedule, today, months) {
    const normalizedSchedule = Array.isArray(schedule) ? schedule : [];
    const normalizedMonths = Math.max(0, Math.floor(Number(months) || 0));
    const effectiveToday = parseDate(today);
    const startMonth = addMonths(monthStartFromParsedDate(effectiveToday), -(normalizedMonths - 1));

    return normalizedSchedule.filter(function (item) {
      if (!item || typeof item.repayDate !== "string") {
        return false;
      }

      const repayDate = parseDate(item.repayDate);
      return repayDate >= startMonth && repayDate <= effectiveToday;
    });
  }

  return {
    contractSummary: contractSummary,
    formatCurrency: formatCurrency,
    calculateOutstandingPrincipal: calculateOutstandingPrincipal,
    filterRecentMonths: filterRecentMonths,
  };
});
