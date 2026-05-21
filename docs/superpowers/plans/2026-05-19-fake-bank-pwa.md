# Fake Bank PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一套可离线安装到 iPhone 主屏的静态 PWA，高仿 4 个贷款相关页面，并基于本地数据按系统时间动态计算未还本金、筛选还款记录。

**Architecture:** 使用原生多页面静态站实现 4 个独立页面，共享一套 CSS 和 JS。贷款静态信息与还款计划数据分离存放，Node 脚本负责生成提前还款后的计划 JSON，前端负责路由跳转、列表懒加载、时间筛选和 PWA 缓存。

**Tech Stack:** HTML, CSS, Vanilla JavaScript, Node.js, JSON, Service Worker, Web App Manifest

---

## 文件结构

### 需要创建的文件

- `C:\workSpace\fake_bank\index.html`
  图1“我的贷款”页面
- `C:\workSpace\fake_bank\loan-detail.html`
  图2“贷款详情”页面
- `C:\workSpace\fake_bank\usage-record.html`
  图3/图5“使用记录”页面
- `C:\workSpace\fake_bank\repayment-detail.html`
  图4/图6-图9“还款详情”页面
- `C:\workSpace\fake_bank\assets\styles\main.css`
  全站共享样式，负责高仿布局、配色、圆角、分隔线、列表样式
- `C:\workSpace\fake_bank\assets\scripts\data.js`
  固定贷款信息、格式化函数、日期过滤函数、未还本金动态计算函数
- `C:\workSpace\fake_bank\assets\scripts\app.js`
  页面初始化、跳转绑定、使用记录懒加载、还款详情筛选切换、展开收起逻辑
- `C:\workSpace\fake_bank\assets\scripts\generate-repayment.js`
  重新生成提前还款后计划的 Node 脚本
- `C:\workSpace\fake_bank\assets\data\repayment_schedule.json`
  提前还款后重算出的计划和明细数据
- `C:\workSpace\fake_bank\assets\data\usage_records.json`
  使用记录页用到的倒序常规还款记录数据，不包含提前还款
- `C:\workSpace\fake_bank\assets\icons\back.svg`
  返回箭头
- `C:\workSpace\fake_bank\assets\icons\eye.svg`
  眼睛图标
- `C:\workSpace\fake_bank\assets\icons\caret-right.svg`
  右箭头
- `C:\workSpace\fake_bank\assets\icons\caret-up.svg`
  展开箭头
- `C:\workSpace\fake_bank\assets\icons\caret-down.svg`
  收起箭头
- `C:\workSpace\fake_bank\assets\icons\feature-*.svg`
  图1 宫格图标
- `C:\workSpace\fake_bank\assets\icons\app-icon-192.png`
  PWA 图标
- `C:\workSpace\fake_bank\assets\icons\app-icon-512.png`
  PWA 图标
- `C:\workSpace\fake_bank\manifest.webmanifest`
  PWA manifest
- `C:\workSpace\fake_bank\sw.js`
  离线缓存
- `C:\workSpace\fake_bank\serve-local.js`
  本地静态服务脚本，便于手机局域网访问测试

### 需要修改的文件

- `C:\workSpace\fake_bank\generate_repayment_json.js`
  改造成保留或转接到新的数据生成逻辑，避免保留旧口径

## 任务拆分

### Task 1: 重建数据生成脚本

**Files:**
- Create: `C:\workSpace\fake_bank\assets\scripts\generate-repayment.js`
- Create: `C:\workSpace\fake_bank\assets\data\repayment_schedule.json`
- Create: `C:\workSpace\fake_bank\assets\data\usage_records.json`
- Modify: `C:\workSpace\fake_bank\generate_repayment_json.js`

- [ ] **Step 1: 写一个用于验证提前还款口径的临时 Node 断言脚本**

```js
const assert = require("node:assert/strict");

const schedule = require("../assets/data/repayment_schedule.json");

assert.equal(schedule[0].repayDate, "2026-06-01");
assert.equal(schedule[0].contractNo, "22810157800034988");
assert.equal(schedule[0].penalty, 0);
assert.equal(schedule[0].compoundInterest, 0);
assert.equal(schedule.every((item) => item.penalty === 0), true);
assert.equal(schedule.every((item) => item.compoundInterest === 0), true);

console.log("repayment schedule assertions passed");
```

