/* ================= 工作台：角色化聚合首页 =================
   设计原则：
   1）一屏回答三件事——今天必须做什么、钱和账现在什么状态、下一步去哪；
   2）所有数字都与后续页面同源（同 State.docs、同 STORES 汇总），不做二次口径；
   3）同一套页面在 6 个角色下呈现不同内容，靠权限过滤，不靠手写分支堆叠。 */

/* ---------- 快捷入口（按角色过滤） ---------- */
const QUICK_ENTRIES = [
  { label:'费用报销',    ch:'报', color:'blue',  page:'flow-exp',        roles:['staff','manager','storefin','hqfin','cashier','cfo'] },
  { label:'付款申请',    ch:'付', color:'amber', page:'flow-pay',        roles:['staff','manager','storefin','hqfin','cashier','cfo'] },
  { label:'我的待办',    ch:'审', color:'teal',  page:'flow-todo',       roles:['manager','storefin','hqfin','cfo'] },
  { label:'我的单据',    ch:'单', color:'gray',  page:'flow-my',         roles:['staff','manager','storefin','hqfin','cfo','cashier'] },
  { label:'发票池',      ch:'票', color:'red',   page:'inv-pool',        roles:['staff','storefin','hqfin','cfo'] },
  { label:'凭证中心',    ch:'账', color:'blue',  page:'acc-voucher',     roles:['storefin','hqfin','cfo'] },
  { label:'单店损益表',  ch:'损', color:'teal',  page:'report-pl',       roles:['manager','storefin','hqfin','cfo'] },
  { label:'集团总览',    ch:'览', color:'blue',  page:'dashboard-group', roles:['hqfin','cfo','cashier'] },
  { label:'预算执行',    ch:'预', color:'amber', page:'budget',          roles:['manager','storefin','hqfin','cfo'] }
];

const WB_CAL_TYPE = {
  tax:      ['税务', 'tag-amber'],
  pay:      ['付款', 'tag-blue'],
  close:    ['关账', 'tag-teal'],
  contract: ['合同', 'tag-gray'],
  ar:       ['应收', 'tag-red']
};

/* ---------- 工具 ---------- */
function wbSum(arr){ return arr.reduce((a, d) => a + d.amount, 0); }
function wbDayDiff(dateStr){
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(WORKBENCH_DATE + 'T00:00:00')) / 86400000);
}
function wbRel(dateStr){
  const d = wbDayDiff(dateStr);
  if (d < 0) return Math.abs(d) + ' 天前';
  if (d === 0) return '今天';
  if (d === 1) return '明天';
  return d + ' 天后';
}
function wbWeekday(dateStr){
  const w = ['周日','周一','周二','周三','周四','周五','周六'];
  return w[new Date(dateStr + 'T00:00:00').getDay()];
}
function wbBudget(){
  const budget = BUDGETS.reduce((a, b) => a + b.budget, 0);
  const used = BUDGETS.reduce((a, b) => a + b.used, 0);
  const inTrans = BUDGETS.reduce((a, b) => a + b.inTrans, 0);
  return { budget, used, inTrans, rate: budget ? (used + inTrans) / budget : 0, usedRate: budget ? used / budget : 0 };
}

/* ---------- 待办聚合 ---------- */
function wbTabs(){
  const role = State.role;
  const pending = State.docs.filter(d => d.status === 'pending' && canApprove(d, role));
  const payable = State.docs.filter(d => d.status === 'approved');
  const risky = State.docs.filter(d => d.status !== 'paid' && d.risk && d.risk.length);
  const mine = State.docs.filter(d => {
    if (role === 'staff') return d.applicant === '陈晓燕';
    if (role === 'manager' || role === 'storefin') return d.storeId === State.storeId;
    return true;
  });
  const tabs = [];
  if (['manager','storefin','hqfin','cfo'].includes(role)) tabs.push({ key:'approve', label:'待我审批', list:pending });
  if (['cashier','hqfin','cfo'].includes(role)) tabs.push({ key:'pay', label:'待我付款', list:payable });
  tabs.push({ key:'risk', label:'异常待跟进', list:risky });
  tabs.push({ key:'mine', label: role === 'staff' ? '我提交的' : (role === 'manager' || role === 'storefin' ? '本店单据' : '全部单据'), list:mine });
  return tabs;
}

