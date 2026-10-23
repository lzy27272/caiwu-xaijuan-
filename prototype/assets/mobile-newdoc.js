/* ================= 手机预览 · 新建单据（报销 / 付款） =================
   与小程序 pages/newdoc/ 同口径，字段与校验逻辑一一对应：
     主体自动锁定（门店端）/ 可切换（总部端）
     费用两级科目 → 二级明细映射预算项
     收款信息含开户行，报销可记住上次账户
     付款申请强制至少 1 个依据附件
   差异仅在交互形态：浏览器里用真实的 <input type="file">，小程序里用「拍照/相册/聊天文件」。 */

/* 表单草稿：切类型时不丢已填内容 */
const NF = {
  type: 'expense',
  storeIndex: 0,
  person: '陈晓燕',
  dept: '客房部',
  note: '',
  amount: '',
  groupIndex: 0,
  itemIndex: 0,
  payTypeIndex: 0,
  payDate: '2026-10-25',
  payee: '',
  bank: '',
  account: '',
  remember: true,
  attach: []
};

const NF_SAMPLE = [
  { name: '验收单-GRN20261021.pdf', size: '318 KB', kind: 'pdf' },
  { name: '现场照片-01.jpg', size: '1.4 MB', kind: 'img' },
  { name: '供应商对账单-10月.xlsx', size: '86 KB', kind: 'xls' }
];

function nfStoreOptions(role) {
  const locked = ['staff', 'manager', 'storefin'].indexOf(role) >= 0;
  const list = locked ? [mpStore('S01')] : STORES;
  return { locked: locked, list: list };
}

/* 进入新建页：初始化草稿 */
function nfInit(type) {
  const role = MP.role;
  const so = nfStoreOptions(role);
  const isExp = type === 'expense';

  NF.type = type;
  NF.storeIndex = 0;
  NF.person = isExp ? '陈晓燕' : '张伟';
  NF.dept = isExp ? '客房部' : '采购部';
  NF.note = isExp ? '' : '10 月客房易耗品货款（第四批）';
  NF.amount = '';
  NF.groupIndex = 0;
  NF.itemIndex = 0;
  NF.payTypeIndex = 0;
  NF.attach = [];

  const last = State.lastAccount;
  const acct = isExp
    ? (last && last.bank ? last : MY_ACCOUNTS.filter(a => a.payee === '陈晓燕')[0])
    : PAYEE_ACCOUNTS[0];
  NF.payee = acct.payee;
  NF.bank = acct.bank;
  NF.account = acct.account;

  MP.tab = 'newdoc';
  render();
}

/* 预算反查：与 PC 端 budgetFor 同口径 */
function nfBudget(itemName) {
  const key = budgetItemOf(itemName);
  const b = BUDGETS.find(x => x.item === key) || BUDGETS[0];
  return { item: b.item, budget: b.budget, used: b.used, inTrans: b.inTrans, avail: b.budget - b.used - b.inTrans };
}

/* 实时校验：与小程序 runChecks 完全一致 */
function nfChecks() {
  const amt = parseFloat(NF.amount) || 0;
  const tree = EXPENSE_TREE[NF.groupIndex];
  const itemName = tree.items[NF.itemIndex].name;
  const bud = nfBudget(itemName);
  const checks = [];

  if (amt > 0) {
    if (amt > bud.avail) {
      checks.push({ level: 'red', title: '预算不足',
        text: `「${itemName}」归集至预算项「${bud.item}」，可用 ¥${fmt(bud.avail)}，本单 ¥${fmt(amt)}，超出 ¥${fmt(amt - bud.avail)}。提交后将强制增加一级审批，并需填写超支原因。` });
    }
    if (NF.type === 'expense' && amt > 3000 && amt < 3300) {
      checks.push({ level: 'amber', title: '疑似拆单',
        text: `本单金额 ¥${fmt(amt)} 略低于 ¥3,000 审批档位边界。系统检测到你在 7 日内另有 2 笔同类费用，合并金额将跨越档位，本单将按合并金额走高一级审批。` });
    }
  }

  if (NF.type === 'payment') {
    const master = PAYEE_ACCOUNTS.find(a => a.payee === NF.payee);
    if (!NF.payee) {
      checks.push({ level: 'amber', title: '缺少收款方', text: '请填写收款方名称，首次付款需先建档。' });
    } else if (!master) {
      checks.push({ level: 'amber', title: '新收款方',
        text: `「${NF.payee}」不在供应商主数据中。首次付款需先建档（营业执照、开户许可证），完成账户验证后方可付款。` });
    } else if (master.bank !== NF.bank || master.account !== NF.account) {
      checks.push({ level: 'amber', title: '账户与主数据不一致',
        text: `主数据登记为 ${master.bank} / ${master.account}。变更收款账户属高风险操作，需双人复核并用预留电话回拨确认，付款延后 1 个工作日（冷静期）。` });
    }
    if (!NF.attach.length) {
      const pt = PAY_TYPES[NF.payTypeIndex];
      checks.push({ level: 'amber', title: '缺少付款依据', text: `「${pt.name}」需：${pt.note}。至少上传 1 个附件后才能提交。` });
    }
  } else if (!NF.bank || !NF.account) {
    checks.push({ level: 'amber', title: '收款账户不完整', text: '开户行与银行账号均为必填，否则无法打款。' });
  }

  return { checks, bud, itemName, amt, canSubmit: amt > 0 && !(NF.type === 'payment' && !NF.attach.length) };
}

