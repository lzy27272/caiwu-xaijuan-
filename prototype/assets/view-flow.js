/* ================= 审批流 / 单据 / 付款 ================= */

/* 预算项映射（存量数据兜底；新建单据走 EXPENSE_TREE 的二级明细） */
const BUDGET_MAP = {
  '客房物料消耗':'客房物料', '维修保养费':'维修保养', '租赁费':'房屋租赁',
  '清洁绿化费':'维修保养', '业务招待费':'业务招待', '办公费':'办公及其他',
  '市场推广费':'市场推广', '物料消耗':'客房物料', '人工成本':'人工成本', '能源费':'能源费'
};
function budgetFor(item){
  const mapped = budgetItemOf(item);                       // 先查二级科目树
  const key = mapped || BUDGET_MAP[item] || item;
  return BUDGETS.find(b => b.item === key) || { item:key, budget:200000, used:120000, inTrans:5000 };
}

/* ---------- 我的待办 ---------- */
Views['flow-todo'] = function(){
  const role = State.role;
  const todo = State.docs.filter(d => (d.status === 'pending' || d.status === 'approved') && canApprove(d, role));
  const waiting = State.docs.filter(d => d.status === 'pending' && !canApprove(d, role));

  const row = d => {
    const s = storeById(d.storeId);
    const flow = getFlow(d);
    const node = flow[d.currentNode];
    const hasBlock = d.risk && d.risk.some(r => r.level === 'block');
    const hasWarn = d.risk && d.risk.some(r => r.level === 'warn');
    return `<tr onclick="App.openDoc('${d.id}')" style="cursor:pointer">
      <td><div class="strong">${d.id}</div><div class="fs11 c3">${d.title}</div></td>
      <td>${d.typeLabel}</td>
      <td>${s.name}<div class="fs11 c3">${s.entityName.slice(0, 12)}…</div></td>
      <td>${d.applicant}</td>
      <td class="num strong">${fmt(d.amount)}</td>
      <td>${hasBlock ? '<span class="tag tag-red">阻断</span>' : hasWarn ? '<span class="tag tag-amber">需关注</span>' : '<span class="tag tag-teal">无异常</span>'}</td>
      <td class="fs11">${node ? node.name : '—'}</td>
      <td class="num"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();App.openDoc('${d.id}')">处理</button></td>
    </tr>`;
  };

  return `<div class="notice notice-blue" style="margin-bottom:14px">
    <div><b>当前身份：${ROLES[role].name}。</b>按授权矩阵，你可处理金额与节点已在下方列出。切换左上角身份可看到不同角色的待办范围——这是本次线上化最核心的变化：<b>每个人的待办自动推送，不再需要拿着单据找人签字。</b></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head"><div class="card-title">待我处理<small>${todo.length} 张</small></div></div>
    <div class="card-body tight">
      ${todo.length ? `<table class="table">
        <thead><tr><th>单据</th><th>类型</th><th>归属主体 / 门店</th><th>申请人</th><th class="num">金额</th><th>风险</th><th>当前节点</th><th></th></tr></thead>
        <tbody>${todo.map(row).join('')}</tbody>
      </table>` : '<div style="padding:28px;text-align:center;color:var(--text-3)">当前没有待你处理的单据</div>'}
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title">流转中（不在你的节点）<small>${waiting.length} 张</small></div></div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>单据</th><th>类型</th><th>归属门店</th><th>申请人</th><th class="num">金额</th><th>风险</th><th>当前节点</th><th></th></tr></thead>
        <tbody>${waiting.length ? waiting.map(row).join('') : emptyRow(8, '没有正在流转中的单据', '待你审批之外的流程会显示在这里')}</tbody>
      </table>
    </div>
  </div>`;
};

/* ---------- 我的单据 ---------- */
Views['flow-my'] = function(){
  /* 列表按角色收口到本人/本店范围，与详情页、菜单口径一致；
     否则员工会在「我的单据」里看到全集团 13 张单，权限越界 */
  const list = State.docs.filter(d => inScope(d));
  const rows = list.map(d => {
    const s = storeById(d.storeId);
    return `<tr onclick="App.openDoc('${d.id}')" style="cursor:pointer">
      <td><div class="strong">${d.id}</div><div class="fs11 c3">${d.title}</div></td>
      <td>${d.typeLabel}</td>
      <td>${s.name}</td>
      <td>${d.applicant}</td>
      <td class="num">${fmt(d.amount)}</td>
      <td>${d.submitDate}</td>
      <td>${statusTag(d.status)}</td>
      <td>${getFlow(d)[d.currentNode] ? getFlow(d)[d.currentNode].name : '已完成'}</td>
    </tr>`;
  }).join('');
  /* 员工只看到自己的单据，「你还没有提交过」比空表格更好懂 */
  const emptyText = State.role === 'staff' ? '你还没有提交过单据' : '当前范围内没有单据';

  return `<div class="card">
    <div class="card-head">
      <div class="card-title">全部单据<small>共 ${list.length} 张</small></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-primary" onclick="App.go('flow-exp')">+ 费用报销</button>
        <button class="btn btn-sm" onclick="App.newPayment()">+ 付款申请</button>
        ${exportBtn('flow-my')}
      </div>
    </div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>单据</th><th>类型</th><th>门店</th><th>申请人</th><th class="num">金额</th><th>提交时间</th><th>状态</th><th>当前节点</th></tr></thead>
        <tbody>${rows || emptyRow(8, emptyText, '可在「费用报销」「付款申请」发起')}</tbody>
      </table>
    </div>
  </div>
  <div class="notice notice-teal mt16">
    <div><b>全流程留痕：</b>每张单据的提交、每次审批、每次金额修改都会记录操作人、时间、改动前后值，不可删除。审计追溯时可按单据号、申请人、时间段检索。</div>
  </div>`;
};