- [ ] **Step 2: 先运行断言脚本，确认当前数据无法通过**

Run: `node .\scripts\assert-repayment.js`
Expected: FAIL，报找不到文件或字段不匹配

- [ ] **Step 3: 编写新的还款计划生成脚本**

```js
const fs = require("node:fs");
const path = require("node:path");

const LOAN_CONTRACT_NO = "22810157800034988";
const CONTRACT_NO = "22810045400029440";
const ORIGINAL_REMAINING_PRINCIPAL = 1199601.82;
const PREPAYMENT_AMOUNT = 500000;
const PREPAYMENT_DATE = "2026-05-25";
const START_REPAY_DATE = new Date("2026-06-01T01:12:00");
const MONTHLY_RATE = 0.032 / 12;
const MONTHLY_PAYMENT = 5715.71;

function toMoney(value) {
  return Number(value.toFixed(2));
}

function addMonths(date, count) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const startingPrincipal = toMoney(ORIGINAL_REMAINING_PRINCIPAL - PREPAYMENT_AMOUNT);
let remainingPrincipal = startingPrincipal;
let period = 0;

const repaymentSchedule = [];
const usageRecords = [];

while (remainingPrincipal > 0.01) {
  const repayAt = addMonths(START_REPAY_DATE, period);
  const interest = toMoney(remainingPrincipal * MONTHLY_RATE);
  const principal = remainingPrincipal < MONTHLY_PAYMENT - interest
    ? toMoney(remainingPrincipal)
    : toMoney(MONTHLY_PAYMENT - interest);
  const payment = toMoney(principal + interest);

  repaymentSchedule.push({
    contractNo: LOAN_CONTRACT_NO,
    repayDate: formatDate(repayAt),
    principal,
    interest,
    penalty: 0,
    compoundInterest: 0,
    payment,
    remainingPrincipalAfterPayment: toMoney(remainingPrincipal - principal),
  });

  usageRecords.push({
    title: "还款",
    amount: payment,
    occurAt: formatDateTime(repayAt),
    principal,
    interest,
    penalty: 0,
    compoundInterest: 0,
  });

  remainingPrincipal = toMoney(remainingPrincipal - principal);
  period += 1;
}

fs.mkdirSync(path.join(__dirname, "..", "data"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "data", "repayment_schedule.json"), `${JSON.stringify(repaymentSchedule, null, 2)}\n`);
fs.writeFileSync(path.join(__dirname, "..", "data", "usage_records.json"), `${JSON.stringify(usageRecords.reverse(), null, 2)}\n`);
```

- [ ] **Step 4: 运行生成脚本并确认 JSON 产物生成**

Run: `node .\assets\scripts\generate-repayment.js`
Expected: 生成 `assets\data\repayment_schedule.json` 和 `assets\data\usage_records.json`

- [ ] **Step 5: 运行断言脚本验证数据口径**

Run: `node .\scripts\assert-repayment.js`
Expected: PASS，输出 `repayment schedule assertions passed`

- [ ] **Step 6: 兼容旧入口脚本，避免后续误用旧数据逻辑**

```js
require("./assets/scripts/generate-repayment");
```

- [ ] **Step 7: 本地检查首期、末期、字段完整性**

Run: `node -e "const s=require('./assets/data/repayment_schedule.json'); console.log(s[0], s[s.length-1], s.length)"`
Expected: 首期是 `2026-06-01`，末期日期为新的自动结清日期，字段包含 `penalty` 和 `compoundInterest`

### Task 2: 建立共享数据与动态计算模块

**Files:**
- Create: `C:\workSpace\fake_bank\assets\scripts\data.js`
- Test: `C:\workSpace\fake_bank\scripts\assert-data.js`

- [ ] **Step 1: 写动态计算模块的断言脚本**

