/* ================= 手机端预览逻辑 =================
   与小程序工程同口径：同一份 data.js、同一套 getFlow/canApprove（来自 core.js）。
   本文件仅用于在电脑浏览器里预览移动端形态；正式移动端是 miniprogram/ 目录。 */

const MP = {
  role: 'hqfin',
  tab: 'workbench',
  todoTab: 'approve',
  docFilter: 'all',
  docId: null,
  docs: JSON.parse(JSON.stringify(DOCS)),
  tabKey: 'approve'
};

const MP_CAL_TYPE = {
  tax: ['税务', 'tag-amber'], pay: ['付款', 'tag-blue'], close: ['关账', 'tag-teal'],
  contract: ['合同', 'tag-gray'], ar: ['应收', 'tag-red']
};

const MP_STATUS = {
  pending: ['审批中', 'tag-amber'], approved: ['已审批', 'tag-teal'],
  rejected: ['已驳回', 'tag-red'], paid: ['已付款', 'tag-blue'], draft: ['草稿', 'tag-gray']
};

const MP_QUICK = [
  { label:'费用报销', ch:'报', color:'blue', page:'new-exp', roles:['staff','manager','storefin','hqfin','cfo'] },
  { label:'付款申请', ch:'付', color:'amber', page:'new-pay', roles:['manager','storefin','hqfin','cfo','cashier'] },
  { label:'发票采集', ch:'票', color:'red',  page:'invadd',  roles:['staff','storefin','hqfin','cfo'] },
  { label:'凭证中心', ch:'账', color:'blue', page:'',      roles:['storefin','hqfin','cfo'] },
  { label:'损益表',   ch:'损', color:'teal', page:'',      roles:['manager','storefin','hqfin','cfo'] },
  { label:'预算',     ch:'预', color:'amber', page:'',     roles:['manager','storefin','hqfin','cfo'] },
  { label:'结账',     ch:'结', color:'teal', page:'',      roles:['hqfin','cfo'] },
  { label:'主数据',   ch:'主', color:'gray', page:'',      roles:['hqfin','cfo'] }
];

const MP_ROLES = ['staff','manager','storefin','hqfin','cashier','cfo'];

/* ---------- 工具 ---------- */
function mpStore(id){ return STORES.find(s => s.id === id) || STORES[0]; }
function mpDoc(id){ return MP.docs.find(d => d.id === id); }
function mpSum(list){ return list.reduce((a, d) => a + d.amount, 0); }
function mpRoleName(k){ return ROLES[k].name; }
function mpBankOf(payee){
  if (!payee) return '—';
  const all = PAYEE_ACCOUNTS.concat(MY_ACCOUNTS);
  const a = all.find(x => x.payee === payee);
  return a ? a.bank : '—';
}
function mpBudget(){
  let budget = 0, used = 0, inTrans = 0;
  BUDGETS.forEach(b => { budget += b.budget; used += b.used; inTrans += b.inTrans; });
  return { budget, used, inTrans, rate: (used + inTrans) / budget };
}
function mpRel(dateStr){
  const a = new Date(dateStr + 'T00:00:00'), b = new Date(WORKBENCH_DATE + 'T00:00:00');
  const d = Math.round((a - b) / 86400000);
  if (d < -1) return Math.abs(d) + ' 天前';
  if (d === -1) return '昨天';
  if (d === 0) return '今天';
  if (d === 1) return '明天';
  return d + ' 天后';
}
function mpDayDiff(dateStr){
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(WORKBENCH_DATE + 'T00:00:00')) / 86400000);
}
function mpGreet(){
  const h = new Date().getHours();
  return h < 6 ? '凌晨好' : h < 12 ? '上午好' : h < 18 ? '下午好' : '晚上好';
}
function mpScope(role){
  if (role === 'manager' || role === 'storefin'){
    const s = mpStore('S01');
    return s.name + ' · ' + s.entityName;
  }
  return '集团 14 家独立法人';
}
function mpInScope(d, role){
  if (role === 'staff') return d.applicant === '陈晓燕';
  if (role === 'manager' || role === 'storefin') return d.storeId === 'S01';
  return true;
}

