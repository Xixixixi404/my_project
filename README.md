# fake_bank

一个面向 iPhone Safari / iOS 主屏幕的本地离线静态页面项目，用来模拟贷款、还款、使用记录等页面流程。

## 目录

- 入口页：`index.html`
- 样式：`assets/styles/main.css`
- 页面逻辑：`assets/scripts/app.js`
- 静态数据：
  - `assets/data/repayment_schedule.json`
  - `assets/data/repayment_history.json`
  - `assets/data/usage_records.json`
- 图标与资源：
  - `assets/logo.png`
  - `assets/icons/`

## 本地启动

在 PowerShell 中执行：

```powershell
cd fake_bank
node .\serve-local.js
```

默认访问地址：

- 本机：[http://127.0.0.1:4173/index.html](http://127.0.0.1:4173/index.html)
- 同局域网手机：使用当前电脑的局域网 IP，例如 `http://10.10.42.107:4173/index.html`

## iPhone 使用方式

1. iPhone 和电脑连接同一个 Wi-Fi
2. 用 Safari 打开项目地址
3. 点击分享
4. 选择“添加到主屏幕”

当前项目已经配置：

- `manifest.webmanifest`
- `service worker`
- `apple-touch-icon`

其中 iOS 主屏图标使用：

- `assets/logo.png`

## 数据说明

- 首页“本月应还”固定显示 `0.00`
- 贷款、还款计划、还款明细、提前还款详情等页面的数据由本地 JSON 和前端计算共同决定
- 当前默认使用设备真实时间；如果需要切换演示时间，可在 `assets/scripts/data.js` 中设置 `currentDateOverride`

## 重新生成还款数据

执行：

```powershell
cd fake_bank
node .\generate_repayment_json.js
```

## 校验

执行：

```powershell
node .\scripts\assert-repayment.js
node .\scripts\assert-data.js
```

## 备注

- 首页样式和贷款详情页样式当前按已确认状态保留
- 页面主要为移动端设计，建议使用浏览器 mobile 模式或 iPhone Safari 查看