```js
const assert = require("node:assert/strict");
const { calculateOutstandingPrincipal, filterRecentMonths } = require("../assets/scripts/data.cjs");
const schedule = require("../assets/data/repayment_schedule.json");

assert.equal(calculateOutstandingPrincipal("2026-05-24", schedule), 1199601.82);
assert.equal(calculateOutstandingPrincipal("2026-05-25", schedule), 699601.82);
assert.equal(filterRecentMonths(schedule, "2026-08-15", 3).length, 3);

console.log("data assertions passed");
```

- [ ] **Step 2: 先运行断言脚本，确认模块尚不存在**

Run: `node .\scripts\assert-data.js`
Expected: FAIL，报模块不存在

- [ ] **Step 3: 实现浏览器版共享数据模块**

```js
window.FakeBankData = {
  contractSummary: {
    contractNo: "22810045400029440",
    loanContractNo: "22810157800034988",
    totalAmount: 1300000,
    usedAmount: 1300000,
    availableAmount: 0,
    annualRate: 3.2,
    originalRemainingPrincipal: 1199601.82,
    prepaymentAmount: 500000,
    prepaymentDate: "2026-05-25",
    firstRepaymentDate: "2026-06-01",
  },
  formatCurrency(value) {
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  },
  calculateOutstandingPrincipal(today, schedule) {
    const current = new Date(`${today}T00:00:00`);
    const prepayDate = new Date("2026-05-25T00:00:00");
    let principal = 1199601.82;

    if (current >= prepayDate) {
      principal -= 500000;
    }

    schedule.forEach((item) => {
      const repayDate = new Date(`${item.repayDate}T23:59:59`);
      if (repayDate <= current) {
        principal -= item.principal;
      }
    });

    return Number(principal.toFixed(2));
  },
  filterRecentMonths(schedule, today, months) {
    const current = new Date(`${today}T00:00:00`);
    const threshold = new Date(current);
    threshold.setMonth(threshold.getMonth() - months + 1);
    threshold.setDate(1);

    return schedule.filter((item) => {
      const repayDate = new Date(`${item.repayDate}T00:00:00`);
      return repayDate >= threshold && repayDate <= current;
    });
  },
};
```

- [ ] **Step 4: 为 Node 断言提供 CommonJS 包装文件**

```js
const data = {
  calculateOutstandingPrincipal(today, schedule) {
    const current = new Date(`${today}T00:00:00`);
    const prepayDate = new Date("2026-05-25T00:00:00");
    let principal = 1199601.82;

    if (current >= prepayDate) {
      principal -= 500000;
    }

    schedule.forEach((item) => {
      const repayDate = new Date(`${item.repayDate}T23:59:59`);
      if (repayDate <= current) {
        principal -= item.principal;
      }
    });

    return Number(principal.toFixed(2));
  },
  filterRecentMonths(schedule, today, months) {
    const current = new Date(`${today}T00:00:00`);
    const threshold = new Date(current);
    threshold.setMonth(threshold.getMonth() - months + 1);
    threshold.setDate(1);
    return schedule.filter((item) => {
      const repayDate = new Date(`${item.repayDate}T00:00:00`);
      return repayDate >= threshold && repayDate <= current;
    });
  },
};

module.exports = data;
```

- [ ] **Step 5: 运行断言脚本验证动态计算**

Run: `node .\scripts\assert-data.js`
Expected: PASS，输出 `data assertions passed`

### Task 3: 搭建页面骨架与共享样式

**Files:**
- Create: `C:\workSpace\fake_bank\index.html`
- Create: `C:\workSpace\fake_bank\loan-detail.html`
- Create: `C:\workSpace\fake_bank\usage-record.html`
- Create: `C:\workSpace\fake_bank\repayment-detail.html`
- Create: `C:\workSpace\fake_bank\assets\styles\main.css`

- [ ] **Step 1: 先写首页结构，定义共享容器和导航栏语义**

```html
<body data-page="home">
  <main class="app-shell">
    <header class="topbar topbar--center">
      <button class="icon-button" type="button" aria-label="返回">
        <img src="./assets/icons/back.svg" alt="" />
      </button>
      <h1 class="topbar__title">我的贷款</h1>
      <button class="text-button" type="button">历史贷款</button>
    </header>
    <section class="hero-card" id="home-summary"></section>
    <section class="feature-grid" id="feature-grid"></section>
    <section class="panel panel--contracts" id="contract-panel"></section>
  </main>
  <script src="./assets/scripts/data.js"></script>
  <script src="./assets/scripts/app.js"></script>
</body>
```