/* ---------- 费用报销 ---------- */
Views['flow-exp'] = function(){
  const docs = State.docs.filter(d => d.type === 'expense' && inScope(d));
  const row = d => {
    const s = storeById(d.storeId);
    const hasBlock = d.risk && d.risk.some(r => r.level === 'block');
    return `<tr onclick="App.openDoc('${d.id}')" style="cursor:pointer">
      <td><div class="strong">${d.id}</div></td>
      <td>${d.title}</td><td>${s.name}</td><td>${d.applicant}</td>
      <td>${d.budgetItem}</td>
      <td class="num">${fmt(d.amount)}</td>
      <td>${hasBlock ? '<span class="tag tag-red">有阻断项</span>' : statusTag(d.status)}</td>
    </tr>`;
  };

  return `<div class="grid g-2-1">
    <div class="card">
      <div class="card-head"><div class="card-title">费用报销单<small>${docs.length} 张</small></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="App.newPayment()">+ 付款申请</button>
          <button class="btn btn-sm btn-primary" onclick="App.newExpense()">+ 新建报销单</button>
        </div></div>
      <div class="card-body tight">
        <table class="table">
          <thead><tr><th>单据号</th><th>事由</th><th>门店</th><th>报销人</th><th>预算项</th><th class="num">金额</th><th>状态</th></tr></thead>
          <tbody>${docs.length ? docs.map(row).join('') : emptyRow(7, '当前范围没有费用报销单', '点右上角「新建报销单」发起')}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">报销规则（系统内置校验）</div></div>
      <div class="card-body" style="font-size:12px;line-height:1.85;color:var(--text-2)">
        <div class="stat-line"><span>单据归属主体</span><b>自动锁定，不可手改</b></div>
        <div class="stat-line"><span>发票抬头</span><b>须等于归属主体税号</b></div>
        <div class="stat-line"><span>发票查重</span><b>集团 14 家统一索引</b></div>
        <div class="stat-line"><span>预算校验</span><b>提交时实时校验</b></div>
        <div class="stat-line"><span>拆单识别</span><b>7 日内同类合并判定</b></div>
        <div class="stat-line"><span>金额指纹</span><b>付款前二次比对</b></div>
        <div class="notice notice-amber mt12" style="font-size:11.5px">
          提交时若有<b>阻断级</b>问题，单据可以保存草稿但不能进入审批流。这是为了防止"先提交、后补票"。
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------- 付款申请 / 出纳工作台 ---------- */
Views['flow-pay'] = function(){
  if (State.role === 'cashier') return cashierDesk();
  const docs = State.docs.filter(d => d.type === 'payment' && inScope(d));
  const rows = docs.map(d => {
    const s = storeById(d.storeId);
    return `<tr onclick="App.openDoc('${d.id}')" style="cursor:pointer">
      <td><div class="strong">${d.id}</div><div class="fs11 c3">${d.title}</div></td>
      <td>${s.name}<div class="fs11 c3">${s.entityName.slice(0,12)}…</div></td>
      <td>${e(d.payee || '—')}<div class="fs11 c3">${e(d.payBank || '')}</div></td>
      <td class="num">${fmt(d.amount)}</td>
      <td>${d.status === 'paid' && !d.receipt ? '<span class="tag tag-amber">待补回单</span>' : statusTag(d.status)}</td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-head">
      <div class="card-title">付款申请单<small>按纳税主体隔离，不可跨主体合并支付</small></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" onclick="App.newExpense()">+ 费用报销</button>
        <button class="btn btn-sm btn-primary" onclick="App.newPayment()">+ 新建付款申请</button>
      </div>
    </div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>单据号 / 事由</th><th>付款主体</th><th>收款方 / 开户行</th><th class="num">金额</th><th>状态</th></tr></thead>
        <tbody>${rows || emptyRow(5, '暂无付款申请', '点右上角「新建付款申请」发起')}</tbody>
      </table>
    </div>
  </div>
  <div class="notice notice-red mt16">
    <div><b>付款三条铁律：</b>① 付款账户必须属于单据归属主体；② 收款账户必须与供应商主数据一致，变更需双人复核并用预留电话回拨；③ 付款前重算金额指纹，与审批时不一致直接阻断。</div>
  </div>`;
};

function cashierDesk(){
  const payable = State.docs.filter(d => d.status === 'approved');
  const groups = {};
  payable.forEach(d => { (groups[d.storeId] = groups[d.storeId] || []).push(d); });

  const groupHtml = Object.keys(groups).map(sid => {
    const s = storeById(sid);
    const list = groups[sid];
    const total = list.reduce((a, b) => a + b.amount, 0);
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-head">
        <div class="card-title">${s.entityName}<small>税号 ${s.taxNo}</small></div>
        <span class="tag tag-blue">本组合计 ¥${fmt(total)}</span>
      </div>
      <div class="card-body tight">
        <table class="table">
          <thead><tr><th style="width:34px"></th><th>单据号</th><th>收款方</th><th>收款账户</th><th class="num">金额</th><th>指纹</th></tr></thead>
          <tbody>${list.map(d => `<tr>
            <td><input type="checkbox" class="pay-chk" data-id="${d.id}" data-store="${sid}" data-amt="${d.amount}" onchange="App.recalcPay()"></td>
            <td><div class="strong">${d.id}</div><div class="fs11 c3">${d.title}</div></td>
            <td>${d.payee || '—'}</td>
            <td class="fs11">${d.payeeAccount || '—'}</td>
            <td class="num">${fmt(d.amount)}</td>
            <td><span class="tag tag-teal">${fingerprint(d)}</span></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  return `<div class="notice notice-amber" style="margin-bottom:14px;align-items:center">
    <div style="flex:1"><b>出纳付款工作台 · 按主体分组。</b>14 家是独立法人，每个主体的款项必须从该主体自己的账户付出。<b>不允许跨主体勾选批量付款</b>——这是资金隔离的硬约束，也是税务上"四流一致"的要求。</div>
    <button class="btn btn-sm btn-primary" style="flex:0 0 auto" onclick="App.newPayment()">+ 新建付款申请</button>
  </div>
  ${payable.length ? groupHtml : '<div class="card"><div class="card-body" style="padding:32px;text-align:center;color:var(--text-3)">当前没有待付款单据</div></div>'}
  <div class="card" style="position:sticky;bottom:0">
    <div class="card-body" style="display:flex;align-items:center;justify-content:space-between">
      <div class="fs12">已选 <b id="payCount">0</b> 张，合计 <b id="payTotal">¥0.00</b>
        <span class="fs11 c3" style="margin-left:10px">（同一主体内可批量）</span></div>
      <button class="btn btn-primary" onclick="App.doPay()">确认付款</button>
    </div>
  </div>`;
}

/* 收款方开户行反查（存量单据没有 payBank 字段时按主数据补齐） */
function bankOf(payee){
  const a = PAYEE_ACCOUNTS.find(x => x.payee === payee) || MY_ACCOUNTS.find(x => x.payee === payee);
  return a ? a.bank : '—';
}

