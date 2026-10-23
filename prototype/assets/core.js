/* ================= 核心：状态、路由、组件 ================= */

const State = {
  role: 'hqfin',
  page: 'dashboard-group',
  storeId: 'S01',
  docs: [],
  log: [],
  pendingSplitConfirm: false,
  formAttach: [],        // 新建单据时暂存的附件（提交后写入单据）
  formReceipt: [],       // 付款后暂存的银行回单
  formLines: [],         // 新建单据时的多行明细
  formInvoices: [],      // 新建单据时从发票池勾选的发票
  lastAccount: null      // 上次使用的收款账户（模拟「记住上次」）
};

/* ---------- 工具 ---------- */
/* 数值兜底：undefined / NaN / Infinity 一律不出数字。
   财务页面上「NaN%」「∞」「Infinity」比空白更糟——用户会以为系统算错了账，
   所以宁可显示破折号，让人一眼看出「这里没有有效数据」。 */
const isBad = n => n === null || n === undefined || n === '' || typeof n !== 'number' || isNaN(n) || !isFinite(n);
const fmt = n => isBad(n) ? '—' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = n => isBad(n) ? '—' : Number(Math.round(n)).toLocaleString('zh-CN');
const wan = n => isBad(n) ? '—' : (n / 10000).toFixed(1);
const pct = (n, d = 1) => isBad(n) ? '—' : (n * 100).toFixed(d) + '%';
const e = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- 空态 ----------
   全系统只有一套空态语言：卡片/列表用 emptyState，表格 tbody 用 emptyRow。
   空态必须说清楚「为什么空」和「下一步做什么」，否则用户无法区分
   「业务上确实没有」和「系统没加载出来」。 */
function emptyState(opt){
  const o = opt || {};
  return `<div class="empty-block">
    <div class="empty-title">${e(o.title || '暂无数据')}</div>
    ${o.desc ? `<div class="empty-desc">${e(o.desc)}</div>` : ''}
    ${o.action && o.action.text ? `<button class="btn btn-sm" onclick="${o.action.onclick || ''}">${e(o.action.text)}</button>` : ''}
  </div>`;
}
/* 表格内空态：不能带背景色与圆角，否则会在表格里出现一条突兀的灰带 */
function emptyRow(colspan, text, hint){
  return `<tr><td colspan="${colspan}" class="empty-cell">
    <div class="empty-cell-t">${e(text || '暂无数据')}</div>
    ${hint ? `<div class="empty-cell-s">${e(hint)}</div>` : ''}
  </td></tr>`;
}

function storeById(id){ return STORES.find(s => s.id === id) || STORES[0]; }
function docById(id){ return State.docs.find(d => d.id === id); }

/* 数据范围：员工看本人、店长/门店财务看本店、总部看全集团 */
function inScope(doc, role){
  const r = role || State.role;
  if (r === 'staff') return doc.applicant === '陈晓燕';
  if (r === 'manager' || r === 'storefin') return doc.storeId === State.storeId;
  return true;
}

/* ---------- 审批链 ---------- */
function getFlow(doc){
  const nodes = [
    { name:'提交申请', role:'申请人', who:doc.applicant },
    { name:'店长审批', role:'manager', who:'门店店长' }
  ];
  if (doc.amount < 3000){
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
  } else if (doc.amount < 20000){
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
    nodes.push({ name:'总部财务审核', role:'hqfin', who:'总部财务经理' });
  } else if (doc.amount < 50000){
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
    nodes.push({ name:'总部财务审核', role:'hqfin', who:'总部财务经理' });
    nodes.push({ name:'财务总监审批', role:'cfo', who:'财务总监' });
  } else {
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
    nodes.push({ name:'总部财务审核', role:'hqfin', who:'总部财务经理' });
    nodes.push({ name:'财务总监审批', role:'cfo', who:'财务总监' });
    nodes.push({ name:'总经理审批', role:'gm', who:'总经理' });
  }
  nodes.push({ name:'出纳付款', role:'cashier', who:'总部出纳' });
  return nodes;
}