- [ ] **Step 2: 建立 4 个页面最小结构，保证 DOM 入口 id 一致**

Run: `rg "id=\"" .`
Expected: 四个页面都包含对应的挂载节点，例如 `home-summary`、`loan-detail-summary`、`usage-record-list`、`repayment-detail-list`

- [ ] **Step 3: 编写共享样式变量和基础组件**

```css
:root {
  --bg: #f5f5f5;
  --surface: #ffffff;
  --text: #2f3137;
  --muted: #8c8f96;
  --line: #ececec;
  --accent: #11c5b7;
  --accent-soft: #ffe0a8;
  --warning: #f6aa14;
  --radius-pill: 999px;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: "PingFang SC", "SF Pro Text", "Helvetica Neue", sans-serif;
}

.app-shell {
  min-height: 100vh;
}

.topbar {
  display: grid;
  grid-template-columns: 48px 1fr 72px;
  align-items: center;
  height: 88px;
  padding: 0 18px;
  background: var(--surface);
}
```

- [ ] **Step 4: 本地肉眼检查 4 个页面骨架是否能打开**

Run: `node .\serve-local.js`
Expected: 浏览器打开 4 个页面都不是空白，能看到导航栏和基础块

### Task 4: 实现图1和图2的渲染逻辑

**Files:**
- Modify: `C:\workSpace\fake_bank\assets\scripts\app.js`
- Modify: `C:\workSpace\fake_bank\index.html`
- Modify: `C:\workSpace\fake_bank\loan-detail.html`
- Modify: `C:\workSpace\fake_bank\assets\styles\main.css`

- [ ] **Step 1: 先写首页数据渲染函数**

```js
function renderHomePage(schedule) {
  const today = getTodayString();
  const outstanding = window.FakeBankData.calculateOutstandingPrincipal(today, schedule);
  document.getElementById("home-summary").innerHTML = `
    <div class="hero-card__amount">0.00</div>
    <div class="hero-card__label">本月应还(元)</div>
    <div class="hero-card__stats">
      <div>
        <div class="stat-value">${window.FakeBankData.formatCurrency(outstanding)}</div>
        <div class="stat-label">未还本金总计(元)</div>
      </div>
      <div>
        <div class="stat-value stat-value--warning">0.00</div>
        <div class="stat-label">可用额度(元)</div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: 写首页合同区域和点击跳转**

Run: `node .\serve-local.js`
Expected: 点击“个人住房贷款”行可跳转到 `loan-detail.html`

- [ ] **Step 3: 实现贷款详情页顶部圆环与信息列表**

```js
function renderLoanDetailPage(schedule) {
  const today = getTodayString();
  const outstanding = window.FakeBankData.calculateOutstandingPrincipal(today, schedule);
  const lastDate = schedule[schedule.length - 1].repayDate;

  document.getElementById("loan-detail-summary").innerHTML = `
    <div class="circle-metric">
      <div class="circle-metric__inner">
        <div class="circle-metric__label">可用额度(元)</div>
        <div class="circle-metric__value">0.00</div>
      </div>
    </div>
    <div class="metric-row">
      <div><strong>1,300,000.00</strong><span>总额度(元)</span></div>
      <div><strong>1,300,000.00</strong><span>已用额度(元)</span></div>
    </div>
  `;

  document.getElementById("loan-detail-fields").innerHTML = `
    <div class="field-row"><span>未还本金</span><strong>${window.FakeBankData.formatCurrency(outstanding)}元</strong></div>
    <div class="field-row"><span>贷款到期日</span><strong>${lastDate.replace(/-/g, "年").replace(/年(\d{2})$/, "月$1日")}</strong></div>
  `;
}
```

- [ ] **Step 4: 确保图2在“还款详情”按钮以下没有任何渲染目标**

Run: `rg "loan-detail" .\loan-detail.html`
Expected: 只存在摘要、字段区、操作区，不存在额外内容区

- [ ] **Step 5: 手动核对图1、图2金额和日期随系统时间变化**

Run: 在浏览器控制台临时覆盖 `getTodayString`
Expected: 日期前后变化时，图1和图2的未还本金发生变化