/* ---------- 单据详情弹窗 ---------- */
function openDoc(id){
  const d = docById(id);
  if (!d) return;
  const s = storeById(d.storeId);
  const flow = getFlow(d);
  const node = flow[d.currentNode];
  const bud = budgetFor(d.budgetItem);
  const available = bud.budget - bud.used - bud.inTrans;
  const over = d.amount > available;

  const lines = (d.lines || []).map(l => `<tr>
    <td>${e(l.item)}</td><td class="num">${l.qty}</td><td class="num">${fmt(l.price)}</td>
    <td class="num">${pct(l.taxRate, 0)}</td><td class="num">${fmt(l.amount)}</td></tr>`).join('');

  const invs = (d.invoices || []).map(iv => {
    const dup = INVOICES.find(x => x.code === iv.code && x.no === iv.no && x.status === 'dup');
    const isDup = !!dup;
    return `<tr>
      <td>${iv.code}</td><td>${iv.no}</td><td>${e(iv.seller)}</td>
      <td class="num">${fmt(iv.amount)}</td>
      <td>${isDup ? '<span class="tag tag-red">查重命中</span>' : '<span class="tag tag-teal">已验真</span>'}</td>
    </tr>`;
  }).join('');

  const canAct = d.status === 'pending' && (canApprove(d, State.role) || State.role === 'cfo');
  const isCashierNode = d.status === 'approved' && State.role === 'cashier';

  const actions = canAct
    ? `<button class="btn btn-danger" onclick="App.rejectDoc('${d.id}')">驳回</button>
       <button class="btn" onclick="App.closeModal()">稍后处理</button>
       <button class="btn btn-primary" onclick="App.approveDoc('${d.id}')">审批通过</button>`
    : isCashierNode
    ? `<button class="btn btn-primary" onclick="App.payOne('${d.id}')">确认付款</button>`
    : `<button class="btn" onclick="App.closeModal()">关闭</button>`;

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">${d.id} · ${d.typeLabel}</div>
        <div class="modal-sub">${e(d.title)} · ${s.name} · 提交于 ${d.submitDate}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${statusTag(d.status)}
        <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
      </div>
    </div>
    <div class="modal-body">

      <div class="notice notice-blue" style="margin-bottom:14px;font-size:11.5px">
        <div><b>归属主体：${s.entityName}</b>　税号 ${s.taxNo}　${s.vatLabel}<br>
        主体由申请人所属单位自动锁定，<b>不可手动更改</b>。发票抬头、付款账户、合同主体必须与之一致。</div>
      </div>

      <div class="flow" style="margin-bottom:6px">${flowBar(d).replace(/^<div class="flow">|<\/div>$/g, '')}</div>
      <div class="fs11 c3" style="text-align:center;margin-bottom:16px">${node ? '当前节点：' + node.name + '（' + node.who + '）' : '流程已完成'}</div>

      ${riskBlocks(d)}

      <div class="section-title">单据信息</div>
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <tbody>
          <tr><td class="muted" style="width:110px">申请人 / 部门</td><td>${d.applicant} · ${d.dept}</td>
              <td class="muted" style="width:110px">预算项目</td><td>${d.budgetItem}</td></tr>
          <tr><td class="muted">金额（价税合计）</td><td class="strong">¥${fmt(d.amount)}</td>
              <td class="muted">其中税额</td><td>¥${fmt(d.taxAmount)}</td></tr>
          ${d.payee ? `<tr><td class="muted">收款方</td><td>${e(d.payee)}</td>
              <td class="muted">开户行</td><td>${e(d.payBank || bankOf(d.payee))}</td></tr>
          <tr><td class="muted">收款账号</td><td class="fs11">${e(d.payeeAccount || '—')}</td>
              <td class="muted">付款类型</td><td>${d.payType || '—'}</td></tr>` : ''}
          <tr><td class="muted">事由说明</td><td colspan="3">${e(d.note) || '—'}</td></tr>
        </tbody>
      </table>

      <div class="section-title">明细</div>
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <thead><tr><th>项目</th><th class="num">数量</th><th class="num">单价</th><th class="num">税率</th><th class="num">金额</th></tr></thead>
        <tbody>${lines}</tbody>
        <tfoot><tr class="row-total"><td colspan="4">合计</td><td class="num">${fmt(d.amount)}</td></tr></tfoot>
      </table>

      <div class="section-title">发票</div>
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <thead><tr><th>发票代码</th><th>号码</th><th>销售方</th><th class="num">金额</th><th>状态</th></tr></thead>
        <tbody>${invs || '<tr><td colspan="5" class="muted" style="text-align:center;padding:14px">无发票（需说明原因）</td></tr>'}</tbody>
      </table>

      <div class="section-title">其他附件<small style="font-weight:400;color:var(--text-3);margin-left:7px">非发票材料 · ${(d.attach || []).length} 个</small></div>
      <div style="border:1px solid var(--line);border-radius:8px;padding:10px">
        ${attachList(d.attach, null, d.id)}
      </div>

      ${d.status === 'paid' ? `
      <div class="section-title">银行回单</div>
      ${d.receipt
        ? `<div class="attach-item">
             <span class="tag tag-teal">回单</span>
             <span class="attach-name open" title="点击预览" onclick="App.openReceiptView('${d.id}')">${e(d.receipt.name)}</span>
             <span class="attach-size">${d.receipt.size || ''}</span>
             <span class="attach-by">${e(d.receipt.by || '')} · ${d.receipt.time || ''}</span>
             <button class="attach-view" title="预览" onclick="App.openReceiptView('${d.id}')">预览</button>
           </div>
           <div class="fs11 c3" style="margin-top:6px">回单流水号 ${e(d.receipt.serial || '—')} · 付款账户 ${e(d.receipt.from || '—')}</div>`
        : `<div class="notice notice-red" style="align-items:center">
             <div style="flex:1"><b>缺少银行回单。</b>付款已完成但回单未归档，月末关账检查会标记该笔。回单是「资金实际流出」的唯一凭证，没有它付款记录与银行流水无法勾稽。</div>
             ${['cashier','hqfin','cfo'].includes(State.role) ? `<button class="btn btn-sm btn-primary" style="flex:0 0 auto" onclick="App.openReceipt('${d.id}')">上传回单</button>` : ''}
           </div>`}
      ` : ''}

      <div class="section-title">预算校验</div>
      <div class="grid g-6" style="gap:8px">
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label">预算</div><div class="kpi-value" style="font-size:15px">${wan(bud.budget)}<small>万</small></div></div>
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label">已用</div><div class="kpi-value" style="font-size:15px">${wan(bud.used)}<small>万</small></div></div>
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label">在途</div><div class="kpi-value" style="font-size:15px">${wan(bud.inTrans)}<small>万</small></div></div>
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label">可用</div><div class="kpi-value" style="font-size:15px" class="c">${wan(available)}<small>万</small></div></div>
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label">本次申请</div><div class="kpi-value" style="font-size:15px">${fmt(d.amount)}</div></div>
        <div class="kpi" style="padding:10px 12px;border-color:${over ? 'var(--red-100)' : 'var(--line)'}">
          <div class="kpi-label">校验结果</div>
          <div class="kpi-value" style="font-size:14px;color:${over ? 'var(--red-600)' : 'var(--teal-600)'}">${over ? '超出 ¥' + fmt(d.amount - available) : '在预算内'}</div>
        </div>
      </div>
      ${over ? `<div class="notice notice-amber mt12" style="font-size:11.5px"><div>本次申请超出可用预算。按规则，<b>超预算需增加一级审批</b>（门店财务 → 总部财务 → 财务总监），并需填写超支原因。</div></div>` : ''}

      <div class="section-title">操作留痕</div>
      <div class="timeline">
        <div class="tl-item ok"><div class="tl-main">提交申请 · ${d.applicant}</div><div class="tl-sub">${d.submitDate}</div></div>
        ${(d.log || []).map(l => `<div class="tl-item ok"><div class="tl-main">${l.act} · ${l.by}</div><div class="tl-sub">${l.node} · ${l.time}</div></div>`).join('')}
        ${d.status === 'pending' && node ? `<div class="tl-item now"><div class="tl-main">等待 ${node.name} · ${node.who}</div><div class="tl-sub">已超过 24 小时将自动提醒，超过 48 小时升级至上级</div></div>` : ''}
        ${d.status === 'approved' ? `<div class="tl-item now"><div class="tl-main">已审批通过，等待出纳付款</div><div class="tl-sub">金额指纹 ${fingerprint(d)} · 付款前将重新比对</div></div>` : ''}
        ${d.status === 'rejected' ? `<div class="tl-item"><div class="tl-main" style="color:var(--red-600)">已驳回，退回申请人修改</div></div>` : ''}
      </div>

    </div>
    <div class="modal-foot">${actions}</div>`;

  openModal(html, true);
}

/* ---------- 付款计算 ---------- */
function recalcPay(){
  const chks = Array.from(document.querySelectorAll('.pay-chk')).filter(c => c.checked);
  const stores = new Set(chks.map(c => c.dataset.store));
  if (stores.size > 1){
    toast('不能跨主体批量付款。请分别选择同一主体的单据。', 'err');
    chks.forEach(c => { if (c.dataset.store !== chks[0].dataset.store) c.checked = false; });
    return recalcPay();
  }
  const total = chks.reduce((a, c) => a + parseFloat(c.dataset.amt), 0);
  const c = document.getElementById('payCount'), t = document.getElementById('payTotal');
  if (c) c.textContent = chks.length;
  if (t) t.textContent = '¥' + fmt(total);
}

function doPay(){
  const chks = Array.from(document.querySelectorAll('.pay-chk')).filter(c => c.checked);
  if (!chks.length){ toast('请先勾选要付款的单据'); return; }
  const ids = chks.map(c => c.dataset.id);
  ids.forEach(id => { const d = docById(id); if (d){ d.status = 'paid'; } });
  saveState(); render();
  openReceiptModal(ids, true);
  toast(`已完成 ${ids.length} 笔付款，金额指纹校验一致，请上传银行回单`, 'ok');
}

function payOne(id){
  const d = docById(id);
  if (!d) return;
  d.status = 'paid'; saveState(); closeModal(); render();
  openReceiptModal([id], false);
}

/* ================= 新建单据：费用报销 / 付款申请 =================
   两条表单共用同一套组件：费用项目（一级大类 + 二级明细）、收款账户（含开户行）、非发票附件。
   区别：报销默认打给本人账户；付款申请打给供应商，账户必须与主数据一致。 */

/* ---------- 公共：费用项目联动 ---------- */
function groupOptions(selected){
  return EXPENSE_TREE.map(g => `<option ${g.group === selected ? 'selected' : ''}>${g.group}</option>`).join('');
}
function itemOptions(group, selected){
  const g = EXPENSE_TREE.find(x => x.group === group) || EXPENSE_TREE[0];
  return g.items.map(it => `<option ${it.name === selected ? 'selected' : ''}>${it.name}</option>`).join('');
}
function onGroupChange(prefix){
  const gSel = document.getElementById(prefix + 'Group');
  const iSel = document.getElementById(prefix + 'Item');
  if (!gSel || !iSel) return;
  iSel.innerHTML = itemOptions(gSel.value);
  if (prefix === 'exp') simulateCheck(); else simulatePayCheck();
}

/* ---------- 公共：附件上传 ---------- */
function pickAttach(input, target){
  const files = input && input.files ? Array.from(input.files) : [];
  const list = target === 'form' ? State.formAttach : [];
  files.forEach(f => {
    list.push({ name:f.name, size:fileSize(f.size), kind:fileKind(f.name), by:ROLES[State.role].name, time:nowStr().slice(5) });
  });
  if (target === 'form') State.formAttach = list;
  refreshAttachBox(target);
  input.value = '';
  if (files.length) toast(`已添加 ${files.length} 个附件`);
}
function mockAttach(target){
  const samples = [
    { name:'验收单-GRN20261021.pdf', size:'318 KB', kind:'pdf' },
    { name:'现场照片-01.jpg', size:'1.4 MB', kind:'img' },
    { name:'供应商对账单-10月.xlsx', size:'86 KB', kind:'xls' }
  ];
  const seed = State.formAttach.length;
  const s = samples[seed % samples.length];
  State.formAttach.push({ name:s.name, size:s.size, kind:s.kind, by:ROLES[State.role].name, time:nowStr().slice(5) });
  refreshAttachBox(target || 'form');
  toast('已模拟上传 1 个附件（演示用，未真正传文件）');
}
function removeAttach(scope, idx){
  if (scope === 'form') State.formAttach.splice(idx, 1);
  refreshAttachBox('form');
}
function refreshAttachBox(target){
  const box = document.getElementById('attachList');
  if (box) box.innerHTML = attachList(State.formAttach, 'form', '__form__');
  /* 付款申请要求至少一个附件，附件变化后需重算提示 */
  if (document.getElementById('payCheck')) simulatePayCheck();
}

/* ---------- 公共：收款账户 ---------- */
function accountCards(prefix, accounts, selectedId){
  return `<div class="acct-list">${accounts.map((a, i) => `
    <div class="acct ${a.id === selectedId ? 'on' : ''}" onclick="App.useAcct('${prefix}',${i})">
      <div class="a-bank">${e(a.bank)}</div>
      <div class="a-no">${e(a.account)}</div>
      <div class="a-meta">${e(a.payee)} · 上次使用 ${a.last} · 已用 ${a.times} 次</div>
    </div>`).join('')}</div>`;
}
function useAcct(prefix, idx){
  const role = State.role;
  const pool = prefix === 'exp' ? MY_ACCOUNTS : PAYEE_ACCOUNTS;
  const a = pool[idx];
  if (!a) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set(prefix + 'Payee', a.payee);
  set(prefix + 'Bank', a.bank);
  set(prefix + 'Account', a.account);
  document.querySelectorAll('.acct').forEach(el => el.classList.remove('on'));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('on');
  toast(`已套用「${a.bank}」的账户信息`);
}

/* ---------- 新建费用报销 ---------- */
/* 明细行默认值：一行便于用户直接改数量单价，不必从零录 */
function defaultLines(){
  return [{ item:'', qty:1, price:0 }];
}

function newExpense(){
  const s = storeById(State.storeId);
  State.formAttach = [];
  State.formInvoices = [];
  State.formLines = defaultLines();
  const last = State.lastAccount || MY_ACCOUNTS[0];
  const g0 = EXPENSE_TREE[0];

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">新建费用报销单</div>
      <div class="modal-sub">归属主体自动锁定为「${s.entityName}」</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <div class="notice notice-blue" style="margin-bottom:14px;font-size:11.5px">
        <div>当前主体：<b>${s.entityName}</b> · 税号 ${s.taxNo}。发票抬头、收款账户必须与此主体一致，否则无法提交。</div>
      </div>

      <div class="form-row">
        <div class="form-item"><label>门店</label><input class="input" value="${s.name}" disabled></div>
        <div class="form-item"><label>报销人</label><input class="input" value="陈晓燕" id="expPerson"></div>
        <div class="form-item"><label>部门</label><input class="input" value="客房部" id="expDept"></div>
      </div>

      <div class="form-row">
        <div class="form-item"><label>费用大类 <span class="req">*</span></label>
          <select class="input" id="expGroup" onchange="App.onGroupChange('exp')">${groupOptions(g0.group)}</select></div>
        <div class="form-item"><label>费用明细 <span class="req">*</span></label>
          <select class="input" id="expItem" onchange="App.simulateCheck()">${itemOptions(g0.group)}</select></div>
        <div class="form-item"><label>事由</label>
          <input class="input" id="expNote" value="9月客房补充采购"></div>
      </div>

      <div class="section-title">费用明细<small style="font-weight:400;color:var(--text-3);margin-left:7px">数量 × 单价自动合计，与发票金额核对</small></div>
      <div id="lineBox">${linesBox()}</div>

      <div class="section-title">发票<small style="font-weight:400;color:var(--text-3);margin-left:7px">从发票池勾选，或在下方补录新票</small></div>
      <div id="invBox">${invoicePicker()}</div>
      <div class="upload-zone" style="margin-top:8px">
        <div class="u-main">上传发票照片或 PDF，系统自动 OCR 识别并做集团范围查重</div>
        支持 JPG / PNG / PDF，单张不超过 10MB<br>
        <button class="btn btn-sm mt8" onclick="App.simulateDup()">演示：上传一张已报销过的发票</button>
      </div>

      <div class="section-title">其他附件<small style="font-weight:400;color:var(--text-3);margin-left:7px">非发票材料，作为报销依据</small></div>
      <div class="upload-zone">
        <input type="file" id="expFile" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onchange="App.pickAttach(this,'form')">
        <div class="u-main">合同、验收单、对账单、会议签到表、现场照片等</div>
        <b onclick="document.getElementById('expFile').click()">点击选择文件</b>
        <span style="color:var(--text-3)"> 或 </span>
        <b onclick="App.mockAttach('form')">模拟上传</b>
        <div style="margin-top:6px;font-size:10.5px">支持图片 / PDF / Word / Excel / 压缩包，单个不超过 20MB</div>
      </div>
      <div id="attachList" class="mt12">${attachList(State.formAttach, 'form', '__form__')}</div>

      <div class="section-title">收款信息<small style="font-weight:400;color:var(--text-3);margin-left:7px">款项将打入以下账户</small></div>
      <div class="acct-head">
        <span class="t">常用账户（点击套用）</span>
        <label class="check-line" style="margin:0"><input type="checkbox" id="expRemember" checked> 记住本次账户，下次自动带出</label>
      </div>
      ${accountCards('exp', MY_ACCOUNTS.filter(a => a.payee === '陈晓燕'), last.id)}
      <div class="form-row" style="margin-top:12px">
        <div class="form-item"><label>收款人 <span class="req">*</span></label>
          <input class="input" id="expPayee" value="${last.payee}"></div>
        <div class="form-item"><label>开户行 <span class="req">*</span></label>
          <input class="input" id="expBank" value="${last.bank}"></div>
        <div class="form-item"><label>银行账号 <span class="req">*</span></label>
          <input class="input" id="expAccount" value="${last.account}"></div>
      </div>

      <div id="expCheck" class="mt12"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="App.submitExpense()">提交审批</button>
    </div>`;
  openModal(html, true);
  simulateCheck();
}