/* ---------- 指纹（演示用简化哈希） ---------- */
function fingerprint(doc){
  const raw = doc.id + '|' + doc.storeId + '|' + doc.amount.toFixed(2) + '|' + (doc.payee || '') + '|' + (doc.lines || []).map(l => l.amount).join(',');
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++){ h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).toUpperCase().padStart(8, '0');
}

/* ---------- 持久化 ---------- */
function saveState(){
  try{
    localStorage.setItem('yq_fms_docs', JSON.stringify(State.docs.map(d => ({
      id:d.id, status:d.status, currentNode:d.currentNode, amount:d.amount,
      log:d.log || [], receipt:d.receipt || null, attach:d.attach || []
    }))));
    localStorage.setItem('yq_fms_log', JSON.stringify(State.log));
    if (State.lastAccount) localStorage.setItem('yq_fms_acct', JSON.stringify(State.lastAccount));
  }catch(err){}
}
function loadState(){
  try{
    const raw = localStorage.getItem('yq_fms_docs');
    const l = localStorage.getItem('yq_fms_log');
    const a = localStorage.getItem('yq_fms_acct');
    if (a) State.lastAccount = JSON.parse(a);
    if (l) State.log = JSON.parse(l);
    if (!raw) return;
    const saved = JSON.parse(raw);
    saved.forEach(s => {
      const d = State.docs.find(x => x.id === s.id);
      if (d){
        d.status = s.status; d.currentNode = s.currentNode;
        if (s.amount) d.amount = s.amount;
        d.log = s.log || [];
        d.receipt = s.receipt || null;
        if (s.attach && s.attach.length) d.attach = s.attach;
      }
    });
  }catch(err){}
}