### Task 5: 实现图3使用记录页

**Files:**
- Modify: `C:\workSpace\fake_bank\usage-record.html`
- Modify: `C:\workSpace\fake_bank\assets\scripts\app.js`
- Modify: `C:\workSpace\fake_bank\assets\styles\main.css`

- [ ] **Step 1: 先写记录卡片 HTML 模板，默认收起**

```js
function renderUsageRecordCard(item, expanded) {
  return `
    <article class="usage-card ${expanded ? "is-expanded" : ""}">
      <button class="usage-card__head" type="button" data-record-toggle="${item.occurAt}">
        <div>
          <div class="usage-card__title">${item.title}</div>
          <div class="usage-card__time">${item.occurAt}</div>
        </div>
        <div class="usage-card__amount">+¥${window.FakeBankData.formatCurrency(item.amount)}</div>
      </button>
      <div class="usage-card__body">
        <div class="field-row"><span>还款金额</span><strong>¥${window.FakeBankData.formatCurrency(item.amount)}</strong></div>
        <div class="field-row"><span>本金</span><strong>¥${window.FakeBankData.formatCurrency(item.principal)}</strong></div>
        <div class="field-row"><span>利息</span><strong>¥${window.FakeBankData.formatCurrency(item.interest)}</strong></div>
        <div class="field-row"><span>罚息</span><strong>¥0.00</strong></div>
        <div class="field-row"><span>罚息复利</span><strong>¥0.00</strong></div>
      </div>
    </article>
  `;
}
```

- [ ] **Step 2: 实现初始仅加载 1 条**

Run: 打开 `usage-record.html`
Expected: 页面只显示最新 1 条记录和底部“上滑刷新更多”

- [ ] **Step 3: 实现点击展开/收起**

Run: 点击首条记录
Expected: 默认收起，点击后显示明细，再点可收起

- [ ] **Step 4: 实现每次上滑加载 1 笔**

```js
let usageVisibleCount = 1;

function maybeLoadMoreUsageRecords() {
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 60;
  if (nearBottom) {
    usageVisibleCount = Math.min(usageVisibleCount + 1, usageRecords.length);
    renderUsageRecordList();
  }
}

window.addEventListener("scroll", maybeLoadMoreUsageRecords);
```

- [ ] **Step 5: 验证不包含提前还款记录**

Run: `node -e "const r=require('./assets/data/usage_records.json'); console.log(r.some(x => x.amount === 500000))"`
Expected: `false`

### Task 6: 实现图4还款详情页筛选和列表

**Files:**
- Modify: `C:\workSpace\fake_bank\repayment-detail.html`
- Modify: `C:\workSpace\fake_bank\assets\scripts\app.js`
- Modify: `C:\workSpace\fake_bank\assets\styles\main.css`

- [ ] **Step 1: 写还款明细卡片模板**

```js
function renderRepaymentCard(item) {
  return `
    <article class="repayment-card">
      <div class="field-row"><span>贷款合约号</span><strong>${item.contractNo}</strong></div>
      <div class="field-row"><span>还款日期</span><strong>${item.repayDate}</strong></div>
      <div class="field-row"><span>还本金额</span><strong>${window.FakeBankData.formatCurrency(item.principal)}元</strong></div>
      <div class="field-row"><span>还息金额</span><strong>${window.FakeBankData.formatCurrency(item.interest)}元</strong></div>
      <div class="field-row"><span>还罚息</span><strong>0.00元</strong></div>
      <div class="field-row"><span>还复利</span><strong>0.00元</strong></div>
    </article>
  `;
}
```

- [ ] **Step 2: 实现默认“还款明细”tab 激活态**

Run: 打开 `repayment-detail.html`
Expected: “还款明细”高亮，下划线显示；“还款计划”非激活

- [ ] **Step 3: 实现近三月和近一年筛选**

```js
function getFilteredRepaymentRecords(schedule, mode) {
  const today = getTodayString();
  if (mode === "recent-3") {
    return window.FakeBankData.filterRecentMonths(schedule, today, 3);
  }
  if (mode === "recent-12") {
    return window.FakeBankData.filterRecentMonths(schedule, today, 12);
  }
  return schedule;
}
```

