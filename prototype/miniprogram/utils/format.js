/* ================= 格式化工具（口径与 PC 端 core.js 一致） ================= */

const { WORKBENCH_DATE } = require('./data.js');

function isBad(n){
  return n === null || n === undefined || n === '' || isNaN(n);
}

/* 千分位 + 两位小数 */
function fmt(n){
  if (isBad(n)) return '—';
  const v = Number(n);
  const neg = v < 0;
  const parts = Math.abs(v).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + parts.join('.');
}

/* 取整 + 千分位 */
function fmt0(n){
  if (isBad(n)) return '—';
  const v = Math.round(Number(n));
  const neg = v < 0;
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s;
}

/* 万元，保留一位小数 */
function wan(n){
  if (isBad(n)) return '—';
  return (Number(n) / 10000).toFixed(1);
}

/* 百分比 */
function pct(n, d){
  if (isBad(n)) return '—';
  return (Number(n) * 100).toFixed(d === undefined ? 1 : d) + '%';
}

/* 与演示「今天」相差的天数（按 UTC 取整，避免时区与 iOS 解析差异） */
function dayDiff(dateStr){
  if (!dateStr) return 0;
  const a = String(dateStr).slice(0, 10).split('-').map(Number);
  const b = WORKBENCH_DATE.split('-').map(Number);
  const t1 = Date.UTC(a[0], a[1] - 1, a[2]);
  const t2 = Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round((t1 - t2) / 86400000);
}

/* 今天 / 明天 / N 天后 / N 天前 / 昨天 */
function relDay(dateStr){
  const d = dayDiff(dateStr);
  if (d < -1) return Math.abs(d) + ' 天前';
  if (d === -1) return '昨天';
  if (d === 0) return '今天';
  if (d === 1) return '明天';
  return d + ' 天后';
}

/* 星期 */
function weekday(dateStr){
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const p = String(dateStr).slice(0, 10).split('-').map(Number);
  return w[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
}

/* 时段问候语 */
function greeting(hour){
  const h = hour === undefined ? new Date().getHours() : hour;
  if (h < 6) return '凌晨好';
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

module.exports = { fmt, fmt0, wan, pct, dayDiff, relDay, weekday, greeting };