/* ================= 多行明细 =================
   口径：明细合计是唯一金额来源，报错与预算校验都以它为准，避免"表头金额与明细对不上"。 */
function linesTotal(){
  return State.formLines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
}

function linesBox(){
  const rows = State.formLines.map((l, i) => {
    const amt = (Number(l.qty) || 0) * (Number(l.price) || 0);
    return `<tr>
      <td><input class="input input-sm" value="${e(l.item)}" placeholder="如：床单（1.8m）"
            oninput="App.editLine(${i},'item',this.value)"></td>
      <td style="width:78px"><input class="input input-sm num" value="${l.qty}"
            oninput="App.editLine(${i},'qty',this.value)"></td>
      <td style="width:96px"><input class="input input-sm num" value="${l.price}"
            oninput="App.editLine(${i},'price',this.value)"></td>
      <td style="width:94px;text-align:right" class="num">¥${fmt(amt)}</td>
      <td style="width:34px;text-align:center">
        ${State.formLines.length > 1 ? `<span class="line-del" onclick="App.delLine(${i})">×</span>` : ''}</td>
    </tr>`;
  }).join('');

  const total = linesTotal();
  const invTotal = State.formInvoices.reduce((a, v) => a + v.amount, 0);
  const diff = total - invTotal;
  const reconciled = !State.formInvoices.length || Math.abs(diff) < 0.01;

  return `
    <table class="line-table">
      <thead><tr>
        <th>项目</th><th>数量</th><th>单价</th><th style="text-align:right">金额</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="line-foot">
      <span class="line-add" onclick="App.addLine()">+ 添加一行</span>
      <span class="line-sum">合计 <b class="num">¥${fmt(total)}</b></span>
    </div>
    ${State.formInvoices.length ? `
      <div class="recon ${reconciled ? 'ok' : 'bad'}">
        发票合计 ¥${fmt(invTotal)} ·
        ${reconciled ? '与明细一致' : `与明细相差 ¥${fmt(diff)}（${diff > 0 ? '明细多于发票' : '发票多于明细'}，需说明原因）`}
      </div>` : ''}`;
}