function wbCurrentTab(tabs){
  if (!tabs.length) return { key:'none', label:'', list:[] };
  const found = tabs.find(t => t.key === State.wbTab);
  if (found) return found;
  State.wbTab = tabs[0].key;
  return tabs[0];
}

/* ---------- KPI（按角色给指标，不硬凑同一套数字） ---------- */
function wbKpis(){
  const role = State.role;
  const s = storeById(State.storeId);
  const pending = State.docs.filter(d => d.status === 'pending' && canApprove(d, role));
  const payable = State.docs.filter(d => d.status === 'approved');
  const myDocs = State.docs.filter(d => d.applicant === '陈晓燕');
  const bg = wbBudget();
  const out = [];

  const card = (label, value, foot, color, page) => ({
    label, value, foot, color, page
  });

  if (role === 'staff'){
    const myPaid = myDocs.filter(d => d.status === 'paid');
    const myPending = myDocs.filter(d => d.status === 'pending');
    out.push(card('我提交的单据', myDocs.length + ' 张', `审批中 ${myPending.length} 张 · 已完成 ${myPaid.length} 张`, 'blue', 'flow-my'));
    out.push(card('本月已报销', '¥' + fmt0(myPaid.reduce((a, d) => a + d.amount, 0)), '已付款到工资卡', 'teal', 'flow-my'));
    out.push(card('待我补充资料', State.docs.filter(d => d.status === 'rejected').length + ' 张', '驳回后重新提交需重走审批', 'amber', 'flow-my'));
    out.push(card('发票池可勾选', INVOICES.filter(i => i.status === 'unused').length + ' 张', '报销时直接勾选，无需重复录入', 'gray', 'inv-pool'));
  } else if (role === 'manager'){
    out.push(card('待我审批', pending.length + ' 张', '合计 ¥' + fmt0(wbSum(pending)), 'amber', 'flow-todo'));
    out.push(card(s.name + ' 9 月收入', '¥' + wan(s.revenueNet) + ' 万', `同比 ${s.revYoY >= 0 ? '+' : ''}${(s.revYoY * 100).toFixed(1)}%`, 'blue', 'dashboard-store'));
    out.push(card('GOP 率', pct(s.gopRate), `GOP ¥${wan(s.gop)} 万 · 集团均值 ${pct(GROUP.gopRate)}`, 'teal', 'report-pl'));
    out.push(card('费用预算执行', pct(bg.rate), `含在途 ¥${wan(bg.inTrans)} 万，年度预算 ¥${wan(bg.budget)} 万`, bg.rate > .95 ? 'red' : 'amber', 'budget'));
  } else if (role === 'storefin'){
    const badChecks = CLOSE_CHECKS.filter(c => c.bad.includes(s.id));
    out.push(card('待我初审', pending.length + ' 张', '合计 ¥' + fmt0(wbSum(pending)), 'amber', 'flow-todo'));
    out.push(card('本月发票待认证', INVOICES.filter(i => i.status === 'unused').length + ' 张', '认证后才能进入当期抵扣台账', 'red', 'inv-pool'));
    out.push(card('本店关账检查', badChecks.length ? badChecks.length + ' 项未通过' : '全部通过', badChecks.length ? badChecks[0].label : '9 月已关账，10 月 31 日启动', badChecks.length ? 'red' : 'teal', 'acc-close'));
    out.push(card('本店费用预算执行', pct(bg.rate), `含在途 ¥${wan(bg.inTrans)} 万`, bg.rate > .95 ? 'red' : 'amber', 'budget'));
  } else if (role === 'cashier'){
    out.push(card('待付款', payable.length + ' 笔', '合计 ¥' + fmt0(wbSum(payable)) + ' · 须按主体分批', 'amber', 'flow-pay'));
    out.push(card('待认领银行流水', '7 笔', 'OTA 净额结算与平台回款', 'blue', 'acc-close'));
    out.push(card('集团账户余额', '¥' + wan(GROUP.cash) + ' 万', '14 个主体分别开户，不可混用', 'teal', 'dashboard-group'));
    out.push(card('今日已付', '¥' + fmt0(payable.filter(d => d.status === 'paid').reduce((a, d) => a + d.amount, 0)), '付款均留指纹与银行回单', 'gray', 'flow-pay'));
  } else if (role === 'hqfin'){
    const failStores = STORES.filter(st => CLOSE_CHECKS.some(c => c.bad.includes(st.id)));
    out.push(card('待我终审', pending.length + ' 张', '合计 ¥' + fmt0(wbSum(pending)), 'amber', 'flow-todo'));
    out.push(card('14 家关账进度', (14 - failStores.length) + ' / 14', failStores.length ? '未通过：' + failStores.map(x => x.name).join('、') : '全部通过', failStores.length ? 'red' : 'teal', 'acc-close'));
    out.push(card('集团 9 月收入（不含税）', '¥' + wan(GROUP.revenueNet) + ' 万', `GOP 率 ${pct(GROUP.gopRate)} · 净利率 ${pct(GROUP.netMargin)}`, 'blue', 'dashboard-group'));
    out.push(card('应缴增值税（9 月）', '¥' + wan(STORES.reduce((a, x) => a + x.vat, 0)) + ' 万', '已申报，10 月 15 日截止', 'teal', 'inv-input'));
  } else {
    out.push(card('待我审批', pending.length + ' 张', '合计 ¥' + fmt0(wbSum(pending)), 'amber', 'flow-todo'));
    out.push(card('集团 9 月收入', '¥' + wan(GROUP.revenueNet) + ' 万', `RevPAR ¥${GROUP.revpar} · 出租率 ${pct(GROUP.occ)}`, 'blue', 'dashboard-group'));
    out.push(card('费用预算执行', pct(bg.rate), `含在途 ¥${wan(bg.inTrans)} 万，可用 ¥${wan(bg.budget - bg.used - bg.inTrans)} 万`, bg.rate > .95 ? 'red' : 'amber', 'budget'));
    out.push(card('集团资金余额', '¥' + wan(GROUP.cash) + ' 万', `应收 ¥${wan(GROUP.receivable)} 万 · 应付 ¥${wan(GROUP.payable)} 万`, 'teal', 'dashboard-group'));
  }
  return out;
}