/* ---------- 待办集合 ---------- */
function mpTabs(role){
  const tabs = [];
  if (['manager','storefin','hqfin','cfo'].includes(role))
    tabs.push({ key:'approve', label:'待我审批', list: MP.docs.filter(d => d.status === 'pending' && canApprove(d, role)) });
  if (['cashier','hqfin','cfo'].includes(role))
    tabs.push({ key:'pay', label:'待我付款', list: MP.docs.filter(d => d.status === 'approved') });
  tabs.push({ key:'risk', label:'异常', list: MP.docs.filter(d => d.status !== 'paid' && d.risk && d.risk.length) });
  const mineLabel = role === 'staff' ? '我提交的' : (role === 'manager' || role === 'storefin') ? '本店' : '全部';
  tabs.push({ key:'mine', label: mineLabel, list: MP.docs.filter(d => mpInScope(d, role)) });
  return tabs;
}

function mpTodoRow(d, role, compact){
  const s = mpStore(d.storeId);
  const flow = getFlow(d);
  const node = flow[d.currentNode] || flow[flow.length - 1];
  const block = d.risk && d.risk.some(r => r.level === 'block');
  const warn = d.risk && d.risk.some(r => r.level === 'warn');
  const action = d.status === 'approved' ? (role === 'cashier' ? '去付款' : '查看')
    : (canApprove(d, role) ? '去处理' : '查看');
  return `<div class="td" onclick="Mp.openDoc('${d.id}')">
    <div class="td-main">
      <div class="td-top">
        <span class="td-id num">${d.id}</span>
        ${block ? '<span class="tag tag-red">阻断</span>' : warn ? '<span class="tag tag-amber">需关注</span>' : ''}
      </div>
      <div class="td-title">${e(d.title)}</div>
      <div class="td-meta">${d.typeLabel} · ${s.name} · ${e(d.applicant)}</div>
      ${compact ? '' : `<div class="td-node">${node.name} · ${node.who}</div>`}
    </div>
    <div class="td-right">
      <div class="td-amt num">¥${fmt(d.amount)}</div>
      <div class="td-act">${action} ›</div>
    </div>
  </div>`;
}

/* ================= 各页 ================= */