/* ---------- 页面 ---------- */
function pageNewDoc() {
  const isExp = NF.type === 'expense';
  const role = MP.role;
  const so = nfStoreOptions(role);
  const store = so.list[NF.storeIndex];
  const tree = EXPENSE_TREE[NF.groupIndex];
  const r = nfChecks();

  const storeRow = so.locked
    ? `<div class="fld"><span class="fld-l">归属门店</span><span class="fld-v">${store.name}</span></div>`
    : `<div class="fld"><span class="fld-l">付款主体 <i class="req">*</i></span>
        <select class="fld-in" onchange="Mp.nfStore(this.value)">
          ${so.list.map((s, i) => `<option value="${i}" ${i === NF.storeIndex ? 'selected' : ''}>${s.name} · ${s.entityName}</option>`).join('')}
        </select></div>`;

  return `
  <div class="nf">
    <div class="seg">
      <div class="seg-i ${isExp ? 'on' : ''}" onclick="Mp.nfType('expense')">费用报销</div>
      <div class="seg-i ${isExp ? '' : 'on'}" onclick="Mp.nfType('payment')">付款申请</div>
    </div>

    <div class="notice notice-blue" style="font-size:11px;margin-bottom:10px">
      <div>当前主体：<b>${store.entityName}</b> · 税号 ${store.taxNo}<br>
      <span style="font-size:10.5px;color:#378ADD">发票抬头、收款账户须与此主体一致，否则无法提交</span></div>
    </div>

    <div class="card" style="margin:0 0 10px">
      <div class="sect-hd">基本信息</div>
      ${storeRow}
      <div class="fld"><span class="fld-l">${isExp ? '报销人' : '申请人'}</span>
        <input class="fld-in" value="${e(NF.person)}" oninput="Mp.nfSet('person',this.value)" placeholder="姓名"></div>
      <div class="fld"><span class="fld-l">部门</span>
        <input class="fld-in" value="${e(NF.dept)}" oninput="Mp.nfSet('dept',this.value)" placeholder="如：客房部"></div>
      ${isExp ? '' : `<div class="fld"><span class="fld-l">付款类型 <i class="req">*</i></span>
        <select class="fld-in" onchange="Mp.nfPayType(this.value)">
          ${PAY_TYPES.map((t, i) => `<option value="${i}" ${i === NF.payTypeIndex ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select></div>
      <div class="fld"><span class="fld-l">期望付款日</span>
        <input class="fld-in" type="date" value="${NF.payDate}" onchange="Mp.nfSet('payDate',this.value)"></div>`}
      <div class="fld"><span class="fld-l">事由</span>
        <input class="fld-in" value="${e(NF.note)}" oninput="Mp.nfSet('note',this.value)"
          placeholder="${isExp ? '如：9月客房补充采购' : '如：10月货款第四批'}"></div>
      ${isExp ? '' : `<div class="hint">${PAY_TYPES[NF.payTypeIndex].note}</div>`}
    </div>

    <div class="card" style="margin:0 0 10px">
      <div class="sect-hd">费用项目<span class="sub">一级大类 → 二级明细</span></div>
      <div class="fld"><span class="fld-l">一级大类 <i class="req">*</i></span>
        <select class="fld-in" onchange="Mp.nfGroup(this.value)">
          ${EXPENSE_TREE.map((g, i) => `<option value="${i}" ${i === NF.groupIndex ? 'selected' : ''}>${g.group}</option>`).join('')}
        </select></div>
      <div class="fld"><span class="fld-l">二级明细 <i class="req">*</i></span>
        <select class="fld-in" onchange="Mp.nfItem(this.value)">
          ${tree.items.map((it, i) => `<option value="${i}" ${i === NF.itemIndex ? 'selected' : ''}>${it.name}</option>`).join('')}
        </select></div>
      <div class="fld"><span class="fld-l">金额（元） <i class="req">*</i></span>
        <input class="fld-in fld-amt num" type="number" inputmode="decimal" value="${NF.amount}"
          oninput="Mp.nfAmount(this.value)" placeholder="0.00"></div>
      <div class="hint">归集至预算项「${r.bud.item}」· 可用 ¥${fmt(r.bud.avail)} · 预算控制落在二级明细，报表汇总按一级大类</div>
    </div>

    <div class="card" style="margin:0 0 10px">
      <div class="sect-hd">收款信息<span class="sub">${isExp ? '报销款将打入以下账户' : '须与供应商主数据一致'}</span></div>
      <div class="accts">
        ${(isExp ? MY_ACCOUNTS.filter(a => a.payee === '陈晓燕') : PAYEE_ACCOUNTS).map((a, i) => `
          <div class="acct ${(a.bank === NF.bank && a.account === NF.account) ? 'on' : ''}"
               onclick="Mp.nfAcct(${i})">
            <div class="acct-bank">${e(a.bank)}</div>
            <div class="acct-no num">${a.account}</div>
            <div class="acct-meta">${e(a.payee)} · 上次 ${a.last} · 已用 ${a.times} 次</div>
          </div>`).join('')}
      </div>
      <div class="fld"><span class="fld-l">收款${isExp ? '人' : '方'} <i class="req">*</i></span>
        <input class="fld-in" value="${e(NF.payee)}" oninput="Mp.nfSet('payee',this.value)"></div>
      <div class="fld"><span class="fld-l">开户行 <i class="req">*</i></span>
        <input class="fld-in" value="${e(NF.bank)}" oninput="Mp.nfSet('bank',this.value)" placeholder="如：招商银行贵阳分行营业部"></div>
      <div class="fld"><span class="fld-l">银行账号 <i class="req">*</i></span>
        <input class="fld-in num" value="${e(NF.account)}" oninput="Mp.nfSet('account',this.value)"></div>
      ${isExp ? `<div class="remember">
        <span>记住本次账户，下次自动带出</span>
        <input type="checkbox" ${NF.remember ? 'checked' : ''} onchange="Mp.nfRemember(this.checked)">
      </div>` : ''}
    </div>

    <div class="card" style="margin:0 0 10px">
      <div class="sect-hd">其他附件<span class="sub">${isExp ? '非发票材料' : '至少 1 个'}</span></div>
      <div class="hint" style="margin-top:0">合同、验收单、对账单、会议签到表、现场照片等，作为业务真实性依据；不参与发票查重与抵扣。</div>
      <div class="att-btns">
        <label class="att-btn">拍照/相册
          <input type="file" accept="image/*" multiple style="display:none" onchange="Mp.nfPick(this)">
        </label>
        <label class="att-btn">选文件
          <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,image/*" style="display:none" onchange="Mp.nfPick(this)">
        </label>
        <div class="att-btn" onclick="Mp.nfMock()">模拟上传</div>
      </div>
      ${NF.attach.map((a, i) => {
        const k = ATTACH_KIND[a.kind] || ATTACH_KIND.other;
        return `<div class="line-row">
          <span class="tag ${k.cls}">${k.label}</span>
          <span class="l-name">${e(a.name)}</span>
          <span class="l-qty">${a.size}</span>
          <span class="nf-del" onclick="Mp.nfDel(${i})">删</span>
        </div>`;
      }).join('')}
      ${NF.attach.length ? '' : `<div class="empty" style="padding:16px 0">暂无附件${isExp ? '' : '，付款申请至少需 1 个依据附件'}</div>`}
    </div>

    ${`<div id="nfCheck">${nfCheckHTML(r)}</div>`}

    <div class="hint" style="padding:0 4px 12px">发票请在「发票池」上传或由系统 OCR 识别后勾选；本页仅收非发票材料。</div>
  </div>

  <div class="nf-bar">
    <div class="nf-sum"><span>合计</span><b class="num" id="nfSum">¥${fmt(r.amt)}</b></div>
    <button class="btn btn-ghost" onclick="Mp.nfCancel()">取消</button>
    <button class="btn ${r.canSubmit ? 'btn-primary' : 'btn-disabled'}" id="nfBtn" onclick="Mp.nfSubmit()">
      ${r.canSubmit ? '提交审批' : '待完善'}</button>
  </div>`;
}

/* 校验区 HTML（金额输入时局部刷新用） */
function nfCheckHTML(r) {
  if (r.checks.length) {
    return `<div class="card" style="margin:0 0 10px">
      <div class="sect-hd">提交前检查<span class="sub">${r.checks.length} 项需注意</span></div>
      ${r.checks.map(c => `<div class="chk ${c.level === 'red' ? 'chk-red' : 'chk-amber'}">
        <div class="chk-t">${c.title}</div><div class="chk-x">${c.text}</div></div>`).join('')}
    </div>`;
  }
  if (!r.amount) return '';
  return `<div class="card" style="margin:0 0 10px">
    <div class="notice" style="background:#E1F5EE;color:#0F6E56">
      <div>校验通过：费用明细「${r.itemName}」归集至预算项「${r.bud.item}」，收款账户完整，未发现拆单与预算风险。</div>
    </div></div>`;
}

/* ---------- 交互 ---------- */
const MpNf = {
  nfType(type) {
    const keep = { amount: NF.amount, note: NF.note };
    nfInit(type);
    NF.amount = keep.amount;
    NF.note = type === 'expense' ? keep.note : NF.note;
    render();
  },
  nfStore(v) { NF.storeIndex = Number(v); render(); },
  nfSet(k, v) { NF[k] = v; if (k === 'payee' || k === 'bank' || k === 'account') render(); },
  nfAmount(v) {
    NF.amount = v;
    /* 只重绘合计与校验区，不整页重绘——否则输入框会失焦、光标跳位 */
    const r = nfChecks();
    const sum = document.getElementById('nfSum');
    if (sum) sum.textContent = '¥' + fmt(r.amt);
    const btn = document.getElementById('nfBtn');
    if (btn) {
      btn.textContent = r.canSubmit ? '提交审批' : '待完善';
      btn.className = 'btn ' + (r.canSubmit ? 'btn-primary' : 'btn-disabled');
    }
    const zone = document.getElementById('nfCheck');
    if (zone) zone.innerHTML = nfCheckHTML(r);
  },
  nfGroup(v) { NF.groupIndex = Number(v); NF.itemIndex = 0; render(); },
  nfItem(v) { NF.itemIndex = Number(v); render(); },
  nfPayType(v) { NF.payTypeIndex = Number(v); render(); },
  nfRemember(v) { NF.remember = !!v; },
  nfAcct(i) {
    const a = (NF.type === 'expense' ? MY_ACCOUNTS.filter(x => x.payee === '陈晓燕') : PAYEE_ACCOUNTS)[i];
    if (!a) return;
    NF.bank = a.bank;
    NF.account = a.account;
    render();
    mpToast('已套用「' + a.bank + '」');
  },
  nfPick(input) {
    const files = input && input.files ? Array.from(input.files) : [];
    files.forEach(f => NF.attach.push({
      name: f.name, size: fileSize(f.size), kind: fileKind(f.name),
      by: ROLES[MP.role].name, time: '刚刚'
    }));
    render();
    input.value = '';
    if (files.length) mpToast('已添加 ' + files.length + ' 个附件');
  },
  nfMock() {
    const s = NF_SAMPLE[NF.attach.length % NF_SAMPLE.length];
    NF.attach.push({ name: s.name, size: s.size, kind: s.kind, by: ROLES[MP.role].name, time: '刚刚' });
    render();
    mpToast('已模拟上传 1 个附件（演示用）');
  },
  nfDel(i) { NF.attach.splice(i, 1); render(); },
  nfCancel() { MP.tab = 'workbench'; render(); },

  nfSubmit() {
    const r = nfChecks();
    if (!r.amt) return mpToast('请填写金额');
    if (!NF.bank || !NF.account) return mpToast('请填写开户行与银行账号');
    if (NF.type === 'payment' && !NF.payee) return mpToast('请填写收款方');
    if (NF.type === 'payment' && !NF.attach.length) return mpToast('请至少上传 1 个付款依据附件');

    const isExp = NF.type === 'expense';
    const so = nfStoreOptions(MP.role);
    const store = so.list[NF.storeIndex];

    if (isExp && NF.remember) {
      State.lastAccount = { payee: NF.payee, bank: NF.bank, account: NF.account, id: 'LAST' };
      saveState();
    }

    const sameType = MP.docs.filter(d => d.type === NF.type).length;
    const id = isExp ? 'BX2026100' + String(30 + sameType) : 'FK2026100' + String(20 + sameType);

    const risk = [];
    if (!isExp) {
      const master = PAYEE_ACCOUNTS.find(a => a.payee === NF.payee);
      if (!master) risk.push({ level: 'warn', code: 'S1', text: '收款方不在供应商主数据中，首次付款需先建档并完成账户验证' });
      else if (master.bank !== NF.bank || master.account !== NF.account)
        risk.push({ level: 'warn', code: 'S3', text: '收款账户与合同备案账户不一致，已触发供应商账户变更复核，需 T+1 冷静期后方可付款' });
    }
    if (r.amt > r.bud.avail)
      risk.push({ level: 'warn', code: 'B1', text: `超出「${r.bud.item}」可用预算 ¥${fmt(r.amt - r.bud.avail)}，需增加一级审批` });

    const now = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    const timeStr = '2026-10-21 ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

    MP.docs.unshift({
      id, type: NF.type, typeLabel: isExp ? '费用报销' : '付款申请',
      storeId: store.id, applicant: NF.person, dept: NF.dept,
      title: NF.note || (isExp ? r.itemName + ' 报销' : '付款申请'),
      amount: r.amt,
      taxAmount: Math.round(r.amt / (isExp ? 1.13 : 1.06) * (isExp ? 0.13 : 0.06) * 100) / 100,
      submitDate: timeStr,
      budgetItem: r.itemName, budgetGroup: EXPENSE_TREE[NF.groupIndex].group,
      status: 'pending', currentNode: 0,
      payee: NF.payee, payBank: NF.bank, payeeAccount: NF.account,
      payType: isExp ? '员工报销' : PAY_TYPES[NF.payTypeIndex].name,
      expectPayDate: isExp ? '' : NF.payDate,
      invoices: [],
      lines: [{ item: NF.note || r.itemName, qty: 1, price: r.amt, amount: r.amt, taxRate: isExp ? 0.13 : 0.06 }],
      attach: NF.attach.slice(), note: '', risk: risk,
      log: [{ act: '提交', by: NF.person, node: '提交申请', time: timeStr }]
    });

    MP.docId = id;
    MP.tab = 'detail';
    render();
    mpToast('已提交，推送至门店店长审批' + (NF.attach.length ? '（含 ' + NF.attach.length + ' 个附件）' : ''));
  }
};

/* 详情页轨迹（与小程序一致：无 log 时按进度反推） */
function mpLogs(d) {
  if (d.log && d.log.length) return d.log;
  const flow = getFlow(d);
  const out = [{ act: '提交', by: d.applicant, node: flow[0].name, time: d.submitDate }];
  const done = (d.status === 'approved' || d.status === 'paid') ? flow.length - 1 : d.currentNode;
  for (let i = 1; i < done; i++) {
    out.push({ act: '通过', by: flow[i].who, node: flow[i].name, time: d.submitDate.slice(0, 10) });
  }
  if (d.status === 'rejected') {
    const n = flow[d.currentNode] || flow[flow.length - 1];
    out.push({ act: '驳回', by: n.who, node: n.name, time: d.submitDate.slice(0, 10) });
  }
  return out;
}