function refreshLines(){
  const box = document.getElementById('lineBox');
  if (box) box.innerHTML = linesBox();
  simulateCheck();
}

function addLine(){
  State.formLines.push({ item:'', qty:1, price:0 });
  refreshLines();
  toast('已添加一行明细');
}

function delLine(idx){
  if (State.formLines.length <= 1) return;
  State.formLines.splice(idx, 1);
  refreshLines();
}

function editLine(idx, key, val){
  const l = State.formLines[idx];
  if (!l) return;
  l[key] = key === 'item' ? val : (parseFloat(val) || 0);
  refreshLines();
}

/* ================= 从发票池勾选 =================
   只列本主体、未使用的发票：跨主体不可用（抵扣按主体隔离），已使用不可再选（全局唯一索引）。 */
function invoicePicker(){
  const pool = INVOICES.filter(v => v.storeId === State.storeId && v.status === 'unused');
  const picked = State.formInvoices.map(v => v.id);

  const rows = pool.map(v => `
    <label class="inv-pick ${picked.indexOf(v.id) >= 0 ? 'on' : ''}">
      <input type="checkbox" ${picked.indexOf(v.id) >= 0 ? 'checked' : ''}
             onchange="App.pickInvoice('${v.id}',this.checked)">
      <span class="ip-main">
        <span class="ip-top">
          <b>${v.seller}</b>
          <span class="num ip-amt">¥${fmt(v.amount)}</span>
        </span>
        <span class="ip-meta num">${v.code} · ${v.no} · ${v.date} · ${v.type}</span>
        <span class="ip-tag">
          <span class="tag ${v.deduct === 'yes' ? 'tag-teal' : 'tag-amber'}">${v.deduct === 'yes' ? '可抵扣' : '不可抵扣'}</span>
          <span class="tag tag-gray">${v.category}</span>
        </span>
      </span>
    </label>`).join('');

  const others = INVOICES.filter(v => v.storeId !== State.storeId && v.status === 'unused').length;

  return `
    <div class="inv-head">
      <span>本主体未使用发票 <b>${pool.length}</b> 张</span>
      ${others ? `<span class="ip-aux">另有 ${others} 张属于其他主体，本单不可选（抵扣按主体隔离）</span>` : ''}
    </div>
    ${pool.length ? `<div class="inv-list">${rows}</div>` : emptyState({ title:'本主体暂无未使用发票', desc:'可在下方上传新票，识别确认后即可勾选' })}`;
}

