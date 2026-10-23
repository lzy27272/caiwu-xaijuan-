/* ================= 单据详情：审批链、风险、明细、发票、审批动作 =================
   审批动作只修改 app.globalData.docs 中的单据对象（DOCS 的深拷贝），
   与 PC 端 core.js 的 approveDoc / rejectDoc 逻辑完全一致。 */

const DATA = require('../../utils/data.js');
const F = require('../../utils/format.js');
const { getFlow, canApprove } = require('../../utils/flow.js');

const app = getApp();

const STATUS_MAP = {
  pending:  { text: '审批中', cls: 'tag-amber' },
  approved: { text: '已审批', cls: 'tag-teal' },
  rejected: { text: '已驳回', cls: 'tag-red' },
  paid:     { text: '已付款', cls: 'tag-blue' },
  draft:    { text: '草稿',   cls: 'tag-gray' }
};

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

/* 收款方开户行反查：存量单据无 payBank 字段时按主数据补齐 */
function bankOfPayee(payee) {
  if (!payee) return '—';
  const all = (DATA.PAYEE_ACCOUNTS || []).concat(DATA.MY_ACCOUNTS || []);
  for (let i = 0; i < all.length; i++) {
    if (all[i].payee === payee) return all[i].bank;
  }
  return '—';
}

function nowStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* 存量单据没有 log 字段：按审批进度反推一条轨迹，保证详情页始终有迹可循 */
function buildLogs(doc, flow) {
  const out = [{
    act: '提交',
    by: doc.applicant,
    node: flow[0].name,
    time: doc.submitDate
  }];
  const done = doc.status === 'approved' || doc.status === 'paid'
    ? flow.length - 1
    : doc.currentNode;
  for (let i = 1; i < done; i++) {
    out.push({ act: '通过', by: flow[i].who, node: flow[i].name, time: doc.submitDate.slice(0, 10) });
  }
  if (doc.status === 'rejected') {
    const n = flow[doc.currentNode] || flow[flow.length - 1];
    out.push({ act: '驳回', by: n.who, node: n.name, time: doc.submitDate.slice(0, 10) });
  }
  return out;
}