/* ---------- 片段：KPI ---------- */
function wbKpiCard(k){
  return `<div class="kpi" ${k.page ? `style="cursor:pointer" onclick="App.go('${k.page}')"` : ''}>
    <div class="kpi-bar" style="background:var(--${k.color}-600)"></div>
    <div class="kpi-label">${k.label}</div>
    <div class="kpi-value">${k.value}</div>
    <div class="kpi-foot c3">${k.foot}</div>
  </div>`;
}

/* ---------- 片段：单行待办 ---------- */
function wbTodoRow(d, role){
  const s = storeById(d.storeId);
  const flow = getFlow(d);
  const node = flow[d.currentNode] || flow[flow.length - 1];
  const block = d.risk && d.risk.some(r => r.level === 'block');
  const warn = d.risk && d.risk.some(r => r.level === 'warn');
  const actionLabel = d.status === 'approved'
    ? (role === 'cashier' ? '去付款' : '查看')
    : (canApprove(d, role) ? '去处理' : '查看');
  return `<div class="wb-item" onclick="App.openDoc('${d.id}')">
    <div class="wb-item-main">
      <div class="wb-item-top">
        <span class="wb-item-id">${d.id}</span>
        <span class="wb-item-title">${e(d.title)}</span>
        ${block ? '<span class="tag tag-red">阻断</span>' : warn ? '<span class="tag tag-amber">需关注</span>' : ''}
      </div>
      <div class="wb-item-sub">
        ${d.typeLabel} · ${s.name} · ${e(d.applicant)} · ${node.name}
      </div>
    </div>
    <div class="wb-item-right">
      <div class="wb-item-amt">¥${fmt(d.amount)}</div>
      <div class="wb-item-act">${actionLabel} →</div>
    </div>
  </div>`;
}