/* ---------- 附件 ---------- */
function fileKind(name){
  const ext = String(name).split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','bmp','heic'].includes(ext)) return 'img';
  if (ext === 'pdf') return 'pdf';
  if (['xls','xlsx','csv'].includes(ext)) return 'xls';
  if (['doc','docx'].includes(ext)) return 'doc';
  if (['zip','rar','7z'].includes(ext)) return 'zip';
  return 'other';
}
function fileSize(bytes){
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
/* 附件行：scope 用于删除时回写（form / doc）
   docId 用于预览——附件对象只存元数据（name/size/kind），没有真实文件内容，
   所以要定位到「哪张单据的第几个附件」才能还原预览，光有下标不够。
   可打开的附件给 attach-name 加 open 样式，让用户看得出「这个能点」。 */
function attachRow(a, scope, idx, docId){
  const k = ATTACH_KIND[a.kind] || ATTACH_KIND.other;
  const canDel = !!scope;
  const viewable = !!docId;
  return `<div class="attach-item">
    <span class="tag ${k.cls}">${k.label}</span>
    <span class="attach-name ${viewable ? 'open' : ''}" title="${viewable ? '点击预览' : e(a.name)}"
      ${viewable ? `onclick="App.openAttach('${docId}',${idx})"` : ''}>${e(a.name)}</span>
    <span class="attach-size">${a.size || ''}</span>
    ${a.by ? `<span class="attach-by">${e(a.by)} · ${a.time || ''}</span>` : ''}
    ${viewable ? `<button class="attach-view" title="预览" onclick="App.openAttach('${docId}',${idx})">预览</button>` : ''}
    ${canDel ? `<button class="attach-del" title="移除" onclick="App.removeAttach('${scope}',${idx})">×</button>` : ''}
  </div>`;
}
/* 只有「既不能删、也不能预览」时才标"已归档"。
   早先的写法是 canDel || viewable 为空就标，结果新建表单里的暂存附件也标了"已归档"——
   用户会以为附件已经随单据提交了，其实还没提交。 */
/* scope 为 null 且没有 docId 时（新建单据的暂存附件）不显示"已归档"，
   否则会让人以为附件已经随单据提交了——其实还没提交。 */
function attachList(list, scope, docId){
  if (!list || !list.length)
    return `<div class="attach-empty">暂无附件。可上传合同、验收单、对账单、现场照片等非发票材料。</div>`;
  return list.map((a, i) => attachRow(a, scope, i, docId)).join('');
}

/* ---------- 导航 ---------- */
function renderNav(){
  const role = State.role;
  const todoCount = State.docs.filter(d => (d.status === 'pending' || d.status === 'approved') && canApprove(d, role)).length;
  let html = '';
  NAV.forEach(g => {
    const items = g.items.filter(i => i.roles.includes(role));
    if (!items.length) return;
    html += `<div class="nav-group"><div class="nav-group-title">${g.group}</div>`;
    items.forEach(i => {
      const badge = ((i.id === 'flow-todo' || i.id === 'workbench') && todoCount > 0) ? `<span class="nav-badge">${todoCount}</span>` : '';
      html += `<div class="nav-item ${State.page === i.id ? 'active' : ''}" onclick="App.go('${i.id}')">
        <span class="nav-dot"></span><span>${i.label}</span>${badge}</div>`;
    });
    html += '</div>';
  });
  document.getElementById('nav').innerHTML = html;
}

function canApprove(doc, role){
  const flow = getFlow(doc);
  const node = flow[doc.currentNode];
  if (!node) return false;
  if (role === 'cfo') return true;
  return node.role === role;
}

function renderRoleSwitch(){
  const sel = document.getElementById('roleSelect');
  sel.innerHTML = Object.keys(ROLES).map(k => `<option value="${k}" ${k === State.role ? 'selected' : ''}>${ROLES[k].name}</option>`).join('');
  document.getElementById('roleDesc').textContent = ROLES[State.role].desc;
  const r = ROLES[State.role];
  document.getElementById('userChip').innerHTML = `<div class="user-avatar">${r.name.slice(0, 1)}</div><span>${r.name}</span>`;
}

function renderEntityPicker(){
  const box = document.getElementById('entityPicker');
  const groupScope = ['dashboard-group'].includes(State.page)
    || (State.page === 'workbench' && !['manager','storefin'].includes(State.role));
  if (groupScope){
    box.innerHTML = `<span>数据范围</span><b>集团 14 家</b>`;
  } else {
    const opts = STORES.map(s => `<option value="${s.id}" ${s.id === State.storeId ? 'selected' : ''}>${s.name}</option>`).join('');
    box.innerHTML = `<span>门店</span><select class="input" style="border:none;background:transparent;padding:0;width:auto;font-weight:500" onchange="App.setStore(this.value)">${opts}</select>`;
  }
}

/* ---------- 路由 ---------- */
const Views = {};
const PAGE_META = {
  'workbench': ['我的工作台', '待办、日程、公告一屏掌握'],
  'dashboard-group': ['集团经营总览', '14 家独立法人 · 2026 年 9 月'],
  'dashboard-store': ['单店经营详情', ''],
  'report-pl': ['单店损益表', '管理口径 · USALI 结构'],
  'report-bridge': ['营业收入调节表', 'PMS 经营口径 → 总账会计口径'],
  'flow-todo': ['我的待办', ''],
  'flow-my': ['我的单据', ''],
  'flow-exp': ['费用报销', ''],
  'flow-pay': ['付款申请', ''],
  'inv-pool': ['发票池', '14 家共用发票库 · 按主体隔离抵扣'],
  'inv-add':  ['发票采集', '上传 → 识别 → 确认入库，查重在入库前'],
  'inv-input': ['进项抵扣台账', '按 14 个纳税主体分别核算'],
  'acc-voucher': ['凭证中心', '业务单据自动生成'],
  'acc-close': ['月末结账', '14 家并行关账'],
  'budget': ['预算执行', ''],
  'master': ['主数据', '14 个独立法人主体']
};

/* redirect 标记：无权限时跳回首页，同时防止首页本身也无权限导致无限递归 */
function go(page, redirect){
  const allowed = NAV.some(g => g.items.some(i => i.id === page && i.roles.includes(State.role)));
  if (!allowed){
    const home = ROLES[State.role].home;
    /* 跳回首页时不再提示，避免用户连续切换时被同一条 toast 刷屏 */
    if (!redirect && home !== page) toast('当前身份无权访问该页面', 'err');
    if (home !== page) go(home, true);
    return;
  }
  State.page = page;
  render();
  document.getElementById('content').scrollTop = 0;
}

function setRole(r){
  State.role = r;
  renderRoleSwitch();
  const allowed = NAV.some(g => g.items.some(i => i.id === State.page && i.roles.includes(r)));
  if (!allowed) State.page = ROLES[r].home;
  render();
  toast(`已切换为「${ROLES[r].name}」，可操作范围随之变化`);
}

function setStore(id){ State.storeId = id; render(); }

function render(){
  const meta = PAGE_META[State.page] || ['', ''];
  let sub = meta[1];
  if (['dashboard-store', 'report-pl', 'budget'].includes(State.page)){
    const s = storeById(State.storeId);
    sub = `${s.entityName} · 独立法人 · ${s.vatLabel}`;
  }
  document.getElementById('pageTitle').textContent = meta[0];
  document.getElementById('pageSub').textContent = sub;
  renderNav();
  renderEntityPicker();
  const fn = Views[State.page];
  document.getElementById('content').innerHTML = fn ? fn() : '<div class="card"><div class="card-body">页面建设中</div></div>';
}

/* ---------- 提示 ---------- */
function toast(msg, type = ''){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- 弹窗 ---------- */
function openModal(html, large){
  const m = document.getElementById('modal');
  m.className = 'modal' + (large ? ' modal-lg' : '');
  m.innerHTML = html;
  document.getElementById('modalMask').classList.add('show');
}
function closeModal(){ document.getElementById('modalMask').classList.remove('show'); }

/* ---------- 审批动作 ---------- */
function approveDoc(id){
  const d = docById(id);
  if (!d) return;
  if (d.risk && d.risk.some(r => r.level === 'block')){
    toast('该单据存在阻断级问题，无法审批通过。请先处理后再提交。', 'err');
    return;
  }
  const flow = getFlow(d);
  d.log = d.log || [];
  d.log.push({ act:'通过', by: ROLES[State.role].name, node: flow[d.currentNode].name, time: nowStr() });
  const next = d.currentNode + 1;
  if (next >= flow.length - 1){
    d.currentNode = flow.length - 1;
    d.status = 'approved';
  } else {
    d.currentNode = next;
  }
  saveState(); render();
  const nf = getFlow(d);
  toast(d.status === 'approved'
    ? '审批通过，已推送至总部出纳付款'
    : `审批通过，已流转至「${nf[d.currentNode].name}」`, 'ok');
}

function rejectDoc(id){
  const d = docById(id);
  if (!d) return;
  const flow = getFlow(d);
  d.log = d.log || [];
  d.log.push({ act:'驳回', by: ROLES[State.role].name, node: flow[d.currentNode].name, time: nowStr() });
  d.status = 'rejected';
  saveState(); render();
  toast('已驳回，将退回申请人修改', 'err');
}

function nowStr(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- 通用片段 ---------- */
function statusTag(status){
  const map = {
    pending: ['审批中', 'tag-amber'], approved: ['已审批', 'tag-teal'],
    rejected: ['已驳回', 'tag-red'], paid: ['已付款', 'tag-blue'], draft: ['草稿', 'tag-gray']
  };
  const s = map[status] || ['未知', 'tag-gray'];
  return `<span class="tag ${s[1]}">${s[0]}</span>`;
}

function flowBar(doc){
  const flow = getFlow(doc);
  let html = '<div class="flow">';
  flow.forEach((n, i) => {
    let cls = '';
    if (doc.status === 'rejected' && i === doc.currentNode) cls = 'reject';
    else if (i < doc.currentNode) cls = 'done';
    else if (i === doc.currentNode && doc.status === 'pending') cls = 'active';
    else if (i <= doc.currentNode) cls = 'done';
    const icon = cls === 'done' ? '✓' : cls === 'reject' ? '×' : (i + 1);
    html += `<div class="flow-node ${cls}">
      <div class="flow-dot">${icon}</div>
      <div class="flow-name">${n.name}</div>
      <div class="flow-who">${n.who}</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

function riskBlocks(doc){
  if (!doc.risk || !doc.risk.length) return '';
  return doc.risk.map(r => {
    const cls = r.level === 'block' ? 'notice-red' : 'notice-amber';
    const label = r.level === 'block' ? '阻断' : '警告';
    return `<div class="notice ${cls}" style="margin-bottom:8px">
      <div style="flex:0 0 auto"><b>${label}</b></div>
      <div>${e(r.text)}</div>
    </div>`;
  }).join('');
}

/* ---------- 图表：横向条形 ---------- */
function hbars(items, opts = {}){
  if (!items || !items.length) return '<div class="empty-inline">暂无数据</div>';
  const max = Math.max(...items.map(i => i.value), 1);
  return items.map(i => {
    const w = (i.value / max) * 100;
    const cls = i.cls || '';
    return `<div class="hbar-row">
      <div class="hbar-name" title="${e(i.name)}">${e(i.name)}</div>
      <div class="hbar-track">
        <div class="hbar-fill ${cls}" style="width:${w}%"></div>
      </div>
      <div class="hbar-val">${i.display || fmt0(i.value)}</div>
    </div>`;
  }).join('');
}

/* ---------- 图表：折线 ---------- */
function lineChart(data, opts = {}){
  /* 空数组时 Math.max(...[]) 得 -Infinity，坐标会算出 NaN，整张图变成空白不出错但很诡异 */
  if (!data || !data.length) return '<div class="empty-inline">暂无趋势数据</div>';
  /* 单点数据时 iw/(length-1) 除零，横坐标全变 Infinity，按两点处理 */
  const pts = data.length === 1 ? [data[0], data[0]] : data;
  const w = 640, h = opts.height || 180, pl = 46, pr = 12, pt = 14, pb = 26;
  const iw = w - pl - pr, ih = h - pt - pb;
  const vals = pts.map(d => d.v);
  const max = Math.max(...vals) * 1.08, min = Math.min(...vals) * 0.92;
  /* 12 个月收入全为 0 时 max、min 都是 0，y() 会除以 0 得 NaN；此处兜底 1 */
  const span = (max - min) || 1;
  const x = i => pl + (iw / (pts.length - 1)) * i;
  const y = v => pt + ih - ((v - min) / span) * ih;
  let path = '';
  pts.forEach((d, i) => { path += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(d.v).toFixed(1) + ' '; });
  const area = path + `L${x(pts.length-1).toFixed(1)} ${pt+ih} L${pl} ${pt+ih} Z`;
  let grid = '';
  for (let i = 0; i <= 3; i++){
    const gy = pt + (ih / 3) * i;
    const gv = max - ((max - min) / 3) * i;
    grid += `<line x1="${pl}" y1="${gy}" x2="${w-pr}" y2="${gy}" stroke="#EEF0F3" stroke-width="1"/>
      <text x="${pl-7}" y="${gy+3.5}" font-size="10" fill="#8A9099" text-anchor="end">${Math.round(gv)}</text>`;
  }
  let labels = '';
  pts.forEach((d, i) => {
    if (i % 2 === 0 || i === pts.length - 1)
      labels += `<text x="${x(i)}" y="${h-8}" font-size="9.5" fill="#8A9099" text-anchor="middle">${d.label || d.m.slice(5)}</text>`;
  });
  let dots = pts.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.v)}" r="2.5" fill="#185FA5"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
    ${grid}
    <path d="${area}" fill="#E6F1FB" opacity=".55"/>
    <path d="${path}" fill="none" stroke="#185FA5" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}
  </svg>`;
}
