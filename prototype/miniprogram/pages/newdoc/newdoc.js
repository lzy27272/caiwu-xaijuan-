/* ================= 新建单据：费用报销 / 付款申请 =================
   口径与 PC 端 assets/view-flow.js 的 newExpense / newPayment 完全一致：
     · 归属主体自动锁定（门店端按 demoStoreId，总部端可切换主体）
     · 费用项目两级：一级大类 → 二级明细，预算控制落在「二级明细映射到的预算项」
     · 收款信息含开户行（必填），报销可"记住上次账户"
     · 付款申请强制至少 1 个非发票附件
     · 提交前实时校验预算与收款账户一致性，结果直接渲染成提示条
   移动端的差异：用户无法真的选文件，改由「拍照/相册」与「从聊天文件」两个入口
   模拟（原型阶段用样例文件占位），并保留 PC 端"补录"入口的说明。 */

const DATA = require('../../utils/data.js');
const F = require('../../utils/format.js');

const app = getApp();

/* 附件样例池：模拟来自相机 / 相册 / 聊天文件 */
const SAMPLE_FILES = [
  { name: 'img_20261021_093215.jpg', size: '1.6 MB', kind: 'img', src: '拍照' },
  { name: 'img_20261021_093240.jpg', size: '1.4 MB', kind: 'img', src: '拍照' },
  { name: '验收单-GRN20261021.pdf', size: '318 KB', kind: 'pdf', src: '聊天文件' },
  { name: '供应商对账单-10月.xlsx', size: '86 KB', kind: 'xls', src: '聊天文件' },
  { name: '会议签到表.pdf', size: '204 KB', kind: 'pdf', src: '聊天文件' }
];

/* 付款类型需要的附件说明（与 data.js 的 PAY_TYPES 对齐，仅取提示文案） */
function payTypeNote(name) {
  const t = DATA.PAY_TYPES.filter(x => x.name === name)[0];
  return t ? t.note : '需说明用途，按金额档位审批';
}

/* 主体可选项：门店端锁定本店，总部端可切换 */
function storeOptions(role) {
  const locked = ['staff', 'manager', 'storefin'].indexOf(role) >= 0;
  const list = locked ? [app.storeById(app.globalData.demoStoreId)] : DATA.STORES;
  return {
    locked: locked,
    names: list.map(s => s.name + ' · ' + s.entityName),
    ids: list.map(s => s.id),
    index: 0
  };
}