- [ ] **Step 4: 实现“筛选”轻量面板**

Run: 点击“筛选”
Expected: 出现一个本地日期范围面板，可按开始/结束日期过滤记录

- [ ] **Step 5: 验证图4近一年列表结构贴近截图**

Run: 以 `2026-05-19` 为当前日期检查页面
Expected: 能看到从 `2025-06-01` 到 `2026-05-01` 的连续月度卡片

### Task 7: 补齐图标、PWA 和本地服务

**Files:**
- Create: `C:\workSpace\fake_bank\assets\icons\*.svg`
- Create: `C:\workSpace\fake_bank\manifest.webmanifest`
- Create: `C:\workSpace\fake_bank\sw.js`
- Create: `C:\workSpace\fake_bank\serve-local.js`

- [ ] **Step 1: 生成简化 SVG 图标占位，先保证页面可用**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#34363c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 18l-6-6 6-6"/>
</svg>
```

- [ ] **Step 2: 编写 manifest**

```json
{
  "name": "Fake Bank",
  "short_name": "FakeBank",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#f5f5f5",
  "theme_color": "#f5f5f5",
  "icons": [
    { "src": "/assets/icons/app-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/app-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: 编写 service worker 预缓存静态资源**

```js
const CACHE_NAME = "fake-bank-v1";
const ASSETS = [
  "/index.html",
  "/loan-detail.html",
  "/usage-record.html",
  "/repayment-detail.html",
  "/assets/styles/main.css",
  "/assets/scripts/data.js",
  "/assets/scripts/app.js",
  "/assets/data/repayment_schedule.json",
  "/assets/data/usage_records.json",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});
```

- [ ] **Step 4: 编写本地静态服务脚本**

```js
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, urlPath);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200);
    res.end(content);
  });
}).listen(4173, "0.0.0.0", () => {
  console.log("Serving http://0.0.0.0:4173");
});
```

- [ ] **Step 5: 启动本地服务并检查 PWA 基础资源**

Run: `node .\serve-local.js`
Expected: 本地可访问 `http://127.0.0.1:4173/index.html`，manifest 和 sw 不报 404

### Task 8: 验证与整理

**Files:**
- Modify: `C:\workSpace\fake_bank\assets\styles\main.css`
- Modify: `C:\workSpace\fake_bank\assets\scripts\app.js`
- Modify: `C:\workSpace\fake_bank\assets\scripts\data.js`

- [ ] **Step 1: 跑数据断言**

Run: `node .\scripts\assert-repayment.js`
Expected: PASS

- [ ] **Step 2: 跑动态计算断言**

Run: `node .\scripts\assert-data.js`
Expected: PASS

- [ ] **Step 3: 手动验证 4 个页面跳转**

Run: 启动 `node .\serve-local.js` 后逐页点击
Expected: 图1 -> 图2 -> 图3 / 图4 路径正确，返回正常

- [ ] **Step 4: 手动验证图2截断约束**

Run: 打开 `loan-detail.html`
Expected: “还款详情”按钮以下没有内容

- [ ] **Step 5: 手动验证图3默认收起和逐笔加载**

Run: 打开 `usage-record.html` 并滚动到底部
Expected: 初始 1 条，随后每次增加 1 条，默认收起

- [ ] **Step 6: 手动验证图4近三月 / 近一年**

Run: 打开 `repayment-detail.html`
Expected: “近三月”仅显示最近 3 个月已发生记录；“近一年”显示最近 12 个月

- [ ] **Step 7: 如目录仍非 git 仓库，记录无法执行提交步骤**

Run: `git rev-parse --is-inside-work-tree`
Expected: FAIL；在交付说明中注明当前目录不是 git 仓库，未执行 commit

## 自检

- 规格要求的 4 个页面均有任务覆盖
- 动态未还本金、近三月/近一年、使用记录逐笔加载、提前还款不进使用记录、罚息固定为 0 都已覆盖
- 计划中未使用 TBD/TODO 等占位词
- 模块名、字段名在任务间保持一致：`penalty`、`compoundInterest`、`calculateOutstandingPrincipal`、`filterRecentMonths`
