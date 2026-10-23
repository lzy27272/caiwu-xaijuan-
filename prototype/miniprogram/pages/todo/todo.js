/* ================= 待办：按角色分栏的审批队列 =================
   分栏口径与工作台完全一致（approve / pay / risk / mine），
   只是移动端展示更全：风险标签、提交时间、当前节点与处理人。 */

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

Page({

  data: {
    role: 'hqfin',
    roleName: '',
    scopeText: '',
    approveCount: 0,
    approveAmountText: '0.00',
    blockCount: 0,
    tabs: [],
    tabKey: '',
    tabLabel: '',
    list: [],
    emptyText: '这一类暂时没有需要处理的事项。'
  },

  onShow() {
    this.refresh();
  },

  sumAmount(list) {
    let s = 0;
    for (let i = 0; i < list.length; i++) s += list[i].amount;
    return s;
  },

  buildTabs(role) {
    const docs = app.globalData.docs;
    const tabs = [];
    if (['manager', 'storefin', 'hqfin', 'cfo'].indexOf(role) >= 0) {
      tabs.push({
        key: 'approve',
        label: '待我审批',
        list: docs.filter(d => d.status === 'pending' && canApprove(d, role))
      });
    }
    if (['cashier', 'hqfin', 'cfo'].indexOf(role) >= 0) {
      tabs.push({
        key: 'pay',
        label: '待我付款',
        list: docs.filter(d => d.status === 'approved')
      });
    }
    tabs.push({
      key: 'risk',
      label: '异常待跟进',
      list: docs.filter(d => d.status !== 'paid' && d.risk && d.risk.length)
    });
    let mineLabel = '全部单据';
    if (role === 'staff') mineLabel = '我提交的';
    else if (role === 'manager' || role === 'storefin') mineLabel = '本店单据';
    tabs.push({
      key: 'mine',
      label: mineLabel,
      list: docs.filter(d => app.inScope(d, role))
    });
    return tabs;
  },

  rowOf(d) {
    const store = app.storeById(d.storeId);
    const flow = getFlow(d);
    const node = flow[d.currentNode] || flow[flow.length - 1];
    const block = d.risk && d.risk.some(r => r.level === 'block');
    const warn = d.risk && d.risk.some(r => r.level === 'warn');
    const st = STATUS_MAP[d.status] || STATUS_MAP.draft;
    return {
      id: d.id,
      title: d.title,
      meta: d.typeLabel + ' · ' + store.name + ' · ' + d.applicant,
      submitDate: d.submitDate,
      nodeName: node.name,
      nodeWho: node.who,
      amountText: F.fmt(d.amount),
      riskText: block ? '阻断' : (warn ? '需关注' : '无异常'),
      riskClass: block ? 'tag-red' : (warn ? 'tag-amber' : 'tag-gray'),
      statusText: st.text,
      statusClass: st.cls,
      typeLabel: d.typeLabel
    };
  },

  refresh() {
    const role = app.globalData.role;
    const roles = app.roleList();
    let roleName = '';
    for (let i = 0; i < roles.length; i++) if (roles[i].key === role) roleName = roles[i].name;

    const docs = app.globalData.docs;
    const approveList = docs.filter(d => d.status === 'pending' && canApprove(d, role));

    const tabs = this.buildTabs(role);
    let tabKey = this.data.tabKey;
    let found = false;
    for (let i = 0; i < tabs.length; i++) if (tabs[i].key === tabKey) found = true;
    if (!found) tabKey = tabs[0].key;

    let current = tabs[0];
    for (let i = 0; i < tabs.length; i++) if (tabs[i].key === tabKey) current = tabs[i];

    let emptyText = '这一类暂时没有需要处理的事项。';
    if (current.key === 'approve') emptyText = '这一类暂时没有需要处理的事项。审批人不在线时，单据会自动升级提醒，不会压在某个人抽屉里。';
    if (current.key === 'pay') emptyText = '这一类暂时没有需要处理的事项。已审批单据会在这里等待出纳按主体分批付款。';

    this.setData({
      role: role,
      roleName: roleName,
      scopeText: app.scopeLabel(role),
      approveCount: approveList.length,
      approveAmountText: F.fmt(this.sumAmount(approveList)),
      blockCount: approveList.filter(d => d.risk && d.risk.some(r => r.level === 'block')).length,
      tabs: tabs.map(t => ({ key: t.key, label: t.label, count: t.list.length })),
      tabKey: tabKey,
      tabLabel: current.label,
      list: current.list.map(d => this.rowOf(d)),
      emptyText: emptyText
    });
  },

  onTab(e) {
    this.setData({ tabKey: e.currentTarget.dataset.key });
    this.refresh();
  },

  openDoc(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goWorkbench() {
    wx.switchTab({ url: '/pages/workbench/workbench' });
  }
});