Page({

  data: {
    type: 'expense',            // expense | payment
    typeLabel: '费用报销',
    role: '',
    roleName: '',

    /* 主体 */
    storeLocked: false,
    storeNames: [],
    storeIds: [],
    storeIndex: 0,
    entityName: '',
    storeName: '',
    taxNo: '',

    /* 公共字段 */
    person: '',
    dept: '',
    note: '',
    amount: '',
    amountText: '0.00',

    /* 费用项目 */
    groupNames: [],
    groupIndex: 0,
    itemNames: [],
    itemIndex: 0,
    groupName: '',
    itemName: '',
    budgetItem: '',

    /* 付款专用 */
    payTypeNames: [],
    payTypeIndex: 0,
    payTypeName: '',
    payTypeNote: '',
    payDate: '2026-10-25',

    /* 收款信息 */
    payee: '',
    bank: '',
    account: '',
    acctCandidates: [],         // 报销=本人常用账户；付款=供应商主数据
    acctIndex: -1,
    remember: true,             // 记住上次账户（仅报销）

    /* 附件 */
    attach: [],

    /* 校验 */
    checks: [],
    canSubmit: true,

    /* 提示 */
    toastShow: false,
    toastMsg: '',
    toastType: 'ok'
  },

  onLoad(query) {
    const type = query && query.type === 'payment' ? 'payment' : 'expense';
    const role = app.globalData.role;
    const roleName = DATA.ROLES[role].name;
    const so = storeOptions(role);
    const store = app.storeById(so.ids[0] || app.globalData.demoStoreId);

    const g0 = DATA.EXPENSE_TREE[0];
    const isExp = type === 'expense';

    /* 报销：带出上次使用账户；付款：带出第一个供应商 */
    const last = app.globalData.lastAccount;
    let acct;
    if (isExp) {
      const mine = DATA.MY_ACCOUNTS.filter(a => a.payee === '陈晓燕');
      acct = last && last.bank ? last : mine[0];
    } else {
      acct = DATA.PAYEE_ACCOUNTS[0];
    }

    const cands = isExp
      ? DATA.MY_ACCOUNTS.filter(a => a.payee === '陈晓燕').map(a => ({
          id: a.id,
          bank: a.bank,
          account: a.account,
          meta: a.payee + ' · 上次使用 ' + a.last + ' · 已用 ' + a.times + ' 次'
        }))
      : DATA.PAYEE_ACCOUNTS.map(a => ({
          id: a.id,
          bank: a.bank,
          account: a.account,
          meta: a.payee + ' · ' + (a.verified ? '账户已验证' : '账户待验证') + ' · 已用 ' + a.times + ' 次'
        }));

    this.setData({
      type: type,
      typeLabel: isExp ? '费用报销' : '付款申请',
      role: role,
      roleName: roleName,
      storeLocked: so.locked,
      storeNames: so.names,
      storeIds: so.ids,
      storeIndex: so.index,
      entityName: store.entityName,
      storeName: store.name,
      taxNo: store.taxNo,
      person: isExp ? '陈晓燕' : '张伟',
      dept: isExp ? '客房部' : '采购部',
      note: isExp ? '' : '10 月客房易耗品货款（第四批）',
      groupNames: DATA.EXPENSE_TREE.map(g => g.group),
      groupIndex: 0,
      itemNames: g0.items.map(i => i.name),
      itemIndex: 0,
      groupName: g0.group,
      itemName: g0.items[0].name,
      budgetItem: DATA.budgetItemOf(g0.items[0].name) || '',
      payTypeNames: DATA.PAY_TYPES.map(t => t.name),
      payTypeIndex: 0,
      payTypeName: DATA.PAY_TYPES[0].name,
      payTypeNote: DATA.PAY_TYPES[0].note,
      payee: acct.payee,
      bank: acct.bank,
      account: acct.account,
      acctCandidates: cands,
      acctIndex: -1
    });

    this.runChecks();
  },

  /* ================= 校验（与 PC 端 simulateCheck / simulatePayCheck 同逻辑） ================= */
  budgetOf(itemName) {
    const key = DATA.budgetItemOf(itemName);
    const list = DATA.BUDGETS;
    for (let i = 0; i < list.length; i++) {
      if (list[i].item === key) {
        return {
          item: list[i].item,
          budget: list[i].budget,
          used: list[i].used,
          inTrans: list[i].inTrans,
          avail: list[i].budget - list[i].used - list[i].inTrans
        };
      }
    }
    const b = list[0];
    return { item: b.item, budget: b.budget, used: b.used, inTrans: b.inTrans,
             avail: b.budget - b.used - b.inTrans };
  },

  runChecks() {
    const d = this.data;
    const amt = parseFloat(d.amount) || 0;
    const bud = this.budgetOf(d.itemName);
    const checks = [];

    if (amt > 0) {
      if (amt > bud.avail) {
        checks.push({
          level: 'red',
          title: '预算不足',
          text: '「' + d.itemName + '」归集至预算项「' + bud.item + '」，可用 ¥' + F.fmt(bud.avail) +
                '，本单 ¥' + F.fmt(amt) + '，超出 ¥' + F.fmt(amt - bud.avail) +
                '。提交后将强制增加一级审批，并需填写超支原因。'
        });
      }
      if (d.type === 'expense' && amt > 3000 && amt < 3300) {
        checks.push({
          level: 'amber',
          title: '疑似拆单',
          text: '本单金额 ¥' + F.fmt(amt) + ' 略低于 ¥3,000 审批档位边界。系统检测到你在 7 日内另有 2 笔同类费用，' +
                '合并金额将跨越档位，本单将按合并金额走高一级审批。'
        });
      }
    }

    /* 收款账户一致性 */
    if (d.type === 'payment') {
      const master = DATA.PAYEE_ACCOUNTS.filter(a => a.payee === d.payee)[0];
      if (!d.payee) {
        checks.push({ level: 'amber', title: '缺少收款方', text: '请填写收款方名称，首次付款需先建档。' });
      } else if (!master) {
        checks.push({
          level: 'amber',
          title: '新收款方',
          text: '「' + d.payee + '」不在供应商主数据中。首次付款需先建档（营业执照、开户许可证），完成账户验证后方可付款。'
        });
      } else if (master.bank !== d.bank || master.account !== d.account) {
        checks.push({
          level: 'amber',
          title: '账户与主数据不一致',
          text: '主数据登记为 ' + master.bank + ' / ' + master.account +
                '。变更收款账户属高风险操作，需双人复核并用预留电话回拨确认，付款延后 1 个工作日（冷静期）。'
        });
      }
    } else if (!d.bank || !d.account) {
      checks.push({ level: 'amber', title: '收款账户不完整', text: '开户行与银行账号均为必填，否则无法打款。' });
    }

    /* 附件要求 */
    if (d.type === 'payment' && !d.attach.length) {
      checks.push({
        level: 'amber',
        title: '缺少付款依据',
        text: '「' + d.payTypeName + '」需：' + d.payTypeNote + '。至少上传 1 个附件后才能提交。'
      });
    }

    const canSubmit = !(d.type === 'payment' && !d.attach.length) && amt > 0;

    this.setData({
      checks: checks,
      canSubmit: canSubmit,
      budgetItem: bud.item,
      amountText: F.fmt(amt)
    });
  },

  /* ================= 交互 ================= */
  onType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.type) return;
    wx.redirectTo({ url: '/pages/newdoc/newdoc?type=' + type });
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    const patch = {};
    patch[key] = e.detail.value;
    this.setData(patch, () => {
      if (key === 'amount' || key === 'payee' || key === 'bank' || key === 'account') this.runChecks();
    });
  },

  onStore(e) {
    const idx = Number(e.detail.value);
    const store = app.storeById(this.data.storeIds[idx]);
    this.setData({
      storeIndex: idx,
      entityName: store.entityName,
      storeName: store.name,
      taxNo: store.taxNo
    });
  },

  onGroup(e) {
    const idx = Number(e.detail.value);
    const g = DATA.EXPENSE_TREE[idx];
    this.setData({
      groupIndex: idx,
      groupName: g.group,
      itemNames: g.items.map(i => i.name),
      itemIndex: 0,
      itemName: g.items[0].name
    }, () => this.runChecks());
  },

  onItem(e) {
    const idx = Number(e.detail.value);
    this.setData({ itemIndex: idx, itemName: this.data.itemNames[idx] }, () => this.runChecks());
  },

  onPayType(e) {
    const idx = Number(e.detail.value);
    this.setData({
      payTypeIndex: idx,
      payTypeName: this.data.payTypeNames[idx],
      payTypeNote: payTypeNote(this.data.payTypeNames[idx])
    }, () => this.runChecks());
  },

  onDate(e) {
    this.setData({ payDate: e.detail.value });
  },

  /* 点击常用账户直接套用开户行与账号 */
  useAcct(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const a = this.data.acctCandidates[idx];
    if (!a) return;
    this.setData({ acctIndex: idx, bank: a.bank, account: a.account }, () => this.runChecks());
  },

  /* 记住上次账户：本地缓存，下次新建自动带出 */
  onRemember(e) {
    this.setData({ remember: !!e.detail.value });
  },

  /* ---------- 附件：拍照 / 相册 / 聊天文件 ---------- */
  addAttach(type) {
    const used = this.data.attach.length;
    const pool = type === 'camera'
      ? SAMPLE_FILES.filter(f => f.kind === 'img')
      : type === 'album'
        ? SAMPLE_FILES.filter(f => f.kind === 'img')
        : SAMPLE_FILES.filter(f => f.kind !== 'img');
    const f = pool[used % pool.length];
    const list = this.data.attach.concat([{
      name: f.name,
      size: f.size,
      kind: f.kind,
      kindLabel: (DATA.ATTACH_KIND[f.kind] || DATA.ATTACH_KIND.other).label,
      kindCls: (DATA.ATTACH_KIND[f.kind] || DATA.ATTACH_KIND.other).cls,
      src: f.src,
      by: this.data.roleName,
      time: '刚刚'
    }]);
    this.setData({ attach: list }, () => this.runChecks());
    wx.showToast({ title: '已添加「' + f.src + '」附件', icon: 'none' });
  },

  onCamera() { this.addAttach('camera'); },
  onAlbum() { this.addAttach('album'); },
  onFile() { this.addAttach('file'); },

  delAttach(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const list = this.data.attach.slice();
    list.splice(idx, 1);
    this.setData({ attach: list }, () => this.runChecks());
  },

  /* ================= 提交 ================= */
  submit() {
    const d = this.data;
    const amt = parseFloat(d.amount) || 0;
    if (!amt) return this.toast('请填写金额', 'err');
    if (!d.bank || !d.account) return this.toast('请填写开户行与银行账号', 'err');
    if (d.type === 'payment') {
      if (!d.payee) return this.toast('请填写收款方', 'err');
      if (!d.attach.length) return this.toast('请至少上传 1 个付款依据附件', 'err');
    }

    const docs = app.globalData.docs;
    const store = app.storeById(d.storeIds[d.storeIndex]);
    const isExp = d.type === 'expense';

    /* 记住上次账户（仅报销） */
    if (isExp && d.remember) {
      app.setLastAccount({ payee: d.payee, bank: d.bank, account: d.account, id: 'LAST' });
    }

    /* 单据号：按类型各自连续编号 */
    const sameType = docs.filter(x => x.type === d.type).length;
    const id = isExp
      ? 'BX2026100' + String(30 + sameType)
      : 'FK2026100' + String(20 + sameType);

    /* 审批风险标记：与 PC 端 submitPayment 同规则 */
    const risk = [];
    if (!isExp) {
      const master = DATA.PAYEE_ACCOUNTS.filter(a => a.payee === d.payee)[0];
      if (!master) {
        risk.push({ level: 'warn', code: 'S1', text: '收款方不在供应商主数据中，首次付款需先建档并完成账户验证' });
      } else if (master.bank !== d.bank || master.account !== d.account) {
        risk.push({ level: 'warn', code: 'S3', text: '收款账户与合同备案账户不一致，已触发供应商账户变更复核，需 T+1 冷静期后方可付款' });
      }
    }
    const bud = this.budgetOf(d.itemName);
    if (amt > bud.avail) {
      risk.push({ level: 'warn', code: 'B1', text: '超出「' + bud.item + '」可用预算 ¥' + F.fmt(amt - bud.avail) + '，需增加一级审批' });
    }

    const doc = {
      id: id,
      type: d.type,
      typeLabel: isExp ? '费用报销' : '付款申请',
      storeId: store.id,
      applicant: d.person,
      dept: d.dept,
      title: d.note || (isExp ? d.itemName + ' 报销' : '付款申请'),
      amount: amt,
      taxAmount: Math.round(amt / (isExp ? 1.13 : 1.06) * (isExp ? 0.13 : 0.06) * 100) / 100,
      submitDate: '2026-10-21 ' + this.nowTime(),
      budgetItem: d.itemName,
      budgetGroup: d.groupName,
      status: 'pending',
      currentNode: 0,
      payee: d.payee,
      payBank: d.bank,
      payeeAccount: d.account,
      payType: isExp ? '员工报销' : d.payTypeName,
      expectPayDate: isExp ? '' : d.payDate,
      invoices: [],
      lines: [{ item: d.note || d.itemName, qty: 1, price: amt, amount: amt, taxRate: isExp ? 0.13 : 0.06 }],
      attach: d.attach.map(a => ({ name: a.name, size: a.size, kind: a.kind, by: a.by, time: a.time })),
      note: '',
      risk: risk,
      log: [{ node: '提交申请', who: d.person, action: '提交', time: '2026-10-21 ' + this.nowTime() }]
    };

    /* 新单插到最前，审批链从「店长审批」开始 */
    docs.unshift(doc);

    const attachCount = d.attach.length;
    this.toast('已提交，推送至门店店长审批' + (attachCount ? '（含 ' + attachCount + ' 个附件）' : ''), 'ok');
    const self = this;
    setTimeout(function () {
      wx.redirectTo({ url: '/pages/detail/detail?id=' + doc.id });
    }, 700);
    self.setData({ canSubmit: false });
  },

  nowTime() {
    const t = new Date();
    const p = n => (n < 10 ? '0' + n : '' + n);
    return p(t.getHours()) + ':' + p(t.getMinutes());
  },

  toast(msg, type) {
    const self = this;
    this.setData({ toastShow: true, toastMsg: msg, toastType: type || 'ok' });
    clearTimeout(this._t);
    this._t = setTimeout(function () { self.setData({ toastShow: false }); }, 2200);
  },

  cancel() {
    wx.navigateBack({ delta: 1 });
    /* 若为直接进入（无上级页），退回工作台 */
    setTimeout(function () {
      const pages = getCurrentPages();
      if (pages.length <= 1) wx.switchTab({ url: '/pages/workbench/workbench' });
    }, 60);
  }
});