function pageWorkbench(){
  const role = MP.role;
  const pending = MP.docs.filter(d => d.status === 'pending' && canApprove(d, role));
  const payable = MP.docs.filter(d => d.status === 'approved');
  const todoBadge = pending.length + (role === 'cashier' ? payable.length : 0);
  const todayCal = CALENDAR.filter(c => c.roles.includes(role) && c.state !== 'done' && mpDayDiff(c.date) === 0).length;
  const myPayable = role === 'cashier' ? payable.length : 0;
  const total = role === 'staff'
    ? MP.docs.filter(d => d.applicant === '陈晓燕' && d.status === 'pending').length
    : pending.length + myPayable + todayCal;
  const parts = [];
  if (role !== 'staff' && pending.length) parts.push(pending.length + ' 张单据待你审批');
  if (role === 'cashier' && payable.length) parts.push(payable.length + ' 笔付款待你执行');
  if (role !== 'staff' && todayCal) parts.push(todayCal + ' 个节点今天到期');
  if (role === 'staff' && total) parts.push(total + ' 张我提交的单据在审批中');
  const summary = total ? `今天有 ${total} 件事需要你处理，其中${parts.join('、')}`
    : '今天没有必须处理的事项，可以看看预算执行与关账进度。';

  /* KPI */
  const s = mpStore('S01');
  const bg = mpBudget();
  const kpis = [];
  const failStores = STORES.filter(st => CLOSE_CHECKS.some(c => c.bad.includes(st.id)));
  if (role === 'staff'){
    const mine = MP.docs.filter(d => d.applicant === '陈晓燕');
    kpis.push(['我提交的单据', mine.length + ' 张', '审批中 ' + mine.filter(d => d.status === 'pending').length + ' 张', 'blue']);
    kpis.push(['在途报销金额', '¥' + fmt0(mine.filter(d => d.status === 'pending').reduce((a, d) => a + d.amount, 0)), '付款后到工资卡', 'teal']);
    kpis.push(['待我补充资料', mine.filter(d => d.status === 'rejected').length + ' 张', '驳回后需重走审批', 'amber']);
    kpis.push(['发票池可勾选', INVOICES.filter(i => i.status === 'unused').length + ' 张', '报销时直接勾选', 'gray']);
  } else if (role === 'manager'){
    kpis.push(['待我审批', pending.length + ' 张', '合计 ¥' + fmt0(mpSum(pending)), 'amber']);
    kpis.push([s.name + ' 9 月收入', '¥' + wan(s.revenueNet) + ' 万', '不含税 · 同比 ' + (s.revYoY >= 0 ? '+' : '') + (s.revYoY * 100).toFixed(1) + '%', 'blue']);
    kpis.push(['GOP 率', pct(s.gopRate), 'GOP ¥' + wan(s.gop) + ' 万 · 集团 ' + pct(GROUP.gopRate), 'teal']);
    kpis.push(['费用预算执行', pct(bg.rate), '含在途 ¥' + wan(bg.inTrans) + ' 万', bg.rate > .95 ? 'red' : 'amber']);
  } else if (role === 'storefin'){
    const bad = CLOSE_CHECKS.filter(c => c.bad.includes(s.id));
    kpis.push(['待我初审', pending.length + ' 张', '合计 ¥' + fmt0(mpSum(pending)), 'amber']);
    kpis.push(['发票待认证', INVOICES.filter(i => i.status === 'unused').length + ' 张', '认证后进入当期抵扣', 'red']);
    kpis.push(['本店关账检查', bad.length ? bad.length + ' 项未通过' : '全部通过', bad.length ? bad[0].label : '10 月 31 日启动', bad.length ? 'red' : 'teal']);
    kpis.push(['费用预算执行', pct(bg.rate), '含在途 ¥' + wan(bg.inTrans) + ' 万', bg.rate > .95 ? 'red' : 'amber']);
  } else if (role === 'cashier'){
    kpis.push(['待付款', payable.length + ' 笔', '合计 ¥' + fmt0(mpSum(payable)) + ' · 按主体分批', 'amber']);
    kpis.push(['集团账户余额', '¥' + wan(GROUP.cash) + ' 万', '14 个主体分户，不可混用', 'teal']);
    kpis.push(['应收超 90 天', '¥' + wan(GROUP.arOver90) + ' 万', '应收合计 ¥' + wan(GROUP.receivable) + ' 万', 'red']);
    kpis.push(['应付账款余额', '¥' + wan(GROUP.payable) + ' 万', '禁止跨主体勾选付款', 'blue']);
  } else if (role === 'hqfin'){
    kpis.push(['待我终审', pending.length + ' 张', '合计 ¥' + fmt0(mpSum(pending)), 'amber']);
    kpis.push(['14 家关账进度', (14 - failStores.length) + ' / 14', failStores.length ? '未通过：' + failStores.map(x => x.name).join('、') : '全部通过', failStores.length ? 'red' : 'teal']);
    kpis.push(['集团 9 月收入', '¥' + wan(GROUP.revenueNet) + ' 万', 'GOP 率 ' + pct(GROUP.gopRate) + ' · 净利率 ' + pct(GROUP.netMargin), 'blue']);
    kpis.push(['应缴增值税（9 月）', '¥' + wan(STORES.reduce((a, x) => a + x.vat, 0)) + ' 万', '已申报 · 10 月 15 日截止', 'teal']);
  } else {
    kpis.push(['待我审批', pending.length + ' 张', '合计 ¥' + fmt0(mpSum(pending)), 'amber']);
    kpis.push(['集团 9 月收入', '¥' + wan(GROUP.revenueNet) + ' 万', 'RevPAR ¥' + GROUP.revpar + ' · 出租率 ' + pct(GROUP.occ), 'blue']);
    kpis.push(['费用预算执行', pct(bg.rate), '含在途 ¥' + wan(bg.inTrans) + ' 万 · 可用 ¥' + wan(bg.budget - bg.used - bg.inTrans) + ' 万', bg.rate > .95 ? 'red' : 'amber']);
    kpis.push(['集团资金余额', '¥' + wan(GROUP.cash) + ' 万', '应收 ¥' + wan(GROUP.receivable) + ' 万 · 应付 ¥' + wan(GROUP.payable) + ' 万', 'teal']);
  }

  /* 待办 */
  const tabs = mpTabs(role);
  if (!tabs.find(t => t.key === MP.tabKey)) MP.tabKey = tabs[0].key;
  const cur = tabs.find(t => t.key === MP.tabKey);

  /* 日历 */
  const cal = CALENDAR.filter(c => c.roles.includes(role))
    .slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
    .map(c => {
      const t = MP_CAL_TYPE[c.type] || ['其他', 'tag-gray'];
      const diff = mpDayDiff(c.date);
      const urgent = c.state !== 'done' && diff >= 0 && diff <= 2;
      return `<div class="cal ${c.state === 'done' ? 'is-done' : ''} ${urgent ? 'is-urgent' : ''}">
        <div class="cal-date"><span class="cal-dd num">${c.date.slice(8)}</span><span class="cal-mm">${Number(c.date.slice(5, 7))} 月</span></div>
        <div class="cal-body">
          <div class="cal-title">${e(c.title)}</div>
          <div class="cal-meta"><span class="tag ${t[1]}">${t[0]}</span><span>${c.state === 'done' ? '已完成' : mpRel(c.date)}</span></div>
        </div>
      </div>`;
    }).join('');

  const notices = NOTICES.filter(n => n.roles.includes(role)).slice(0, 3);

  return `
  <div class="hero">
    <div class="hero-head">
      <div>
        <div class="hero-greet">${mpGreet()}，${mpRoleName(role)}</div>
        <div class="hero-date">2026 年 10 月 21 日 周三 · ${mpScope(role)}</div>
      </div>
    </div>
    <div class="hero-tip">${summary}</div>
    <div class="hero-chips">
      <div class="chip"><span class="chip-k">会计期间</span><span class="chip-v num">2026-10</span></div>
      <div class="chip"><span class="chip-k">上月</span><span class="chip-v ok">已关账</span></div>
      <div class="chip"><span class="chip-k">我的待办</span><span class="chip-v warn num">${todoBadge}</span></div>
    </div>
  </div>
  <div class="body">
    <div class="kpi-grid">
      ${kpis.map(k => `<div class="kpi"><div class="kpi-bar bg-${k[3]}"></div>
        <div class="kpi-label">${k[0]}</div><div class="kpi-value num">${k[1]}</div>
        <div class="kpi-foot">${k[2]}</div></div>`).join('')}
    </div>

    <div class="card">
      <div class="card-hd">
        <div class="card-ttl">我的待办<span class="sub">按角色自动推送</span></div>
        <span class="card-more" onclick="Mp.tab('todo')">全部 ${cur.list.length} ›</span>
      </div>
      <div class="tabs">
        ${tabs.map(t => `<div class="tab ${t.key === MP.tabKey ? 'active' : ''}" onclick="Mp.todoTab('${t.key}')">${t.label}<span class="tab-n num">${t.list.length}</span></div>`).join('')}
      </div>
      ${cur.list.length
        ? cur.list.slice(0, 5).map(d => mpTodoRow(d, role, true)).join('')
        : '<div class="empty">这一类暂时没有需要处理的事项。</div>'}
    </div>

    <div class="card">
      <div class="card-hd"><div class="card-ttl">快捷入口<span class="sub">按你的权限显示</span></div></div>
      <div class="q-grid">
        ${MP_QUICK.filter(q => q.roles.includes(role)).map(q =>
          `<div class="q" onclick="Mp.quick('${q.page}')"><div class="q-ic qc-${q.color}">${q.ch}</div><div class="q-label">${q.label}</div>${q.page.indexOf('new-') === 0 ? '<div class="q-new">可发起</div>' : ''}</div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><div class="card-ttl">财务日历<span class="sub">申报、付款、关账节点</span></div><span class="t-aux">${CALENDAR.filter(c => c.roles.includes(role)).length} 个节点</span></div>
      ${cal}
    </div>

    <div class="card">
      <div class="card-hd"><div class="card-ttl">通知与制度<span class="sub">${notices.length} 条</span></div></div>
      ${notices.map(n => `<div class="msg" onclick="Mp.notice(${notices.indexOf(n)})">
        <div class="msg-top"><span class="tag tag-blue">${n.tag}</span><span class="msg-title">${e(n.title)}</span></div>
        <div class="t-aux" style="margin-top:4px">${n.date}</div>
      </div>`).join('')}
      <div class="foot-note">数据截至 2026-10 · 演示用模拟数据，不连接真实系统</div>
    </div>
  </div>`;
}

function pageTodo(){
  const role = MP.role;
  const pending = MP.docs.filter(d => d.status === 'pending' && canApprove(d, role));
  const payable = MP.docs.filter(d => d.status === 'approved');
  const blockN = MP.docs.filter(d => d.status === 'pending' && canApprove(d, role) && d.risk && d.risk.some(r => r.level === 'block')).length;
  const tabs = mpTabs(role);
  if (!tabs.find(t => t.key === MP.tabKey)) MP.tabKey = tabs[0].key;
  const cur = tabs.find(t => t.key === MP.tabKey);
  const statKey = role === 'cashier' ? ['待我付款', payable.length, '¥' + fmt0(mpSum(payable))]
    : ['待我审批', pending.length, '¥' + fmt0(mpSum(pending))];
  return `<div class="body">
    <div class="stat-row">
      <div class="stat"><div class="stat-v num">${statKey[1]}</div><div class="stat-k">${statKey[0]}（张）</div></div>
      <div class="stat"><div class="stat-v num">${statKey[2]}</div><div class="stat-k">合计金额</div></div>
      <div class="stat"><div class="stat-v num">${blockN}</div><div class="stat-k">其中阻断级</div></div>
    </div>
    <div class="card">
      <div class="tabs">
        ${tabs.map(t => `<div class="tab ${t.key === MP.tabKey ? 'active' : ''}" onclick="Mp.todoTab('${t.key}')">${t.label}<span class="tab-n num">${t.list.length}</span></div>`).join('')}
      </div>
      ${cur.list.length ? cur.list.map(d => mpTodoRow(d, role, false)).join('')
        : '<div class="empty">这一类暂时没有需要处理的事项。</div>'}
    </div>
  </div>`;
}

function pageDocs(){
  const role = MP.role;
  const list = MP.docs.filter(d => mpInScope(d, role));
  const map = {
    all: list,
    pending: list.filter(d => d.status === 'pending'),
    approved: list.filter(d => d.status === 'approved'),
    rejected: list.filter(d => d.status === 'rejected')
  };
  const cur = map[MP.docFilter] || map.all;
  return `<div class="body">
    <div class="filters">
      ${[['all','全部'],['pending','审批中'],['approved','已审批'],['rejected','已驳回']].map(f =>
        `<div class="fchip ${MP.docFilter === f[0] ? 'active' : ''}" onclick="Mp.filter('${f[0]}')">${f[1]} ${map[f[0]].length}</div>`).join('')}
    </div>
    <div class="card">
      ${cur.length ? cur.map(d => {
        const st = MP_STATUS[d.status] || MP_STATUS.draft;
        const s = mpStore(d.storeId);
        return `<div class="td" onclick="Mp.openDoc('${d.id}')">
          <div class="td-main">
            <div class="td-top"><span class="td-id num">${d.id}</span><span class="tag ${st[1]}">${st[0]}</span></div>
            <div class="td-title">${e(d.title)}</div>
            <div class="td-meta">${d.typeLabel} · ${s.name} · ${e(d.applicant)} · ${d.submitDate.slice(5, 16)}</div>
          </div>
          <div class="td-right"><div class="td-amt num">¥${fmt(d.amount)}</div></div>
        </div>`;
      }).join('') : '<div class="empty">该状态下暂无单据。</div>'}
    </div>
  </div>`;
}

function pageMine(){
  const role = MP.role;
  const k = ROLES[role];
  return `<div class="body">
    <div class="me-hero">
      <div class="me-name">${k.name}</div>
      <div class="me-desc">${k.desc}</div>
      <div class="me-scope">数据范围：${mpScope(role)}</div>
    </div>
    <div class="card">
      <div class="sect-hd">切换演示身份<span class="sub">真实系统由登录与权限决定，不可自选</span></div>
      <div class="role-list">
        ${MP_ROLES.map(r => `<div class="role-chip ${r === role ? 'on' : ''}" onclick="Mp.setRole('${r}')">${ROLES[r].name}</div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="me-row"><span>会计期间</span><span class="r num">2026-10（进行中）</span></div>
      <div class="me-row"><span>上一期间</span><span class="r num">2026-09（已关账）</span></div>
      <div class="me-row"><span>审批链口径</span><span class="r">金额分档 3千 / 2万 / 5万</span></div>
    </div>
    <div class="card">
      ${[['我的单据','flow-my'],['发票池','发票池演示数据 12 张'],['预算执行','8 个费用项目'],['主数据','14 个独立法人主体'],['关于本原型','']].map((r, i) =>
        `<div class="me-row" style="cursor:pointer" onclick="Mp.about(${i})"><span>${r[0]}</span><span class="r">${r[1] || '查看 ›'}</span></div>`).join('')}
    </div>
    <div class="foot-note">财务管理平台 · 移动端原型 v0.2 · 模拟数据</div>
  </div>`;
}

function pageDetail(){
  const d = mpDoc(MP.docId);
  if (!d) return '<div class="empty">单据不存在</div>';
  const role = MP.role;
  const flow = getFlow(d);
  const curNode = flow[d.currentNode] || flow[flow.length - 1];
  const st = MP_STATUS[d.status] || MP_STATUS.draft;
  const nodes = flow.map((n, i) => {
    let cls = '';
    if (d.status === 'rejected' && i === d.currentNode) cls = 'reject';
    else if (i < d.currentNode) cls = 'done';
    else if (i === d.currentNode && d.status === 'pending') cls = 'active';
    else if (i <= d.currentNode) cls = 'done';
    const icon = cls === 'done' ? '✓' : cls === 'reject' ? '×' : (i + 1);
    return `<div class="cn ${cls}">
      <div class="cn-dot">${icon}</div>
      <div class="cn-name">${n.name}</div>
      <div class="cn-who">${n.who}</div>
    </div>`;
  }).join('');

  let stepText = '';
  if (d.status === 'pending') stepText = `第 ${d.currentNode + 1} / ${flow.length} 步 · ${curNode.name}`;
  else if (d.status === 'approved') stepText = '审批已完成 · 待出纳付款';
  else if (d.status === 'rejected') stepText = `已于「${curNode.name}」驳回`;

  const risks = (d.risk || []).map(r =>
    `<div class="notice ${r.level === 'block' ? 'notice-red' : 'notice-amber'}">
      <b>${r.level === 'block' ? '阻断' : '警告'} · ${r.code}</b><span>${e(r.text)}</span>
    </div>`).join('');
  const hasBlock = d.risk && d.risk.some(r => r.level === 'block');
  const canAct = d.status === 'pending' && canApprove(d, role);

  let deny = '';
  if (d.status === 'approved') deny = '审批已完成，等待总部出纳按主体付款';
  else if (d.status === 'rejected') deny = '单据已驳回，退回申请人修改';
  else deny = '当前节点：' + curNode.name + ' · ' + curNode.who;

  const invTotal = (d.invoices || []).reduce((a, v) => a + v.amount, 0);
  const s = mpStore(d.storeId);

  return `
    <div class="d-hero">
      <div class="d-top"><span class="d-id num">${d.id}</span><span class="tag ${st[1]}">${st[0]}</span></div>
      <div class="d-title">${e(d.title)}</div>
      <div class="d-amt num">¥${fmt(d.amount)}</div>
      <div class="d-sub">${d.typeLabel} · ${s.name} · ${s.entityName} · ${e(d.applicant)}（${d.dept}）<br>提交于 ${d.submitDate} · 预算项目：${d.budgetItem}${d.payee ? '<br>收款方：' + e(d.payee) + '<br>开户行：' + e(d.payBank || mpBankOf(d.payee)) + '<br>账号：' + e(d.payeeAccount) : ''}</div>
    </div>

    <div class="card" style="margin:0 12px 10px">
      <div class="sect-hd">审批链<span class="sub">${stepText}</span></div>
      <div class="chain" style="margin:0">${nodes}</div>
    </div>

    <div class="card" style="margin:0 12px 10px">
      <div class="sect-hd">处理轨迹<span class="sub">${mpLogs(d).length} 步</span></div>
      ${mpLogs(d).map(l => `<div class="lg">
        <span class="lg-dot ${l.act === '驳回' ? 'lg-reject' : (l.act === '通过' ? 'lg-ok' : '')}"></span>
        <span class="lg-main">
          <span class="lg-top"><b>${e(l.act)}</b><span class="lg-time num">${l.time}</span></span>
          <span class="lg-meta">${e(l.by)} · ${e(l.node)}</span>
          ${l.note ? `<span class="lg-note">${e(l.note)}</span>` : ''}
        </span>
      </div>`).join('')}
    </div>

    ${risks ? `<div style="padding:0 12px;margin-bottom:2px">${risks}</div>` : ''}

    <div class="card" style="margin:10px 12px">
      <div class="sect-hd">费用明细</div>
      ${(d.lines || []).map(l => `<div class="line-row">
        <span class="l-name">${e(l.item)}</span>
        <span class="l-qty num">×${fmt0(l.qty)} · ¥${fmt(l.price)}</span>
        <span class="l-amt num">¥${fmt(l.amount)}</span>
      </div>`).join('')}
      ${(d.invoices || []).length ? `<div class="sect-hd" style="padding-top:12px">关联发票<span class="sub">发票池全局查重通过</span></div>` : ''}
      ${(d.invoices || []).map(v => `<div class="line-row">
        <span class="l-name">${v.code} · ${v.no}</span>
        <span class="l-qty">${e(v.seller).slice(0, 12)}…</span>
        <span class="l-amt num">¥${fmt(v.amount)}</span>
      </div>`).join('')}
      ${(d.invoices || []).length ? `<div class="line-row" style="font-weight:500"><span>发票合计</span><span></span><span class="l-amt num">¥${fmt(invTotal)}</span></div>` : ''}
      ${d.note ? `<div class="kv"><span class="k">备注</span><span class="v" style="max-width:220px">${e(d.note)}</span></div>` : ''}
      ${(d.attach || []).length ? `<div class="sect-hd" style="padding-top:12px">其他附件<span class="sub">非发票材料 ${d.attach.length} 个</span></div>` : ''}
      ${(d.attach || []).map(a => {
        const k = ATTACH_KIND[a.kind] || ATTACH_KIND.other;
        return `<div class="line-row"><span class="tag ${k.cls}">${k.label}</span>
          <span class="l-name">${e(a.name)}</span><span class="l-qty">${a.size || ''}</span></div>`;
      }).join('')}
      ${d.status === 'paid' ? `
        <div class="sect-hd" style="padding-top:12px">银行回单</div>
        ${d.receipt
          ? `<div class="line-row"><span class="tag tag-teal">回单</span><span class="l-name">${e(d.receipt.name)}</span><span class="l-qty">${d.receipt.serial || ''}</span></div>`
          : `<div style="padding:0 12px 10px"><div class="notice notice-red" style="margin:0"><b>缺少回单</b><span>付款已完成但回单未归档，关账检查会标记该笔。</span></div></div>`}
      ` : ''}
    </div>`;
}

function pageDetailActions(){
  const d = mpDoc(MP.docId);
  if (!d) return '';
  const role = MP.role;
  const flow = getFlow(d);
  const curNode = flow[d.currentNode] || flow[flow.length - 1];
  const hasBlock = d.risk && d.risk.some(r => r.level === 'block');
  const canAct = d.status === 'pending' && canApprove(d, role);
  if (canAct && !hasBlock)
    return `<div class="actions">
      <button class="btn btn-ghost" onclick="Mp.reject()">驳回</button>
      <button class="btn btn-primary" onclick="Mp.approve()">审批通过</button>
    </div>`;
  if (canAct && hasBlock)
    return `<div class="actions"><div class="deny">存在阻断级问题，需先处理后才能通过</div></div>`;
  let deny = '当前节点：' + curNode.name + ' · ' + curNode.who;
  if (d.status === 'approved') deny = '审批已完成，等待总部出纳按主体付款';
  else if (d.status === 'rejected') deny = '单据已驳回，退回申请人修改';
  return `<div class="actions"><div class="deny">${deny}</div></div>`;
}

/* ================= 容器与路由 ================= */

const TABS_DEF = [
  { key:'workbench', label:'工作台', icon:'⌂', title:'财务工作台' },
  { key:'todo',      label:'待办',   icon:'✓', title:'我的待办' },
  { key:'docs',      label:'单据',   icon:'≡', title:'全部单据' },
  { key:'mine',      label:'我的',   icon:'☰', title:'我的' }
];

function mpBadge(){
  const role = MP.role;
  const n = MP.docs.filter(d => (d.status === 'pending' && canApprove(d, role)) || d.status === 'approved').length;
  return n || '';
}

function render(){
  const screen = document.getElementById('screen');
  if (MP.tab === 'detail'){
    const d = mpDoc(MP.docId);
    screen.innerHTML = `
      <div class="statusbar"><span>9:41</span><span>●●●</span></div>
      <div class="appbar"><button class="back" onclick="Mp.tab('todo')">‹</button>${d ? e(d.typeLabel) : '单据'}</div>
      <div class="scroll" style="padding-top:12px">${pageDetail()}</div>
      ${pageDetailActions()}`;
    return;
  }
  if (MP.tab === 'invadd' || MP.tab === 'invadd-edit'){
    const editing = MP.tab === 'invadd-edit';
    screen.innerHTML = `
      <div class="statusbar"><span>9:41</span><span>●●●</span></div>
      <div class="appbar">${editing ? `<button class="back" onclick="Mp.iaCancel()">‹</button>` : ''}发票采集</div>
      <div class="scroll" id="scroll" style="padding-top:10px;padding-bottom:90px">
        ${editing ? pageInvEdit() : pageInvAdd()}
      </div>`;
    return;
  }
  if (MP.tab === 'newdoc'){
    screen.innerHTML = `
      <div class="statusbar"><span>9:41</span><span>●●●</span></div>
      <div class="appbar"><button class="back" onclick="Mp.nfCancel()">‹</button>${NF.type === 'expense' ? '新建费用报销' : '新建付款申请'}</div>
      <div class="scroll" id="scroll" style="padding-top:10px;padding-bottom:70px">${pageNewDoc()}</div>`;
    return;
  }

  const t = TABS_DEF.find(x => x.key === MP.tab);
  const body = MP.tab === 'workbench' ? pageWorkbench() : MP.tab === 'todo' ? pageTodo() : MP.tab === 'docs' ? pageDocs() : pageMine();
  const badge = mpBadge();
  screen.innerHTML = `
    <div class="statusbar"><span>9:41</span><span>●●●</span></div>
    <div class="appbar">${t.title}</div>
    <div class="scroll" id="scroll">${body}</div>
    <div class="tabbar">
      ${TABS_DEF.map(x => `<div class="tabitem ${MP.tab === x.key ? 'active' : ''}" onclick="Mp.tab('${x.key}')">
        <span class="ic">${x.icon}</span><span>${x.label}</span>
        ${x.key === 'todo' && badge ? `<span class="bdg">${badge}</span>` : ''}
      </div>`).join('')}
    </div>`;
}

/* ---------- 轻量弹层（替代 alert，保证在预览面板里也能看到） ---------- */
function mpLayer(html){
  const screen = document.getElementById('screen');
  const el = document.createElement('div');
  el.className = 'mp-mask';
  el.innerHTML = html;
  el.addEventListener('click', ev => { if (ev.target === el || ev.target.dataset.close) el.remove(); });
  screen.appendChild(el);
  return el;
}
function mpModal(title, body){
  mpLayer(`<div class="mp-modal">
    <div class="mm-title">${e(title)}</div>
    <div class="mm-body">${e(body)}</div>
    <button class="btn btn-primary" data-close="1" style="margin-top:14px">知道了</button>
  </div>`);
}
function mpToast(msg){
  const screen = document.getElementById('screen');
  const el = document.createElement('div');
  el.className = 'mp-toast';
  el.textContent = msg;
  screen.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

window.Mp = Object.assign({
  tab(key){ MP.tab = key; render(); const sc = document.getElementById('scroll'); if (sc) sc.scrollTop = 0; },
  todoTab(key){ MP.tabKey = key; render(); },
  filter(key){ MP.docFilter = key; render(); },
  openDoc(id){ MP.docId = id; MP.tab = 'detail'; render(); },
  setRole(r){ MP.role = r; render(); mpToast('已切换为「' + ROLES[r].name + '」'); },
  quick(page){
    if (page === 'docs'){ MP.tab = 'docs'; render(); return; }
    if (page === 'new-exp'){ nfInit('expense'); return; }
    if (page === 'new-pay'){ nfInit('payment'); return; }
    if (page === 'invadd'){ MP.tab = 'invadd'; render(); return; }
    mpToast('该功能在小程序原型中未开放页面');
  },
  notice(i){
    const list = NOTICES.filter(n => n.roles.includes(MP.role));
    const n = list[i];
    if (n) mpModal(n.title, n.body);
  },
  approve(){
    const d = mpDoc(MP.docId);
    if (!d) return;
    if (d.risk && d.risk.some(r => r.level === 'block')) return;
    const flow = getFlow(d);
    d.log = d.log || [];
    d.log.push({ act: '通过', by: ROLES[MP.role].name, node: flow[d.currentNode].name, time: '刚刚' });
    const next = d.currentNode + 1;
    let msg;
    if (next >= flow.length - 1){ d.currentNode = flow.length - 1; d.status = 'approved'; msg = '审批通过，已推送至出纳付款'; }
    else { d.currentNode = next; msg = '已流转至「' + flow[d.currentNode].name + '」'; }
    render();
    mpToast(msg);
  },
  reject(){
    const d = mpDoc(MP.docId);
    if (!d) return;
    const flow = getFlow(d);
    d.log = d.log || [];
    d.log.push({ act: '驳回', by: ROLES[MP.role].name, node: flow[d.currentNode].name, time: '刚刚' });
    d.status = 'rejected';
    render();
    mpToast('已驳回，退回申请人修改');
  },
  about(i){
    const texts = [
      '「我的单据」展示我提交或与我相关的全部单据，支持按状态筛选。',
      '发票池：12 张演示发票，含 1 张重复发票与 1 张异常凭证样例。发票全局唯一（防重复报销），抵扣按主体隔离。',
      '预算执行：8 个费用项目，三口径（实际 / 在途 / 承诺）不重复扣减，硬控只能在业务提交时触发。',
      '主数据：14 家酒店为 14 个独立法人，各自独立账套；科目由集团统一下发，门店只读。',
      '本页面为可试用原型：纯前端 + 模拟数据，不连接真实系统；正式版小程序在 miniprogram/ 目录，可用微信开发者工具导入运行。'
    ];
    mpModal('说明', texts[i] || '');
  }
}, MpNf);

render();