Page({

  data: {
    found: true,
    id: '',
    title: '',
    statusText: '',
    statusClass: '',
    amountText: '0.00',
    taxText: '0.00',
    typeLabel: '',
    storeName: '',
    applicant: '',
    dept: '',
    submitDate: '',
    budgetItem: '',
    note: '',
    isPayment: false,
    payee: '',
    payBank: '',
    payeeAccount: '',
    attach: [],
    isPaid: false,
    hasReceipt: false,
    receiptName: '',
    receiptMeta: '',
    roleName: '',
    nodes: [],
    stepText: '',
    risks: [],
    hasBlock: false,
    lines: [],
    invoices: [],
    invoiceTotalText: '0.00',
    logs: [],
    canAct: false,
    nodeName: '',
    nodeWho: '',
    denyTitle: '',
    denyDesc: ''
  },

  onLoad(options) {
    this.docId = (options && options.id) ? options.id : '';
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const doc = app.docById(this.docId);
    if (!doc) {
      this.setData({ found: false });
      return;
    }

    const role = app.globalData.role;
    let roleName = '';
    const roles = app.roleList();
    for (let i = 0; i < roles.length; i++) if (roles[i].key === role) roleName = roles[i].name;

    const store = app.storeById(doc.storeId);
    const flow = getFlow(doc);
    const curNode = flow[doc.currentNode] || flow[flow.length - 1];
    const st = STATUS_MAP[doc.status] || STATUS_MAP.draft;

    /* 节点状态：已完成 / 当前 / 已驳回 / 未到 */
    const nodes = flow.map((n, i) => {
      let state = 'wait';
      if (doc.status === 'rejected' && i === doc.currentNode) state = 'reject';
      else if (i < doc.currentNode) state = 'done';
      else if (i === doc.currentNode && doc.status === 'pending') state = 'active';
      else if (i <= doc.currentNode) state = 'done';
      return {
        key: n.name + '-' + i,
        name: n.name,
        who: n.who,
        state: state,
        icon: state === 'done' ? '✓' : (state === 'reject' ? '×' : String(i + 1))
      };
    });

    let stepText = '';
    if (doc.status === 'pending') {
      stepText = '第 ' + (doc.currentNode + 1) + ' / ' + flow.length + ' 步 · ' + curNode.name;
    } else if (doc.status === 'approved') {
      stepText = '审批已完成 · 待出纳付款';
    } else if (doc.status === 'rejected') {
      stepText = '已于「' + curNode.name + '」驳回';
    } else {
      stepText = '共 ' + flow.length + ' 个节点';
    }

    const risks = (doc.risk || []).map(r => ({
      code: r.code,
      text: r.text,
      levelText: r.level === 'block' ? '阻断' : '警告',
      cls: r.level === 'block' ? 'notice-red' : 'notice-amber'
    }));
    const hasBlock = risks.some(r => r.levelText === '阻断');

    const lines = (doc.lines || []).map(l => ({
      item: l.item,
      qtyText: F.fmt0(l.qty),
      priceText: F.fmt(l.price),
      amountText: F.fmt(l.amount)
    }));

    const invList = doc.invoices || [];
    let invTotal = 0;
    const invoices = invList.map(v => {
      invTotal += v.amount;
      return {
        key: v.code + '-' + v.no,
        codeNo: v.code + ' · ' + v.no,
        seller: v.seller,
        amountText: F.fmt(v.amount)
      };
    });

    const canAct = doc.status === 'pending' && canApprove(doc, role);

    /* 处理轨迹：新单据由提交动作写入，存量单据按审批进度补出 */
    const rawLogs = doc.log && doc.log.length ? doc.log.slice() : buildLogs(doc, flow);
    const logs = rawLogs.map((l, i) => ({
      key: 'lg-' + i,
      act: l.act || '处理',
      by: l.by || '系统',
      node: l.node || (flow[doc.currentNode] || flow[flow.length - 1]).name,
      time: l.time || doc.submitDate,
      note: l.note || '',
      cls: l.act === '驳回' ? 'lg-reject' : (l.act === '通过' ? 'lg-ok' : '')
    }));

    /* 附件与回单 */
    const kinds = DATA.ATTACH_KIND || {};
    const attach = (doc.attach || []).map(a => {
      const k = kinds[a.kind] || { label: '文件', cls: 'tag-gray' };
      return { key: a.name, name: a.name, size: a.size || '', kindLabel: k.label, cls: k.cls };
    });
    const hasReceipt = !!(doc.receipt && doc.receipt.name);

    let denyTitle = '无审批权限';
    let denyDesc = '当前节点：' + curNode.name + ' · ' + curNode.who;
    if (doc.status === 'approved') {
      denyTitle = '审批已完成';
      denyDesc = '单据已推送至总部出纳，等待按主体付款';
    } else if (doc.status === 'rejected') {
      denyTitle = '单据已驳回';
      denyDesc = '已退回申请人修改，修改后重新走审批流程';
    }

    this.setData({
      found: true,
      id: doc.id,
      title: doc.title,
      statusText: st.text,
      statusClass: st.cls,
      amountText: F.fmt(doc.amount),
      taxText: F.fmt(doc.taxAmount),
      typeLabel: doc.typeLabel,
      storeName: store.name,
      applicant: doc.applicant,
      dept: doc.dept,
      submitDate: doc.submitDate,
      budgetItem: doc.budgetItem,
      note: doc.note || '',
      isPayment: !!doc.payee,
      payee: doc.payee || '',
      payBank: doc.payBank || bankOfPayee(doc.payee),
      payeeAccount: doc.payeeAccount || '',
      attach: attach,
      isPaid: doc.status === 'paid',
      hasReceipt: hasReceipt,
      receiptName: hasReceipt ? doc.receipt.name : '',
      receiptMeta: hasReceipt
        ? '流水号 ' + (doc.receipt.serial || '—') + ' · ' + (doc.receipt.by || '') + ' ' + (doc.receipt.time || '')
        : '',
      roleName: roleName,
      nodes: nodes,
      stepText: stepText,
      risks: risks,
      hasBlock: hasBlock,
      lines: lines,
      invoices: invoices,
      invoiceTotalText: F.fmt(invTotal),
      logs: logs,
      canAct: canAct,
      nodeName: curNode.name,
      nodeWho: curNode.who,
      denyTitle: denyTitle,
      denyDesc: denyDesc
    });
  },

  /* ---------- 审批通过 ---------- */
  onApprove() {
    const doc = app.docById(this.docId);
    if (!doc) return;

    if (doc.risk && doc.risk.some(r => r.level === 'block')) {
      wx.showToast({ title: '存在阻断级问题，需先处理', icon: 'none' });
      return;
    }
    if (doc.status !== 'pending' || !canApprove(doc, app.globalData.role)) {
      wx.showToast({ title: '当前身份无审批权限', icon: 'none' });
      return;
    }

    const flow = getFlow(doc);
    const role = app.globalData.role;
    doc.log = doc.log || [];
    doc.log.push({
      act: '通过',
      by: DATA.ROLES[role].name,
      node: flow[doc.currentNode].name,
      time: nowStr()
    });

    const next = doc.currentNode + 1;
    let finished = false;
    if (next >= flow.length - 1) {
      doc.currentNode = flow.length - 1;
      doc.status = 'approved';
      finished = true;
    } else {
      doc.currentNode = next;
    }

    const nf = getFlow(doc);
    wx.showToast({
      title: finished ? '审批通过，已推送至总部出纳付款' : '审批通过，已流转至「' + nf[doc.currentNode].name + '」',
      icon: 'none',
      duration: 1500
    });

    this.refresh();
    this.backLater();
  },

  /* ---------- 驳回 ---------- */
  onReject() {
    const doc = app.docById(this.docId);
    if (!doc) return;
    if (doc.status !== 'pending' || !canApprove(doc, app.globalData.role)) {
      wx.showToast({ title: '当前身份无审批权限', icon: 'none' });
      return;
    }

    const flow = getFlow(doc);
    const role = app.globalData.role;
    doc.log = doc.log || [];
    doc.log.push({
      act: '驳回',
      by: DATA.ROLES[role].name,
      node: flow[doc.currentNode].name,
      time: nowStr()
    });
    doc.status = 'rejected';

    wx.showToast({ title: '已驳回，将退回申请人修改', icon: 'none', duration: 1500 });
    this.refresh();
    this.backLater();
  },

  backLater() {
    setTimeout(function () {
      wx.navigateBack({
        delta: 1,
        fail: function () {
          wx.switchTab({ url: '/pages/workbench/workbench' });
        }
      });
    }, 900);
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.switchTab({ url: '/pages/workbench/workbench' });
      }
    });
  }
});