function pickInvoice(id, on){
  const v = INVOICES.find(x => x.id === id);
  if (!v) return;
  if (on){
    if (State.formInvoices.some(x => x.id === id)) return;
    State.formInvoices.push(v);
  } else {
    State.formInvoices = State.formInvoices.filter(x => x.id !== id);
  }
  const box = document.getElementById('invBox');
  if (box) box.innerHTML = invoicePicker();
  refreshLines();
  toast(on ? `已勾选 ${v.seller} 的发票（¥${fmt(v.amount)}）` : '已取消勾选');
}

function simulateCheck(){
  const itemEl = document.getElementById('expItem');
  if (!itemEl) return;
  const amt = linesTotal();
  const item = itemEl.value;
  const bud = budgetFor(item);
  const avail = bud.budget - bud.used - bud.inTrans;
  const el = document.getElementById('expCheck');
  if (!el) return;
  let html = '';
  if (amt > 3000 && amt < 3300){
    html += `<div class="notice notice-amber" style="margin-bottom:8px"><div><b>疑似拆单提示：</b>本单金额 ¥${fmt(amt)} 略低于 ¥3,000 审批档位边界。系统检测到你在 7 日内另有 2 笔同类费用，合并金额将跨越档位，本单将按合并金额走高一级审批。</div></div>`;
  }
  if (amt > avail){
    html += `<div class="notice notice-red"><div><b>预算不足：</b>「${item}」（预算项 ${bud.item}）可用 ¥${fmt(avail)}，本单 ¥${fmt(amt)}，超出 ¥${fmt(amt - avail)}。提交后将强制增加一级审批，并需填写超支原因。</div></div>`;
  }
  if (!html) html = `<div class="notice notice-teal"><div>校验通过：费用明细「${item}」归集至预算项「${bud.item}」，可用 ¥${fmt(avail)}，发票抬头匹配、未发现拆单与查重风险。</div></div>`;
  el.innerHTML = html;
}

function simulateDup(){
  const el = document.getElementById('expCheck');
  if (!el) return;
  el.innerHTML = `<div class="notice notice-red">
    <div>
      <b>该发票已存在，无法重复报销</b><br>
      <span style="font-size:11.5px">
      发票号码 88451206（代码 032002100311）<br>
      已于 <b>2026-10-16</b> 在 <b>城东店</b> 使用<br>
      单据号 <b>BX2026100012</b> · 经办人 陈晓燕 · 状态 已入账 · 凭证 记-2026-09-0421
      </span>
    </div>
  </div>
  <div class="notice notice-blue mt8" style="font-size:11.5px">
    <div>为什么会被拦截：同一张发票在集团 14 家范围内只能报销一次。系统按「发票代码 + 号码」建立全局唯一索引，跨门店、跨时间均可识别。<br>
    <span style="color:var(--blue-600);cursor:pointer">我要申诉（转总部财务裁定）</span></div>
  </div>`;
}

function submitExpense(){
  const amt = linesTotal();
  const item = document.getElementById('expItem').value;
  const group = document.getElementById('expGroup').value;
  const note = document.getElementById('expNote').value;
  const payee = document.getElementById('expPayee').value.trim();
  const bank = document.getElementById('expBank').value.trim();
  const account = document.getElementById('expAccount').value.trim();
  const remember = document.getElementById('expRemember').checked;
  const s = storeById(State.storeId);

  if (!amt){ toast('请填写费用明细的数量与单价', 'err'); return; }
  const blank = State.formLines.find(l => !String(l.item).trim());
  if (blank){ toast('明细行需填写项目名称', 'err'); return; }
  if (!bank || !account){ toast('请填写开户行与银行账号，否则无法打款', 'err'); return; }

  if (remember){
    State.lastAccount = { payee, bank, account, id:'LAST' };
    saveState();
  }

  /* 明细行落库（含金额与税率），发票按勾选结果落库 */
  const lines = State.formLines.map(l => ({
    item: l.item,
    qty: Number(l.qty) || 0,
    price: Number(l.price) || 0,
    amount: (Number(l.qty) || 0) * (Number(l.price) || 0),
    taxRate: .13
  }));
  const pickedInv = State.formInvoices.map(v => ({
    code: v.code, no: v.no, amount: v.amount, seller: v.seller
  }));
  const taxAmount = State.formInvoices.length
    ? State.formInvoices.reduce((a, v) => a + v.tax, 0)
    : Math.round(amt / 1.13 * .13 * 100) / 100;

  /* 勾选的发票转为已用，防止二次报销（全局唯一索引） */
  State.formInvoices.forEach(v => {
    const pool = INVOICES.find(x => x.id === v.id);
    if (pool) pool.status = 'used';
  });

  const risk = [];
  const bud = budgetFor(item);
  const avail = bud.budget - bud.used - bud.inTrans;
  if (amt > avail){
    risk.push({ level:'warn', code:'B1',
      text:`超出「${bud.item}」可用预算 ¥${fmt(amt - avail)}，需增加一级审批` });
  }
  const invTotal = State.formInvoices.reduce((a, v) => a + v.amount, 0);
  if (State.formInvoices.length && Math.abs(invTotal - amt) >= 0.01){
    risk.push({ level:'warn', code:'V2',
      text:`发票合计 ¥${fmt(invTotal)} 与明细合计 ¥${fmt(amt)} 不一致，差额 ¥${fmt(amt - invTotal)}，需在审批时说明原因` });
  }

  const id = 'BX2026100' + String(30 + State.docs.length);
  State.docs.unshift({
    id, type:'expense', typeLabel:'费用报销', storeId:s.id,
    applicant:'陈晓燕', dept:document.getElementById('expDept').value, title:note || '费用报销',
    amount:amt, taxAmount:taxAmount,
    submitDate: nowStr(), budgetItem:item, budgetGroup:group, status:'pending', currentNode:0,
    payee, payBank:bank, payeeAccount:account, payType:'员工报销',
    invoices:pickedInv, lines:lines,
    attach:State.formAttach.slice(),
    note:'', risk:risk, log:[]
  });
  const attachCount = State.formAttach.length;
  const invCount = pickedInv.length;
  State.formAttach = [];
  State.formInvoices = [];
  saveState(); closeModal(); render();
  toast(`单据已提交，已推送至门店店长审批${invCount ? '（' + invCount + ' 张发票）' : ''}${attachCount ? '（' + attachCount + ' 个附件）' : ''}`, 'ok');
}

