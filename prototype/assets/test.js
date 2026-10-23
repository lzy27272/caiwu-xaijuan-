const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = __dirname;
const files = ['data.js','core.js','view-workbench.js','view-dashboard.js','view-flow.js','view-invoice.js','view-invadd.js','view-account.js','attach.js','export.js','boot.js'];
let code = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n');
code += '\n;globalThis.__Views = Views; globalThis.__State = State; globalThis.__App = window.App;'
      + ' globalThis.__ROLES = ROLES; globalThis.__NAV = NAV; globalThis.__STORES = STORES;'
      + ' globalThis.__GROUP = GROUP; globalThis.__getFlow = getFlow;'
      + ' globalThis.__fmt0 = fmt0; globalThis.__wan = wan; globalThis.__pct = pct;';

function stubEl(){
  return {
    innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
    classList: { add(){}, remove(){}, contains(){ return false; } },
    appendChild(){}, remove(){}, setAttribute(){}, focus(){}
  };
}
const ctx = {
  console,
  document: {
    getElementById: () => stubEl(),
    querySelector: () => stubEl(),
    querySelectorAll: () => [],
    createElement: () => stubEl(),
    addEventListener: () => {},
    body: stubEl()
  },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  setTimeout: () => 0
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

try{
  vm.runInContext(code, ctx, { filename: 'bundle.js' });
}catch(e){
  console.error('BOOT FAILED:', e.message);
  console.error(e.stack.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

const Views = ctx.__Views, State = ctx.__State;
const pages = Object.keys(Views);
let fail = 0;

console.log('页面渲染测试（共 ' + pages.length + ' 页）');
pages.forEach(p => {
  State.page = p;
  try{
    const html = Views[p]();
    const len = (html || '').length;
    if (!len || len < 50){ console.log('  ✗ ' + p + ' 输出过短 (' + len + ')'); fail++; }
    else console.log('  ✓ ' + p.padEnd(18) + len + ' chars');
  }catch(err){
    console.log('  ✗ ' + p + ' 报错: ' + err.message);
    fail++;
  }
});

// 角色矩阵测试
console.log('\n角色可见性测试');
Object.keys(ctx.__ROLES).forEach(r => {
  State.role = r;
  const visible = ctx.__NAV.reduce((a, g) => a + g.items.filter(i => i.roles.includes(r)).length, 0);
  console.log('  ' + ctx.__ROLES[r].name.padEnd(12) + visible + ' 个菜单，首页 ' + ctx.__ROLES[r].home);
});

// 数据合理性
console.log('\n数据校验');
console.log('  门店数 ' + ctx.__STORES.length + '，房量合计 ' + ctx.__GROUP.rooms);
console.log('  集团不含税收入 ' + ctx.__GROUP.revenueNet.toLocaleString() + ' 元');
console.log('  加权出租率 ' + (ctx.__GROUP.occ * 100).toFixed(1) + '% ，ADR ' + ctx.__GROUP.adr + '，RevPAR ' + ctx.__GROUP.revpar);
console.log('  GOP 率 ' + (ctx.__GROUP.gopRate * 100).toFixed(1) + '%，净利率 ' + (ctx.__GROUP.netMargin * 100).toFixed(1) + '%');
const bad = ctx.__STORES.filter(s => s.gopRate < 0 || s.gopRate > .6 || s.revenueNet < 0);
console.log('  异常门店: ' + (bad.length ? bad.map(s => s.name).join(',') : '无'));
console.log('  毛利率区间: ' + (Math.min(...ctx.__STORES.map(s => s.gopRate)) * 100).toFixed(1) + '% ~ ' + (Math.max(...ctx.__STORES.map(s => s.gopRate)) * 100).toFixed(1) + '%');

// 单据与审批链
console.log('\n单据测试');
ctx.__State.docs.forEach(d => {
  const f = ctx.__getFlow(d);
  const node = f[d.currentNode];
  if (!node){ console.log('  ✗ ' + d.id + ' 节点越界'); fail++; }
});
console.log('  ' + ctx.__State.docs.length + ' 张单据，审批链正常');

// 函数完整性
console.log('\n交互函数');
['go','setRole','setStore','openDoc','approveDoc','rejectDoc','openInv','openVoucher','pmsPreview','newExpense','doPay','payOne','openStore','closeModal'].forEach(fn => {
  if (typeof ctx.window.App[fn] !== 'function'){ console.log('  ✗ App.' + fn + ' 缺失'); fail++; }
});
console.log('  ' + Object.keys(ctx.window.App).length + ' 个方法已挂载');

/* emptyState / emptyRow 是空态渲染的唯一入口，各视图直接调用（不经 App），
   必须存在于全局；数值格式化则要求 NaN / Infinity / undefined 一律输出「—」 */
console.log('\n空态与数值兜底');
['emptyState','emptyRow','__fmt0','__wan','__pct'].forEach(fn => {
  if (typeof ctx[fn] !== 'function'){ console.log('  ✗ ' + fn + ' 缺失或不可用'); fail++; }
});
const FNS = { fmt0: ctx.__fmt0, wan: ctx.__wan, pct: ctx.__pct };
const badNums = [NaN, Infinity, -Infinity, undefined, null, ''];
Object.keys(FNS).forEach(k => {
  if (typeof FNS[k] !== 'function'){ console.log('  ✗ ' + k + ' 未导出（空态与数值校验无法执行）'); fail++; }
});
badNums.forEach(v => {
  Object.keys(FNS).forEach(k => {
    const out = FNS[k](v);
    if (out !== '—'){ console.log('  ✗ ' + k + '(' + String(v) + ') 返回 ' + out); fail++; }
  });
});
console.log('  NaN / Infinity / undefined 均返回 —');
const okFmt = FNS.pct(0.676) === '67.6%' && FNS.fmt0(1234.5) === '1,235' && FNS.wan(12600) === '1.3';
if (!okFmt){ console.log('  ✗ 正常值格式化结果异常'); fail++; }
console.log('  正常值格式化未受影响');

console.log('\n' + (fail ? '存在 ' + fail + ' 处问题' : '全部通过'));
process.exit(fail ? 1 : 0);