/* ---------- 片段：日历 ---------- */
function wbAgenda(){
  const role = State.role;
  const items = CALENDAR.filter(c => c.roles.includes(role))
    .slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const rows = items.map(c => {
    const t = WB_CAL_TYPE[c.type] || ['其他', 'tag-gray'];
    const diff = wbDayDiff(c.date);
    const urgent = c.state !== 'done' && diff >= 0 && diff <= 2;
    return `<div class="wb-agenda-item ${c.state === 'done' ? 'is-done' : ''} ${urgent ? 'is-urgent' : ''}">
      <div class="wb-agenda-date">
        <div class="wb-agenda-dd">${c.date.slice(8)}</div>
        <div class="wb-agenda-mm">${c.date.slice(5, 7)} 月</div>
      </div>
      <div class="wb-agenda-body">
        <div class="wb-agenda-title">${e(c.title)}</div>
        <div class="wb-agenda-meta">
          <span class="tag ${t[1]}">${t[0]}</span>
          <span>${c.state === 'done' ? '已完成' : wbRel(c.date)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<div class="card">
    <div class="card-head">
      <div class="card-title">财务日历<small>申报、付款、关账节点</small></div>
      <span class="fs11 c3">${WORKBENCH_DATE.slice(5, 7)} 月</span>
    </div>
    <div class="card-body" style="padding:6px 16px 12px">${rows || '<div class="fs12 c3" style="padding:12px 0">暂无节点</div>'}</div>
  </div>`;
}

/* ---------- 片段：快捷入口 ---------- */
function wbQuick(role){
  const items = QUICK_ENTRIES.filter(q => q.roles.includes(role));
  return `<div class="card">
    <div class="card-head"><div class="card-title">快捷入口<small>按你的权限显示</small></div></div>
    <div class="card-body" style="padding:6px 10px 14px">
      <div class="wb-quick">
        ${items.map(q => `<div class="wb-q" onclick="App.go('${q.page}')">
          <div class="wb-q-icon qc-${q.color}">${q.ch}</div>
          <div class="wb-q-label">${q.label}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

/* ---------- 片段：预算预警 ---------- */
function wbBudgetBlock(){
  const rows = BUDGETS.map(b => {
    const r = b.budget ? (b.used + b.inTrans) / b.budget : 0;   // 预算为 0 时避免除零
    return { ...b, r };
  }).sort((a, b) => b.r - a.r).slice(0, 4);
  return `<div class="card">
    <div class="card-head">
      <div class="card-title">预算预警<small>含在途，按执行率排序</small></div>
      <button class="btn btn-sm" onclick="App.go('budget')">全部</button>
    </div>
    <div class="card-body" style="padding:10px 16px 14px">
      ${rows.length ? rows.map(b => {
        const cls = b.r > 1 ? 'red' : b.r > .95 ? 'amber' : 'teal';
        const color = cls === 'red' ? 'var(--red-600)' : cls === 'amber' ? 'var(--amber-600)' : 'var(--teal-600)';
        return `<div style="margin-bottom:11px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
            <span>${b.item}</span>
            <span style="color:${color};font-weight:500">${pct(b.r, 0)}</span>
          </div>
          <div class="progress"><div class="progress-in" style="width:${Math.min(b.r * 100, 100)}%;background:${color}"></div></div>
          <div class="fs11 c3" style="margin-top:4px">预算 ¥${wan(b.budget)} 万 · 已用 ¥${wan(b.used)} 万${b.inTrans ? ' · 在途 ¥' + wan(b.inTrans) + ' 万' : ''}</div>
        </div>`;
      }).join('') : emptyState({ title:'各项预算执行正常', desc:'暂无超过 80% 的预算项' })}
    </div>
  </div>`;
}

/* ---------- 片段：经营速览 ---------- */
function wbPulse(role){
  const storeScope = ['manager','storefin'].includes(role);
  const s = storeById(State.storeId);
  const data = storeScope
    ? [
        ['出租率', pct(s.occ), `去年同期 ${pct(s.occLy)}`],
        ['平均房价', '¥' + s.adr, `去年同期 ¥${s.adrLy}`],
        ['RevPAR', '¥' + s.revpar, `${s.rooms} 间房 · ${s.city}`],
        ['GOP 率', pct(s.gopRate), `GOP ¥${wan(s.gop)} 万`],
        ['应收余额', '¥' + wan(s.receivable) + ' 万', `超 90 天 ¥${wan(s.arOver90)} 万`]
      ]
    : [
        ['加权出租率', pct(GROUP.occ), `${GROUP.rooms} 间房 · 14 家`],
        ['平均房价', '¥' + GROUP.adr, `RevPAR ¥${GROUP.revpar}`],
        ['不含税收入', '¥' + wan(GROUP.revenueNet) + ' 万', `GOP 率 ${pct(GROUP.gopRate)}`],
        ['应收余额', '¥' + wan(GROUP.receivable) + ' 万', `超 90 天 ¥${wan(STORES.reduce((a, x) => a + x.arOver90, 0))} 万`],
        ['资金余额', '¥' + wan(GROUP.cash) + ' 万', '14 个主体分户管理']
      ];
  return `<div class="card">
    <div class="card-head">
      <div class="card-title">经营速览<small>${storeScope ? s.name : '集团 14 家'}</small></div>
      <button class="btn btn-sm" onclick="App.go('${storeScope ? 'dashboard-store' : 'dashboard-group'}')">看板</button>
    </div>
    <div class="card-body" style="padding:10px 16px 14px">
      ${data.map(r => `<div class="wb-pulse-row">
        <span class="c2">${r[0]}</span>
        <strong>${r[1]}</strong>
        <span class="fs11 c3">${r[2]}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ---------- 片段：通知 ---------- */
function wbNotices(role){
  const list = NOTICES.filter(n => n.roles.includes(role)).slice(0, 3);
  return `<div class="card">
    <div class="card-head"><div class="card-title">通知与制度<small>${list.length} 条</small></div></div>
    <div class="card-body" style="padding:6px 16px 12px">
      ${list.length ? list.map(n => `<div class="wb-msg" onclick="App.wbNotice('${n.id}')">
        <div class="wb-msg-top">
          <span class="tag tag-blue">${n.tag}</span>
          <span class="wb-msg-title">${e(n.title)}</span>
        </div>
        <div class="fs11 c3" style="margin-top:4px">${n.date}</div>
      </div>`).join('') : emptyState({ title:'当前角色暂无通知' })}
    </div>
  </div>`;
}

/* ---------- 主视图 ---------- */
Views['workbench'] = function(){
  const role = State.role;
  const r = ROLES[role];
  const s = storeById(State.storeId);
  const tabs = wbTabs();
  const tab = wbCurrentTab(tabs);
  const kpis = wbKpis();
  const pendingCount = State.docs.filter(d => d.status === 'pending' && canApprove(d, role)).length;
  const payableCount = State.docs.filter(d => d.status === 'approved').length;
  const todayCal = CALENDAR.filter(c => c.roles.includes(role) && c.state !== 'done' && wbDayDiff(c.date) === 0).length;
  const myPayable = role === 'cashier' ? payableCount : 0;
  const todayCount = pendingCount + myPayable + todayCal;
  const parts = [];
  if (pendingCount) parts.push(`${pendingCount} 张单据待你审批`);
  if (myPayable) parts.push(`${myPayable} 笔付款待你执行`);
  if (todayCal) parts.push(`${todayCal} 个节点今天到期`);
  const tip = todayCount
    ? `今天有 <b>${todayCount}</b> 件事需要你处理${parts.length ? '，其中' + parts.join('、') : ''}。`
    : '今天没有必须处理的事项。可以看看经营数据和预算执行情况。';

  const h = new Date().getHours();
  const greet = h < 6 ? '凌晨好' : h < 12 ? '上午好' : h < 18 ? '下午好' : '晚上好';
  const scopeText = ['manager','storefin'].includes(role)
    ? `${s.name} · ${s.entityName}`
    : '集团 14 家独立法人';

  const tabHtml = tabs.map(t => `<div class="wb-tab ${t.key === tab.key ? 'active' : ''}" onclick="App.wbTab('${t.key}')">
    ${t.label}<span class="wb-tab-n">${t.list.length}</span></div>`).join('');

  const listHtml = tab.list.length
    ? tab.list.slice(0, 6).map(d => wbTodoRow(d, role)).join('')
    : `<div class="wb-empty">这一类暂时没有需要处理的事项。${tab.key === 'approve' ? '审批人不在线时，单据会自动升级提醒，不会压在某个人的抽屉里。' : ''}</div>`;

  return `
  <div class="wb-hero">
    <div class="wb-hero-left">
      <div class="wb-greet">${greet}，${r.name}</div>
      <div class="wb-date">${WORKBENCH_DATE.slice(0, 4)} 年 ${WORKBENCH_DATE.slice(5, 7)} 月 ${WORKBENCH_DATE.slice(8)} 日 ${wbWeekday(WORKBENCH_DATE)} · ${scopeText}</div>
      <div class="wb-hero-tip">${tip}</div>
    </div>
    <div class="wb-hero-right">
      <div class="wb-chip"><span>会计期间</span><b>2026-10</b></div>
      <div class="wb-chip"><span>上月</span><b class="ok">已关账</b></div>
      <div class="wb-chip"><span>我的待办</span><b class="warn">${pendingCount + (role === 'cashier' ? payableCount : 0)}</b></div>
    </div>
  </div>

  <div class="grid g-4" style="margin-bottom:14px">
    ${kpis.map(wbKpiCard).join('')}
  </div>

  <div class="wb-cols">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="card-head">
          <div class="card-title">我的待办<small>按角色自动推送，不用找人签字</small></div>
          <button class="btn btn-sm" onclick="App.go('${tab.key === 'pay' ? 'flow-pay' : tab.key === 'approve' ? 'flow-todo' : 'flow-my'}')">全部</button>
        </div>
        <div class="wb-tabs">${tabHtml}</div>
        <div class="wb-list">${listHtml}</div>
      </div>

      <div class="wb-3col">
        ${wbBudgetBlock()}
        ${wbPulse(role)}
        ${wbNotices(role)}
      </div>
    </div>

    <div>
      ${wbQuick(role)}
      <div style="height:14px"></div>
      ${wbAgenda()}
    </div>
  </div>`;
};

/* ---------- 通知详情 ---------- */
function wbNotice(id){
  const n = NOTICES.find(x => x.id === id);
  if (!n) return;
  openModal(`<div class="modal-head">
      <div>
        <div class="modal-title">${e(n.title)}</div>
        <div class="modal-sub">${n.date} · ${n.tag}</div>
      </div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <div class="notice notice-blue" style="margin-bottom:12px">
        <div>${e(n.body)}</div>
      </div>
      <div class="fs12 c3">该通知面向：${n.roles.map(k => ROLES[k].name).join('、')}</div>
    </div>`);
}