/* ---------- 新建付款申请 ---------- */
function newPayment(){
  const role = State.role;
  const s = storeById(State.storeId);
  const lockedStore = ['manager','storefin','staff'].includes(role);
  const storeOptions = (lockedStore ? [s] : STORES)
    .map(x => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${x.name} · ${x.entityName}</option>`).join('');
  State.formAttach = [];
  State.formInvoices = [];
  State.formLines = defaultLines();
  const g0 = EXPENSE_TREE[0];
  const pt = PAY_TYPES[0];

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">新建付款申请</div>
      <div class="modal-sub">付款主体决定从哪个银行账户出款，一经提交不可更改</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <div class="notice notice-blue" style="margin-bottom:14px;font-size:11.5px">
        <div><b>付款主体即出款主体。</b>门店无付款权限，单据审批完成后由总部出纳代该主体账户付款；<b>严禁跨主体合并支付</b>，否则银行流水与账套无法对应，增值税「四流一致」也会失守。</div>
      </div>

      <div class="form-row">
        <div class="form-item" style="flex:1.4"><label>付款主体 <span class="req">*</span></label>
          <select class="input" id="payStore" ${lockedStore ? 'disabled' : ''}>${storeOptions}</select></div>
        <div class="form-item"><label>付款类型 <span class="req">*</span></label>
          <select class="input" id="payType" onchange="App.simulatePayCheck()">
            ${PAY_TYPES.map(x => `<option>${x.name}</option>`).join('')}
          </select></div>
        <div class="form-item"><label>期望付款日</label>
          <input class="input" type="date" id="payDate" value="2026-10-25"></div>
      </div>

      <div class="form-row">
        <div class="form-item"><label>费用大类 <span class="req">*</span></label>
          <select class="input" id="payGroup" onchange="App.onGroupChange('pay')">${groupOptions(g0.group)}</select></div>
        <div class="form-item"><label>费用明细 <span class="req">*</span></label>
          <select class="input" id="payItem" onchange="App.simulatePayCheck()">${itemOptions(g0.group)}</select></div>
        <div class="form-item"><label>付款事由</label>
          <input class="input" id="payNote" value="10 月客房易耗品货款（第四批）"></div>
      </div>

      <div class="section-title">费用明细<small style="font-weight:400;color:var(--text-3);margin-left:7px">数量 × 单价自动合计，合计即付款金额</small></div>
      <div id="lineBox">${linesBox()}</div>

      <div class="section-title">发票<small style="font-weight:400;color:var(--text-3);margin-left:7px">从发票池勾选，用于三单匹配</small></div>
      <div id="invBox">${invoicePicker()}</div>

      <div class="section-title">收款信息<small style="font-weight:400;color:var(--text-3);margin-left:7px">须与供应商主数据一致</small></div>
      <div class="acct-head">
        <span class="t">从主数据选择收款方（点击套用开户行与账号）</span>
        <span class="fs11 c3">变更账户需双人复核 + 预留电话回拨</span>
      </div>
      ${accountCards('pay', PAYEE_ACCOUNTS, PAYEE_ACCOUNTS[0].id)}
      <div class="form-row" style="margin-top:12px">
        <div class="form-item"><label>收款方 <span class="req">*</span></label>
          <input class="input" id="payPayee" value="${PAYEE_ACCOUNTS[0].payee}" oninput="App.simulatePayCheck()"></div>
        <div class="form-item"><label>开户行 <span class="req">*</span></label>
          <input class="input" id="payBank" value="${PAYEE_ACCOUNTS[0].bank}" oninput="App.simulatePayCheck()"></div>
        <div class="form-item"><label>银行账号 <span class="req">*</span></label>
          <input class="input" id="payAccount" value="${PAYEE_ACCOUNTS[0].account}" oninput="App.simulatePayCheck()"></div>
      </div>

      <div class="section-title">附件<small style="font-weight:400;color:var(--text-3);margin-left:7px">合同 / 验收单 / 对账单</small></div>
      <div class="upload-zone">
        <input type="file" id="payFile" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onchange="App.pickAttach(this,'form')">
        <div class="u-main">${pt.needGrn ? '本付款类型需合同 + 验收单 + 发票三单匹配' : pt.note}</div>
        <b onclick="document.getElementById('payFile').click()">点击选择文件</b>
        <span style="color:var(--text-3)"> 或 </span>
        <b onclick="App.mockAttach('form')">模拟上传</b>
      </div>
      <div id="attachList" class="mt12">${attachList(State.formAttach, 'form', '__form__')}</div>

      <div id="payCheck" class="mt12"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="App.submitPayment()">提交审批</button>
    </div>`;
  openModal(html, true);
  simulatePayCheck();
}

function simulatePayCheck(){
  const itemEl = document.getElementById('payItem');
  if (!itemEl) return;
  const amt = linesTotal();
  const item = itemEl.value;
  const typeName = document.getElementById('payType').value;
  const type = PAY_TYPES.find(t => t.name === typeName) || PAY_TYPES[0];
  const sid = document.getElementById('payStore').value;
  const s = storeById(sid);
  const bud = budgetFor(item);
  const avail = bud.budget - bud.used - bud.inTrans;
  const payee = document.getElementById('payPayee').value.trim();
  const bank = document.getElementById('payBank').value.trim();
  const account = document.getElementById('payAccount').value.trim();
  const master = PAYEE_ACCOUNTS.find(a => a.payee === payee);
  const acctMatch = master && master.bank === bank && master.account === account;

  let html = '';
  if (amt > avail){
    html += `<div class="notice notice-red" style="margin-bottom:8px"><div><b>预算不足：</b>「${item}」对应预算项「${bud.item}」可用 ¥${fmt(avail)}，本单 ¥${fmt(amt)}，超出 ¥${fmt(amt - avail)}。提交后强制增加一级审批。</div></div>`;
  }
  if (!master){
    html += `<div class="notice notice-amber" style="margin-bottom:8px"><div><b>新收款方：</b>「${payee}」不在供应商主数据中。首次付款需先建档（含营业执照、开户许可证），并完成账户验证后方可付款。</div></div>`;
  } else if (!acctMatch){
    html += `<div class="notice notice-amber" style="margin-bottom:8px"><div><b>账户与主数据不一致：</b>主数据登记为 ${master.bank} / ${master.account}。变更收款账户属高风险操作，需双人复核并用预留电话回拨确认，且付款需延后 1 个工作日（冷静期）。</div></div>`;
  }
  if (!html){
    html = `<div class="notice notice-teal"><div>校验通过：主体 <b>${s.name}</b>（${s.entityName}）· 预算项「${bud.item}」可用 ¥${fmt(avail)} · 收款账户与主数据一致 · 附件要求：${type.note}</div></div>`;
  }
  document.getElementById('payCheck').innerHTML = html;
}

function submitPayment(){
  const amt = linesTotal();
  const item = document.getElementById('payItem').value;
  const group = document.getElementById('payGroup').value;
  const typeName = document.getElementById('payType').value;
  const sid = document.getElementById('payStore').value;
  const payee = document.getElementById('payPayee').value.trim();
  const bank = document.getElementById('payBank').value.trim();
  const account = document.getElementById('payAccount').value.trim();
  const note = document.getElementById('payNote').value.trim();
  const payDate = document.getElementById('payDate').value;
  const s = storeById(sid);

  if (!amt){ toast('请填写付款金额', 'err'); return; }
  if (!payee || !bank || !account){ toast('收款方、开户行、账号均为必填', 'err'); return; }
  if (!State.formAttach.length){
    toast('请至少上传一个付款依据附件（合同 / 验收单 / 对账单）', 'err');
    return;
  }

  const master = PAYEE_ACCOUNTS.find(a => a.payee === payee);
  const risk = [];
  if (!master){
    risk.push({ level:'warn', code:'S1', text:'收款方不在供应商主数据中，首次付款需先建档并完成账户验证' });
  } else if (master.bank !== bank || master.account !== account){
    risk.push({ level:'warn', code:'S3', text:'收款账户与合同备案账户不一致，已触发供应商账户变更复核，需 T+1 冷静期后方可付款' });
  }
  const bud = budgetFor(item);
  const avail = bud.budget - bud.used - bud.inTrans;
  if (amt > avail){
    risk.push({ level:'warn', code:'B1', text:`超出「${bud.item}」可用预算 ¥${fmt(amt - avail)}，需增加一级审批` });
  }

  const lines = State.formLines.map(l => ({
    item: l.item,
    qty: Number(l.qty) || 0,
    price: Number(l.price) || 0,
    amount: (Number(l.qty) || 0) * (Number(l.price) || 0),
    taxRate: .06
  }));
  const pickedInv = State.formInvoices.map(v => ({
    code: v.code, no: v.no, amount: v.amount, seller: v.seller
  }));
  const taxAmount = State.formInvoices.length
    ? State.formInvoices.reduce((a, v) => a + v.tax, 0)
    : Math.round(amt / 1.06 * .06 * 100) / 100;
  const invTotal = State.formInvoices.reduce((a, v) => a + v.amount, 0);
  if (State.formInvoices.length && Math.abs(invTotal - amt) >= 0.01){
    risk.push({ level:'warn', code:'V2',
      text:`发票合计 ¥${fmt(invTotal)} 与明细合计 ¥${fmt(amt)} 不一致，差额 ¥${fmt(amt - invTotal)}，需在审批时说明原因` });
  }
  State.formInvoices.forEach(v => {
    const pool = INVOICES.find(x => x.id === v.id);
    if (pool) pool.status = 'used';
  });

  const id = 'FK2026100' + String(20 + State.docs.filter(d => d.type === 'payment').length);
  State.docs.unshift({
    id, type:'payment', typeLabel:'付款申请', storeId:s.id,
    applicant: ROLES[State.role].name === '门店员工' ? '陈晓燕' : '张伟',
    dept:'采购部', title:note || '付款申请',
    amount:amt, taxAmount:taxAmount,
    submitDate: nowStr(), budgetItem:item, budgetGroup:group,
    status:'pending', currentNode:0,
    payee, payBank:bank, payeeAccount:account, payType:typeName, expectPayDate:payDate,
    invoices:pickedInv, lines:lines,
    attach:State.formAttach.slice(), note:'', risk, log:[]
  });
  State.formAttach = [];
  State.formInvoices = [];
  saveState(); closeModal(); render();
  toast('付款申请已提交，已推送至门店店长审批', 'ok');
}

/* ================= 银行回单 ================= */
function openReceiptModal(ids, batch){
  State.receiptTargets = ids.slice();
  State.formReceipt = [];
  const total = ids.reduce((a, id) => { const d = docById(id); return a + (d ? d.amount : 0); }, 0);
  const first = docById(ids[0]);
  const s = first ? storeById(first.storeId) : STORES[0];

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">上传银行回单</div>
      <div class="modal-sub">${batch ? `${ids.length} 笔付款已提交银行` : (first ? first.id : '')} · 合计 ¥${fmt(total)}</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <div class="notice notice-amber" style="margin-bottom:14px;font-size:11.5px">
        <div><b>回单是「资金实际流出」的唯一凭证。</b>没有回单的付款，在月末关账检查中会被标为「付款与银行流水未勾稽」，并且无法生成银行付款凭证（借：应付 / 贷：银行存款）。</div>
      </div>

      <div class="form-row">
        <div class="form-item"><label>付款账户</label>
          <input class="input" value="${s.entityName} · 基本户" disabled></div>
        <div class="form-item"><label>付款日期</label>
          <input class="input" type="date" value="2026-10-21" id="rcpDate"></div>
        <div class="form-item"><label>银行流水号</label>
          <input class="input" value="20261021${String(Math.floor(Math.random() * 9000) + 1000)}" id="rcpSerial"></div>
      </div>

      <div class="section-title">回单文件</div>
      <div class="upload-zone">
        <input type="file" id="rcpFile" multiple accept="image/*,.pdf" onchange="App.pickReceipt(this)">
        <div class="u-main">网银电子回单 PDF，或柜台回单拍照</div>
        <b onclick="document.getElementById('rcpFile').click()">点击选择文件</b>
        <span style="color:var(--text-3)"> 或 </span>
        <b onclick="App.mockReceipt()">模拟上传</b>
      </div>
      <div id="receiptList" class="mt12">${attachList(State.formReceipt)}</div>

      ${batch ? `<div class="notice notice-blue mt12" style="font-size:11.5px"><div>本次为批量付款，同一张回单将归档到本批 ${ids.length} 张单据。若银行按笔出具回单，请逐张上传。</div></div>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="App.skipReceipt()">稍后补传</button>
      <button class="btn btn-primary" onclick="App.confirmReceipt()">确认归档</button>
    </div>`;
  openModal(html, true);
}

function pickReceipt(input){
  const files = input && input.files ? Array.from(input.files) : [];
  files.forEach(f => State.formReceipt.push({ name:f.name, size:fileSize(f.size), kind:fileKind(f.name) }));
  const box = document.getElementById('receiptList');
  if (box) box.innerHTML = attachList(State.formReceipt);
  input.value = '';
}
function mockReceipt(){
  State.formReceipt.push({ name:'银行电子回单-20261021.pdf', size:'96 KB', kind:'pdf' });
  const box = document.getElementById('receiptList');
  if (box) box.innerHTML = attachList(State.formReceipt);
  toast('已模拟上传回单（演示用，未真正传文件）');
}
function confirmReceipt(){
  if (!State.formReceipt.length){ toast('请先上传回单文件', 'err'); return; }
  const r = State.formReceipt[0];
  const serial = (document.getElementById('rcpSerial') || {}).value || '—';
  const date = (document.getElementById('rcpDate') || {}).value || '2026-10-21';
  const targets = State.receiptTargets || [];
  targets.forEach(id => {
    const d = docById(id);
    if (!d) return;
    d.receipt = { name:r.name, size:r.size, kind:r.kind, serial, date, by:ROLES[State.role].name, time:nowStr().slice(5), from:storeById(d.storeId).entityName + ' 基本户' };
    d.log = d.log || [];
    d.log.push({ act:'上传银行回单', by:ROLES[State.role].name, node:'出纳付款', time:nowStr() });
  });
  saveState(); closeModal(); render();
  toast(`已归档 ${targets.length} 张单据的银行回单，可生成付款凭证`, 'ok');
}
function skipReceipt(){
  closeModal(); render();
  toast('已跳过，回单可在单据详情中补传；未补传的付款会在关账检查中被标记', 'err');
}
function openReceipt(id){
  const d = docById(id);
  if (!d) return;
  openReceiptModal([id], false);
}
