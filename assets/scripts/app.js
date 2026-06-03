(function () {
  const schedulePath = "./assets/data/repayment_schedule.json";
  const usagePath = "./assets/data/usage_records.json";
  const historyPath = "./assets/data/repayment_history.json";
  const DATA_CACHE_PREFIX = "fake-bank-data-cache:";
  const STATIC_DATA_MAP = {
    [schedulePath]: "repaymentSchedule",
    [usagePath]: "usageRecords",
    [historyPath]: "repaymentHistory",
  };

  function getStaticData(relativePath) {
    const staticDataKey = STATIC_DATA_MAP[relativePath];
    if (!staticDataKey || !window.FakeBankStaticData) {
      return null;
    }

    const value = window.FakeBankStaticData[staticDataKey];
    return value == null ? null : value;
  }

  function getCachedData(relativePath) {
    try {
      const rawValue = window.localStorage.getItem(`${DATA_CACHE_PREFIX}${relativePath}`);
      if (!rawValue) {
        return null;
      }

      return JSON.parse(rawValue);
    } catch (error) {
      return null;
    }
  }

  function setCachedData(relativePath, data) {
    try {
      window.localStorage.setItem(`${DATA_CACHE_PREFIX}${relativePath}`, JSON.stringify(data));
    } catch (error) {
      // 忽略缓存写入失败，页面仍然可以继续使用在线数据
    }
  }

  async function loadJson(relativePath) {
    const staticData = getStaticData(relativePath);
    if (staticData !== null) {
      return staticData;
    }

    try {
      const response = await fetch(relativePath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`加载失败: ${relativePath}`);
      }

      const data = await response.json();
      setCachedData(relativePath, data);
      return data;
    } catch (error) {
      const cachedData = getCachedData(relativePath);
      if (cachedData !== null) {
        return cachedData;
      }

      throw error;
    }
  }

  function getTodayString() {
    const overrideDate = window.FakeBankData &&
      window.FakeBankData.contractSummary &&
      window.FakeBankData.contractSummary.currentDateOverride;

    if (typeof overrideDate === "string" && overrideDate) {
      return overrideDate;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function bindBackButtons() {
    document.querySelectorAll("[aria-label='返回']").forEach(function (button) {
      button.addEventListener("click", function (event) {
        if (document.body.dataset.page === "home") {
          event.preventDefault();
          return;
        }

        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.location.href = "./index.html";
      });
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    var scopeUrl = new URL("./", window.location.href);
    var scriptUrl = new URL("./sw.js", window.location.href);

    navigator.serviceWorker.register(scriptUrl.pathname, { scope: scopeUrl.pathname }).catch(function (error) {
      console.error("service worker register failed", error);
    });
  }

  function formatMoney(value) {
    return window.FakeBankData.formatCurrency(value);
  }

  function getLatestRepaymentDate(schedule) {
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return "--";
    }

    return schedule[schedule.length - 1].repayDate;
  }

  function formatChineseDate(dateText) {
    const parts = String(dateText).split("-");
    if (parts.length !== 3) {
      return dateText;
    }

    return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
  }

  function findCurrentMonthPayment(schedule, today) {
    const [year, month] = today.split("-");
    const matched = (schedule || []).find(function (item) {
      return typeof item.repayDate === "string" && item.repayDate.startsWith(`${year}-${month}`);
    });

    return matched ? matched.payment : 0;
  }

  function findNextUpcomingPayment(schedule, today) {
    const normalizedSchedule = Array.isArray(schedule) ? schedule : [];
    for (let index = 0; index < normalizedSchedule.length; index += 1) {
      const item = normalizedSchedule[index];
      if (item && typeof item.repayDate === "string" && item.repayDate >= today) {
        return item;
      }
    }

    return null;
  }

  function parseDateParts(dateText) {
    const parts = String(dateText).split("-");
    if (parts.length !== 3) {
      return null;
    }

    return {
      year: Number(parts[0]),
      month: Number(parts[1]),
      day: Number(parts[2]),
    };
  }

  function monthSerial(dateText) {
    const parts = parseDateParts(dateText);
    if (!parts) {
      return NaN;
    }

    return parts.year * 12 + (parts.month - 1);
  }

  function calculatePeriodNumber(repayDate) {
    const startSerial = monthSerial("2022-02-01");
    const repaySerial = monthSerial(repayDate);
    return repaySerial - startSerial + 1;
  }

  function filterUpcomingMonths(schedule, today, months) {
    const normalizedSchedule = Array.isArray(schedule) ? schedule : [];
    const normalizedMonths = Math.max(0, Math.floor(Number(months) || 0));
    const upcomingRecords = normalizedSchedule.filter(function (item) {
      return item && typeof item.repayDate === "string" && item.repayDate >= today;
    });

    if (upcomingRecords.length === 0 || normalizedMonths === 0) {
      return [];
    }

    const startSerial = monthSerial(upcomingRecords[0].repayDate);
    const endSerial = startSerial + normalizedMonths - 1;

    return upcomingRecords.filter(function (item) {
      if (!item || typeof item.repayDate !== "string") {
        return false;
      }

      const itemSerial = monthSerial(item.repayDate);
      return itemSerial >= startSerial && itemSerial <= endSerial;
    });
  }

  function buildRepaymentHistoryRecords(historyRecords, scheduleRecords, today) {
    const normalizedRecords = Array.isArray(historyRecords) ? historyRecords.slice() : [];
    const summary = window.FakeBankData.contractSummary;
    const hasPrepaymentRecord = normalizedRecords.some(function (item) {
      return item &&
        item.repayDate === summary.prepaymentDate &&
        Number(item.principal || 0) === Number(summary.prepaymentAmount);
    });

    if (!hasPrepaymentRecord) {
      normalizedRecords.push({
        contractNo: summary.loanContractNo,
        repayDate: summary.prepaymentDate,
        principal: summary.prepaymentAmount,
        interest: 0,
        penalty: 0,
        compoundInterest: 0,
        payment: summary.prepaymentAmount,
      });
    }

    const normalizedScheduleRecords = Array.isArray(scheduleRecords) ? scheduleRecords : [];
    normalizedScheduleRecords.forEach(function (item) {
      if (!item || typeof item.repayDate !== "string" || item.repayDate > today) {
        return;
      }

      const hasHistoryRecord = normalizedRecords.some(function (historyItem) {
        return historyItem &&
          historyItem.contractNo === item.contractNo &&
          historyItem.repayDate === item.repayDate;
      });

      if (!hasHistoryRecord) {
        normalizedRecords.push({
          contractNo: item.contractNo,
          repayDate: item.repayDate,
          principal: Number(item.principal || 0),
          interest: Number(item.interest || 0),
          penalty: Number(item.penalty || 0),
          compoundInterest: Number(item.compoundInterest || 0),
          payment: Number(item.payment || 0),
        });
      }
    });

    return normalizedRecords.sort(function (left, right) {
      return String(left.repayDate).localeCompare(String(right.repayDate));
    });
  }

  function renderHomePage(schedule) {
    const today = getTodayString();
    const outstanding = window.FakeBankData.calculateOutstandingPrincipal(today, schedule);
    const monthlyDue = 0;

    document.getElementById("home-summary").innerHTML = `
      <button class="hero-card__detail-chip" id="open-monthly-due-detail" type="button">应还详情</button>
      <div class="hero-card__amount">${formatMoney(monthlyDue)}</div>
      <div class="hero-card__label">本月应还(元)</div>
      <div class="hero-card__stats">
        <div class="hero-stat">
          <div class="hero-stat__value">${formatMoney(outstanding)}</div>
          <div class="hero-stat__label">未还本金总计(元)<img class="hero-stat__eye" src="./assets/icons/eye.svg" alt="" /></div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat__value hero-stat__value--warning">${formatMoney(0)}</div>
          <div class="hero-stat__label">可用额度(元)</div>
        </div>
      </div>
    `;

    document.getElementById("feature-grid").innerHTML = `
      <button class="feature-grid__item" type="button">
        <img class="feature-grid__icon" src="./assets/icons/todo.png" alt="" />
        <span class="feature-grid__label">待办任务</span>
      </button>
      <button class="feature-grid__item" type="button">
        <img class="feature-grid__icon" src="./assets/icons/progress.png" alt="" />
        <span class="feature-grid__label">进度查询</span>
      </button>
      <button class="feature-grid__item" type="button">
        <img class="feature-grid__icon" src="./assets/icons/keep.png" alt="" />
        <span class="feature-grid__label">贷款续贷</span>
      </button>
      <button class="feature-grid__item" type="button">
        <img class="feature-grid__icon" src="./assets/icons/proof.png" alt="" />
        <span class="feature-grid__label">结清证明</span>
      </button>
    `;

    document.getElementById("contract-panel-body").innerHTML = `
      <div class="contract-list">
        <button class="row-link" id="loan-entry" type="button">
          <span class="row-link__label">个人住房贷款</span>
          <span class="row-link__meta" aria-hidden="true">
            <img class="arrow-icon arrow-icon--right row-link__meta-icon" src="./assets/icons/arrow.svg" alt="" />
          </span>
        </button>
        <div class="field-row"><span>合同额度</span><strong>¥${formatMoney(1300000)}</strong></div>
        <div class="field-row"><span>合同到期日</span><strong>2051-12-26</strong></div>
        <div class="field-row field-row--single">
          <span class="field-label field-label--with-icon">
            <span>报税信息</span>
            <img class="info-mark" src="./assets/icons/tips.svg" alt="" aria-hidden="true" />
          </span>
        </div>
        <button class="field-row field-row--button" id="contract-detail-toggle" type="button">
          <span>合同详情</span>
          <strong class="field-disclosure" aria-hidden="true">
            <img class="arrow-icon arrow-icon--up field-disclosure__icon" id="contract-detail-arrow" src="./assets/icons/arrow.svg" alt="" />
          </strong>
        </button>
        <div class="field-row contract-detail-row is-hidden"><span>合同合约号</span><strong>${window.FakeBankData.contractSummary.contractNo}</strong></div>
        <div class="field-row contract-detail-row is-hidden"><span>合同签订日期</span><strong>2021-12-27</strong></div>
      </div>
      <div class="panel__header contract-note">
        <p class="contract-note__text">温馨提示：以上内容仅供参考，如需了解详情请联系您的客户经理。</p>
      </div>
    `;

    document.getElementById("loan-entry").addEventListener("click", function () {
      window.location.href = "./loan-detail.html";
    });

    document.getElementById("open-monthly-due-detail").addEventListener("click", function () {
      window.location.href = "./monthly-due-detail.html";
    });

    document.getElementById("contract-detail-toggle").addEventListener("click", function () {
      const hiddenRows = document.querySelectorAll(".contract-detail-row");
      const arrow = document.getElementById("contract-detail-arrow");
      const isExpanded = hiddenRows.length > 0 && !hiddenRows[0].classList.contains("is-hidden");

      hiddenRows.forEach(function (row) {
        row.classList.toggle("is-hidden", isExpanded);
      });

      arrow.classList.toggle("arrow-icon--up", isExpanded);
      arrow.classList.toggle("arrow-icon--down", !isExpanded);
    });
  }

  function renderLoanDetailPage(schedule) {
    const today = getTodayString();
    const outstanding = window.FakeBankData.calculateOutstandingPrincipal(today, schedule);
    const lastDate = getLatestRepaymentDate(schedule);

    document.getElementById("loan-detail-summary").innerHTML = `
      <div class="loan-overview">
        <div class="loan-ring">
          <div class="loan-ring__content">
            <div class="loan-ring__label">可用额度(元)</div>
            <div class="loan-ring__value">${formatMoney(0)}</div>
          </div>
        </div>
        <div class="metric-row">
          <div class="metric-row__cell">
            <div class="metric-row__value">${formatMoney(1300000)}</div>
            <div class="metric-row__label">总额度(元)</div>
          </div>
          <div class="metric-row__cell">
            <div class="metric-row__value">${formatMoney(1300000)}</div>
            <div class="metric-row__label">已用额度(元)</div>
          </div>
        </div>
      </div>
    `;

      document.getElementById("loan-detail-fields").innerHTML = `
        <div class="panel__body loan-card">
          <div class="field-row loan-card__lead"><span class="row-link__label">贷款发放日</span><strong>2022年1月1日</strong></div>
          <div class="field-row"><span>贷款金额</span><strong>${formatMoney(1300000)}元</strong></div>
          <div class="field-row"><span>未还本金</span><strong>${formatMoney(outstanding)}元</strong></div>
        <div class="field-row"><span>贷款年化利率</span><strong>3.2%</strong></div>
        <div class="field-row"><span>利率定价方式</span><strong>浮动利率</strong></div>
        <div class="field-row"><span>利率定价基准</span><strong>LPR</strong></div>
        <div class="field-row"><span>利率浮动幅度</span><strong>-30bp</strong></div>
        <div class="field-row"><span>重定价周期</span><strong>12个月</strong></div>
        <div class="field-row"><span>重定价日</span><strong>1月1日</strong></div>
        <div class="field-row"><span>贷款到期日</span><strong>${formatChineseDate(lastDate)}</strong></div>
        <div class="field-row"><span>贷款状态</span><strong>正常</strong></div>
      </div>
    `;

      document.getElementById("loan-detail-actions").innerHTML = `
        <div class="action-strip">
          <button class="action-strip__button" id="open-usage-record" type="button">
            <img class="action-strip__icon" src="./assets/icons/money.svg" alt="" />
            <span>提前还款</span>
          </button>
          <div class="action-strip__divider" aria-hidden="true"></div>
          <button class="action-strip__button" id="open-usage-history" type="button">
            <img class="action-strip__icon" src="./assets/icons/record.svg" alt="" />
            <span>使用记录</span>
          </button>
        </div>
      `;

    document.getElementById("loan-detail-bottom-action").innerHTML = `
      <div class="action-strip" style="margin-top:0;border-top:0.02rem solid var(--line);border-bottom:0;">
        <button class="action-strip__button" id="open-repayment-detail" type="button" style="grid-column:1 / span 3;">
          <span>还款详情</span>
        </button>
      </div>
      `;

    document.getElementById("open-usage-record").addEventListener("click", function () {
      window.location.href = "./prepayment-detail.html";
    });

    document.getElementById("open-usage-history").addEventListener("click", function () {
      window.location.href = "./usage-record.html";
    });

    document.getElementById("open-repayment-detail").addEventListener("click", function () {
      window.location.href = "./repayment-detail.html";
    });
  }

  function renderPrepaymentDetailPage(schedule) {
    const today = getTodayString();
    const outstanding = window.FakeBankData.calculateOutstandingPrincipal(today, schedule);
    const summary = window.FakeBankData.contractSummary;

    document.getElementById("prepayment-detail-top").innerHTML = `
      <div class="panel__body prepayment-card">
        <div class="field-row"><span>贷款凭证号</span><strong>${summary.loanVoucherNo}</strong></div>
      </div>
    `;

    document.getElementById("prepayment-detail-fields").innerHTML = `
      <div class="panel__body prepayment-card prepayment-card--stack">
        <div class="field-row"><span>贷款合约号</span><strong>${summary.loanContractNo}</strong></div>
        <div class="field-row"><span>贷款到期日</span><strong>${summary.prepaymentLoanDueDate}</strong></div>
        <div class="field-row"><span>用款时间</span><strong>${summary.loanIssuedDate}</strong></div>
        <div class="field-row field-row--rate">
          <span class="field-label field-label--with-icon">
            <span>贷款年化利率</span>
            <img class="info-mark" src="./assets/icons/tips.svg" alt="" aria-hidden="true" />
          </span>
          <strong>${summary.annualRate}%</strong>
        </div>
        <div class="field-row"><span>未还本金</span><strong>${formatMoney(outstanding)}元</strong></div>
      </div>
    `;

    document.getElementById("prepayment-detail-action").innerHTML = `
      <div class="action-strip prepayment-action-strip" style="margin-top:0;border-top:0.02rem solid var(--line);border-bottom:0;">
        <button class="action-strip__button prepayment-action-button" type="button" style="grid-column:1 / span 3;">
          <span>提前还款</span>
        </button>
      </div>
    `;
  }

  function renderMonthlyDueDetailPage() {
    const monthlyDue = 0;

    document.getElementById("monthly-due-detail-summary").innerHTML = `
      <div class="monthly-due-card">
        <div class="monthly-due-card__amount">${formatMoney(monthlyDue)}</div>
        <div class="monthly-due-card__label">应还合计(元)</div>
      </div>
    `;

    document.getElementById("monthly-due-detail-note").innerHTML = `
      <div class="panel__header contract-note monthly-due-note">
        <p class="contract-note__text">温馨提示：以上内容仅供参考，如需了解详情请联系您的客户经理。</p>
      </div>
    `;

    const nextMonthButton = document.querySelector('body[data-page="monthly-due-detail"] .text-button');
    if (nextMonthButton) {
      nextMonthButton.addEventListener("click", function () {
        window.location.href = "./next-month-due-detail.html";
      });
    }
  }

  function renderNextMonthDueDetailPage(schedule) {
    const today = getTodayString();
    const nextPayment = findNextUpcomingPayment(schedule, today);
    const amount = nextPayment ? Number(nextPayment.payment || 0) : 0;
    const repayDate = nextPayment ? nextPayment.repayDate : "--";

    document.getElementById("next-month-due-summary").innerHTML = `
      <div class="monthly-due-card">
        <div class="monthly-due-card__amount">${formatMoney(amount)}</div>
        <div class="monthly-due-card__label">待还合计(元)</div>
      </div>
    `;

    document.getElementById("next-month-due-list").innerHTML = `
      <article class="next-due-card is-expanded">
        <button class="next-due-card__head" id="next-month-due-toggle" type="button">
          <span class="next-due-card__date">${repayDate}</span>
          <span class="next-due-card__amount-group">
            <span class="next-due-card__amount">-${"¥"}${formatMoney(amount)}</span>
            <span class="record-card__caret" aria-hidden="true">
              <img class="arrow-icon arrow-icon--up field-disclosure__icon" id="next-month-due-arrow" src="./assets/icons/arrow.svg" alt="" />
            </span>
          </span>
        </button>
        <div class="next-due-card__body contract-detail-row is-hidden" id="next-month-due-body">
          <div class="field-row"><span>个人住房贷款</span><strong>${window.FakeBankData.contractSummary.contractNo}</strong></div>
          <div class="field-row"><span>扣款金额</span><strong>¥${formatMoney(amount)}</strong></div>
        </div>
      </article>
    `;

    document.getElementById("next-month-due-note").innerHTML = `
      <div class="panel__header contract-note monthly-due-note">
        <p class="contract-note__text">温馨提示：以上内容仅供参考，如需了解详情请联系您的客户经理。</p>
      </div>
    `;

    document.getElementById("next-month-due-toggle").addEventListener("click", function () {
      const detailBody = document.getElementById("next-month-due-body");
      const arrow = document.getElementById("next-month-due-arrow");
      const isExpanded = !detailBody.classList.contains("is-hidden");

      detailBody.classList.toggle("is-hidden", isExpanded);
      arrow.classList.toggle("arrow-icon--up", isExpanded);
      arrow.classList.toggle("arrow-icon--down", !isExpanded);
    });
  }

  function renderUsageRecordCard(item, expanded) {
    return `
      <article class="record-card ${expanded ? "is-expanded" : ""}" data-occur-at="${item.occurAt}">
        <button class="record-card__head" type="button" data-record-toggle="${item.occurAt}">
          <div>
            <div class="record-card__title">${item.title}</div>
            <div class="record-card__time">${item.occurAt.replace("T", " ")}</div>
          </div>
          <div class="record-card__amount-group">
            <span class="record-card__amount">+¥${formatMoney(item.amount)}</span>
            <span class="record-card__caret" aria-hidden="true">
              <img class="arrow-icon ${expanded ? "arrow-icon--up" : "arrow-icon--down"} record-card__caret-icon" src="./assets/icons/arrow.svg" alt="" />
            </span>
          </div>
        </button>
        <div class="record-card__body">
          <div class="field-row"><span>还款金额</span><strong>¥${formatMoney(item.amount)}</strong></div>
          <div class="field-row"><span>本金</span><strong>¥${formatMoney(item.principal)}</strong></div>
          <div class="field-row"><span>利息</span><strong>¥${formatMoney(item.interest)}</strong></div>
          <div class="field-row"><span>罚息</span><strong>¥0.00</strong></div>
          <div class="field-row"><span>罚息复利</span><strong>¥0.00</strong></div>
        </div>
      </article>
    `;
  }

  function renderUsageRecordPage(records) {
    const root = document.getElementById("usage-record-list");
    const hint = document.getElementById("usage-record-hint");
    let visibleCount = 1;
    const expandedSet = new Set();
    let touchStartY = null;

    function paint() {
      root.innerHTML = records
        .slice(0, visibleCount)
        .map(function (item) {
          return renderUsageRecordCard(item, expandedSet.has(item.occurAt));
        })
        .join("");

      hint.style.display = visibleCount >= records.length ? "none" : "flex";

      root.querySelectorAll("[data-record-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
          const key = button.getAttribute("data-record-toggle");
          if (expandedSet.has(key)) {
            expandedSet.delete(key);
          } else {
            expandedSet.add(key);
          }
          paint();
        });
      });
    }

    function loadNextRecord() {
      if (visibleCount >= records.length) {
        return false;
      }
      visibleCount += 1;
      paint();
      return true;
    }

    function onTouchStart(event) {
      const touch = event.touches && event.touches[0];
      touchStartY = touch ? touch.clientY : null;
    }

    function onTouchEnd(event) {
      const touch = event.changedTouches && event.changedTouches[0];
      if (touchStartY === null || !touch) {
        return;
      }

      const deltaY = touchStartY - touch.clientY;
      touchStartY = null;

      const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
      if (deltaY > 40 && nearBottom) {
        loadNextRecord();
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    paint();
  }

  function renderRepaymentCard(item) {
    return `
      <article class="repayment-card">
        <div class="field-row"><span>贷款合约号</span><strong>${item.contractNo}</strong></div>
        <div class="field-row"><span>还款日期</span><strong>${item.repayDate}</strong></div>
        <div class="field-row"><span>还本金额</span><strong>${formatMoney(item.principal)}元</strong></div>
        <div class="field-row"><span>还息金额</span><strong>${formatMoney(item.interest)}元</strong></div>
        <div class="field-row"><span>还罚息</span><strong>0.00元</strong></div>
        <div class="field-row"><span>还复利</span><strong>0.00元</strong></div>
      </article>
    `;
  }

  function renderRepaymentPlanCard(item) {
    return `
      <article class="repayment-card">
        <div class="field-row"><span>贷款合约号</span><strong>${item.contractNo}</strong></div>
        <div class="field-row"><span>期数</span><strong>${calculatePeriodNumber(item.repayDate)}</strong></div>
        <div class="field-row"><span>还款日期</span><strong>${item.repayDate}</strong></div>
        <div class="field-row"><span>还款金额</span><strong>${formatMoney(item.payment)}元</strong></div>
        <div class="field-row"><span>还本金额</span><strong>${formatMoney(item.principal)}元</strong></div>
        <div class="field-row"><span>还息金额</span><strong>${formatMoney(item.interest)}元</strong></div>
        <div class="field-row"><span>贷款余额</span><strong>${formatMoney(item.remainingPrincipalAfterPayment)}元</strong></div>
      </article>
    `;
  }

  function renderRepaymentDetailPage(historyRecords, scheduleRecords) {
    const today = getTodayString();
    const effectiveHistoryRecords = buildRepaymentHistoryRecords(historyRecords, scheduleRecords, today);
    const tabs = document.getElementById("repayment-tab-switch");
    const filters = document.getElementById("repayment-filters");
    const list = document.getElementById("repayment-detail-list");
    let activeTab = "history";
    let activeFilter = "recent-3";
    let customFilterApplied = false;

    tabs.innerHTML = `
      <div class="tab-switch">
        <button class="tab-switch__tab" type="button" data-tab="plan"><span class="tab-switch__label">还款计划</span></button>
        <button class="tab-switch__tab is-active" type="button" data-tab="history"><span class="tab-switch__label">还款明细</span></button>
      </div>
    `;

    filters.innerHTML = `
      <div class="filter-row">
        <button class="filter-pill is-active" type="button" data-filter="recent-3">近三月</button>
        <button class="filter-pill" type="button" data-filter="recent-12">近一年</button>
        <button class="filter-pill" type="button" data-filter="custom">筛选</button>
      </div>
      <div class="filter-panel" id="repayment-filter-panel">
        <input id="filter-start-date" type="date" />
        <input id="filter-end-date" type="date" />
        <button id="apply-filter" type="button">应用</button>
      </div>
    `;

    function getVisibleRecords() {
      const sourceRecords = activeTab === "plan" ? scheduleRecords : effectiveHistoryRecords;

      if (activeFilter === "recent-3") {
        return activeTab === "plan"
          ? filterUpcomingMonths(sourceRecords, today, 3)
          : window.FakeBankData.filterRecentMonths(sourceRecords, today, 3);
      }

      if (activeFilter === "recent-12") {
        return activeTab === "plan"
          ? filterUpcomingMonths(sourceRecords, today, 12)
          : window.FakeBankData.filterRecentMonths(sourceRecords, today, 12);
      }

      if (!customFilterApplied) {
        return [];
      }

      const startValue = document.getElementById("filter-start-date").value;
      const endValue = document.getElementById("filter-end-date").value;
      return sourceRecords.filter(function (item) {
        if (startValue && item.repayDate < startValue) {
          return false;
        }
        if (endValue && item.repayDate > endValue) {
          return false;
        }
        return activeTab === "plan" ? item.repayDate >= today : item.repayDate <= today;
      });
    }

    function paint() {
      const records = getVisibleRecords();
      const renderCard = activeTab === "plan" ? renderRepaymentPlanCard : renderRepaymentCard;
      list.innerHTML = `<div class="repayment-list">${records.map(renderCard).join("")}</div>`;
    }

    const filterPanel = filters.querySelector("#repayment-filter-panel");
    tabs.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        activeTab = button.getAttribute("data-tab");
        activeFilter = "recent-3";
        customFilterApplied = false;
        tabs.querySelectorAll("[data-tab]").forEach(function (node) {
          node.classList.toggle("is-active", node === button);
        });
        filters.querySelectorAll("[data-filter]").forEach(function (node) {
          node.classList.toggle("is-active", node.getAttribute("data-filter") === "recent-3");
        });
        filterPanel.classList.remove("is-open");
        paint();
      });
    });

    filters.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        activeFilter = button.getAttribute("data-filter");
        customFilterApplied = false;
        filters.querySelectorAll("[data-filter]").forEach(function (node) {
          node.classList.toggle("is-active", node === button);
        });
        filterPanel.classList.toggle("is-open", activeFilter === "custom");
        paint();
      });
    });

    filters.querySelector("#apply-filter").addEventListener("click", function () {
      activeFilter = "custom";
      customFilterApplied = true;
      paint();
    });

    paint();
  }

  async function renderCurrentPage(page) {
    const schedule = await loadJson(schedulePath);

    if (page === "home") {
      renderHomePage(schedule);
      return;
    }

    if (page === "loan-detail") {
      renderLoanDetailPage(schedule);
      return;
    }

    if (page === "usage-record") {
      const usageRecords = await loadJson(usagePath);
      renderUsageRecordPage(usageRecords);
      return;
    }

    if (page === "prepayment-detail") {
      renderPrepaymentDetailPage(schedule);
      return;
    }

    if (page === "monthly-due-detail") {
      renderMonthlyDueDetailPage();
      return;
    }

    if (page === "next-month-due-detail") {
      renderNextMonthDueDetailPage(schedule);
      return;
    }

    if (page === "repayment-detail") {
      const historyRecords = await loadJson(historyPath);
      renderRepaymentDetailPage(historyRecords, schedule);
    }
  }

  function init() {
    const page = document.body.dataset.page;
    if (!page) {
      return;
    }

    bindBackButtons();
    registerServiceWorker();
    renderCurrentPage(page).catch(function (error) {
      console.error(error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
