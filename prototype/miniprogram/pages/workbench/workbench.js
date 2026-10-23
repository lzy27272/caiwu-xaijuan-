/* ================= 工作台：角色化聚合首页 =================
   口径与 PC 端 assets/view-workbench.js 保持一致：
   同一批单据（globalData.docs）、同一套汇总（STORES / GROUP / BUDGETS / CALENDAR / NOTICES），
   切换角色后整页用 setData 重算，不做二次口径。 */

const DATA = require('../../utils/data.js');
const F = require('../../utils/format.js');
const { getFlow, canApprove } = require('../../utils/flow.js');

const app = getApp();

/* 日历类型 → 文案 + 标签色 */
const CAL_TYPE = {
  tax:      { label: '税务', cls: 'tag-amber' },
  pay:      { label: '付款', cls: 'tag-blue' },
  close:    { label: '关账', cls: 'tag-teal' },
  contract: { label: '合同', cls: 'tag-gray' },
  ar:       { label: '应收', cls: 'tag-red' }
};

/* 快捷入口：按角色过滤，page 为空表示原型未开放
   newdoc 表示已支持在手机上直接发起该类单据（跳 pages/newdoc） */
const QUICK = [
  { key:'exp',   label:'费用报销', ch:'报', color:'blue',  page:'newdoc-exp', roles:['staff','manager','storefin','hqfin','cfo'] },
  { key:'pay',   label:'付款申请', ch:'付', color:'amber', page:'newdoc-pay', roles:['manager','storefin','hqfin','cfo','cashier'] },
  { key:'inv',   label:'发票采集', ch:'票', color:'red',   page:'invadd',  roles:['staff','storefin','hqfin','cfo'] },
  { key:'vouch', label:'凭证中心', ch:'账', color:'blue',  page:'',     roles:['storefin','hqfin','cfo'] },
  { key:'pl',    label:'损益表',   ch:'损', color:'teal',  page:'',     roles:['manager','storefin','hqfin','cfo'] },
  { key:'budget',label:'预算',     ch:'预', color:'amber', page:'',     roles:['manager','storefin','hqfin','cfo'] },
  { key:'close', label:'结账',     ch:'结', color:'teal',  page:'',     roles:['hqfin','cfo'] },
  { key:'master',label:'主数据',   ch:'主', color:'gray',  page:'',     roles:['hqfin','cfo'] }
];

Page({

  data: {
    role: 'hqfin',
    roleName: '',
    roleDesc: '',
    greeting: '',
    dateText: '',
    summary: '',
    roles: [],
    roleIndex: 3,
    period: '2026-10',
    prevPeriod: '2026-09',
    todoBadge: 0,
    kpis: [],
    tabs: [],
    tabKey: '',
    tabLabel: '',
    todos: [],
    todoTotal: 0,
    quick: [],
    calendar: [],
    notices: []
  },

  onShow() {
    this.refresh();
  },

  /* ---------- 汇总工具 ---------- */
  sumAmount(list) {
    let s = 0;
    for (let i = 0; i < list.length; i++) s += list[i].amount;
    return s;
  },

  budgetAgg() {
    const list = DATA.BUDGETS;
    let budget = 0, used = 0, inTrans = 0;
    for (let i = 0; i < list.length; i++) {
      budget += list[i].budget;
      used += list[i].used;
      inTrans += list[i].inTrans;
    }
    return { budget: budget, used: used, inTrans: inTrans, rate: (used + inTrans) / budget };
  },

  /* ---------- 待办分栏（与 PC 端 wbTabs 同规则） ---------- */
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

  rowOf(d, role) {
    const store = app.storeById(d.storeId);
    const flow = getFlow(d);
    const node = flow[d.currentNode] || flow[flow.length - 1];
    const block = d.risk && d.risk.some(r => r.level === 'block');
    const warn = d.risk && d.risk.some(r => r.level === 'warn');
    const mine = canApprove(d, role);
    return {
      id: d.id,
      title: d.title,
      meta: d.typeLabel + ' · ' + store.name + ' · ' + d.applicant,
      nodeName: node.name + ' · ' + node.who,
      amountText: F.fmt(d.amount),
      riskText: block ? '阻断' : (warn ? '需关注' : ''),
      riskClass: block ? 'tag-red' : 'tag-amber',
      actionText: d.status === 'approved' ? (role === 'cashier' ? '去付款' : '查看') : (mine ? '去处理' : '查看')
    };
  },

  /* ---------- KPI（分角色口径，全部由真实数据算） ---------- */
  buildKpis(role) {
    const docs = app.globalData.docs;
    const store = app.storeById(app.globalData.demoStoreId);
    const pending = docs.filter(d => d.status === 'pending' && canApprove(d, role));
    const payable = docs.filter(d => d.status === 'approved');
    const bg = this.budgetAgg();
    const out = [];

    if (role === 'staff') {
      const mine = docs.filter(d => d.applicant === '陈晓燕');
      const myPending = mine.filter(d => d.status === 'pending');
      const myPaid = mine.filter(d => d.status === 'paid');
      const myRejected = mine.filter(d => d.status === 'rejected');
      out.push({
        label: '我提交的单据', value: mine.length + ' 张',
        foot: '审批中 ' + myPending.length + ' 张 · 已完成 ' + myPaid.length + ' 张',
        color: 'blue', target: 'docs'
      });
      out.push({
        label: '在途报销金额', value: '¥' + F.fmt0(this.sumAmount(myPending)),
        foot: '尚在审批流程中，付款后到工资卡',
        color: 'teal', target: 'docs'
      });
      out.push({
        label: '待我补充资料', value: myRejected.length + ' 张',
        foot: '驳回后重新提交需重走审批',
        color: 'amber', target: 'docs'
      });
      out.push({
        label: '发票池可勾选', value: DATA.INVOICES.filter(i => i.status === 'unused').length + ' 张',
        foot: '报销时直接勾选，无需重复录入',
        color: 'gray', target: ''
      });
    } else if (role === 'manager') {
      out.push({
        label: '待我审批', value: pending.length + ' 张',
        foot: '合计 ¥' + F.fmt0(this.sumAmount(pending)),
        color: 'amber', target: 'todo'
      });
      out.push({
        label: store.name + ' 9 月收入', value: '¥' + F.wan(store.revenueNet) + ' 万',
        foot: '不含税 · 同比 ' + (store.revYoY >= 0 ? '+' : '') + (store.revYoY * 100).toFixed(1) + '%',
        color: 'blue', target: ''
      });
      out.push({
        label: 'GOP 率', value: F.pct(store.gopRate),
        foot: 'GOP ¥' + F.wan(store.gop) + ' 万 · 集团均值 ' + F.pct(DATA.GROUP.gopRate),
        color: 'teal', target: ''
      });
      out.push({
        label: '费用预算执行', value: F.pct(bg.rate),
        foot: '含在途 ¥' + F.wan(bg.inTrans) + ' 万 · 年度 ¥' + F.wan(bg.budget) + ' 万',
        color: bg.rate > 0.95 ? 'red' : 'amber', target: ''
      });
    } else if (role === 'storefin') {
      const badChecks = DATA.CLOSE_CHECKS.filter(c => c.bad.indexOf(store.id) >= 0);
      out.push({
        label: '待我初审', value: pending.length + ' 张',
        foot: '合计 ¥' + F.fmt0(this.sumAmount(pending)),
        color: 'amber', target: 'todo'
      });
      out.push({
        label: '本月发票待认证', value: DATA.INVOICES.filter(i => i.status === 'unused').length + ' 张',
        foot: '认证后才进入当期抵扣台账',
        color: 'red', target: ''
      });
      out.push({
        label: '本店关账检查',
        value: badChecks.length ? badChecks.length + ' 项未通过' : '全部通过',
        foot: badChecks.length ? badChecks[0].label : '9 月已关账 · 10 月 31 日启动',
        color: badChecks.length ? 'red' : 'teal', target: ''
      });
      out.push({
        label: '本店费用预算执行', value: F.pct(bg.rate),
        foot: '含在途 ¥' + F.wan(bg.inTrans) + ' 万 · 可用 ¥' + F.wan(bg.budget - bg.used - bg.inTrans) + ' 万',
        color: bg.rate > 0.95 ? 'red' : 'amber', target: ''
      });
    } else if (role === 'cashier') {
      out.push({
        label: '待付款', value: payable.length + ' 笔',
        foot: '合计 ¥' + F.fmt0(this.sumAmount(payable)) + ' · 须按主体分批',
        color: 'amber', target: 'todo'
      });
      out.push({
        label: '集团账户余额', value: '¥' + F.wan(DATA.GROUP.cash) + ' 万',
        foot: '14 个主体分别开户，不可混用',
        color: 'teal', target: ''
      });
      out.push({
        label: '应收超 90 天', value: '¥' + F.wan(DATA.GROUP.arOver90) + ' 万',
        foot: '应收合计 ¥' + F.wan(DATA.GROUP.receivable) + ' 万 · 按主体催收',
        color: 'red', target: ''
      });
      out.push({
        label: '应付账款余额', value: '¥' + F.wan(DATA.GROUP.payable) + ' 万',
        foot: '按主体分别排款，禁止跨主体勾选',
        color: 'blue', target: ''
      });
    } else if (role === 'hqfin') {
      const failStores = DATA.STORES.filter(st => DATA.CLOSE_CHECKS.some(c => c.bad.indexOf(st.id) >= 0));
      const vatSum = DATA.STORES.reduce((a, x) => a + x.vat, 0);
      out.push({
        label: '待我终审', value: pending.length + ' 张',
        foot: '合计 ¥' + F.fmt0(this.sumAmount(pending)),
        color: 'amber', target: 'todo'
      });
      out.push({
        label: '14 家关账进度', value: (DATA.STORES.length - failStores.length) + ' / ' + DATA.STORES.length,
        foot: failStores.length ? '未通过：' + failStores.map(x => x.name).join('、') : '全部通过',
        color: failStores.length ? 'red' : 'teal', target: ''
      });
      out.push({
        label: '集团 9 月收入', value: '¥' + F.wan(DATA.GROUP.revenueNet) + ' 万',
        foot: '不含税 · GOP 率 ' + F.pct(DATA.GROUP.gopRate) + ' · 净利率 ' + F.pct(DATA.GROUP.netMargin),
        color: 'blue', target: ''
      });
      out.push({
        label: '应缴增值税（9 月）', value: '¥' + F.wan(vatSum) + ' 万',
        foot: '已申报 · 10 月 15 日截止',
        color: 'teal', target: ''
      });
    } else {
      out.push({
        label: '待我审批', value: pending.length + ' 张',
        foot: '合计 ¥' + F.fmt0(this.sumAmount(pending)),
        color: 'amber', target: 'todo'
      });
      out.push({
        label: '集团 9 月收入', value: '¥' + F.wan(DATA.GROUP.revenueNet) + ' 万',
        foot: 'RevPAR ¥' + DATA.GROUP.revpar + ' · 出租率 ' + F.pct(DATA.GROUP.occ),
        color: 'blue', target: ''
      });
      out.push({
        label: '费用预算执行', value: F.pct(bg.rate),
        foot: '含在途 ¥' + F.wan(bg.inTrans) + ' 万 · 可用 ¥' + F.wan(bg.budget - bg.used - bg.inTrans) + ' 万',
        color: bg.rate > 0.95 ? 'red' : 'amber', target: ''
      });
      out.push({
        label: '集团资金余额', value: '¥' + F.wan(DATA.GROUP.cash) + ' 万',
        foot: '应收 ¥' + F.wan(DATA.GROUP.receivable) + ' 万 · 应付 ¥' + F.wan(DATA.GROUP.payable) + ' 万',
        color: 'teal', target: ''
      });
    }
    return out;
  },

  /* ---------- 主刷新 ---------- */
  refresh() {
    const role = app.globalData.role;
    const roles = app.roleList();
    let roleIndex = 0;
    for (let i = 0; i < roles.length; i++) {
      if (roles[i].key === role) roleIndex = i;
    }
    const roleMeta = roles[roleIndex];

    const docs = app.globalData.docs;
    const pending = docs.filter(d => d.status === 'pending' && canApprove(d, role));
    const payable = docs.filter(d => d.status === 'approved');
    const todoBadge = pending.length + (role === 'cashier' ? payable.length : 0);

    const wd = DATA.WORKBENCH_DATE;
    const dateText = wd.slice(0, 4) + ' 年 ' + Number(wd.slice(5, 7)) + ' 月 ' + Number(wd.slice(8, 10)) +
      ' 日 ' + F.weekday(wd) + ' · 集团 ' + DATA.STORES.length + ' 家独立法人';

    /* 一句话摘要 */
    const todayCal = DATA.CALENDAR.filter(c =>
      c.roles.indexOf(role) >= 0 && c.state !== 'done' && F.dayDiff(c.date) === 0).length;
    const parts = [];
    let total = 0;
    if (role === 'staff') {
      const mine = docs.filter(d => d.applicant === '陈晓燕');
      const myPending = mine.filter(d => d.status === 'pending');
      total = myPending.length;
      if (myPending.length) parts.push(myPending.length + ' 张我提交的单据在审批中');
    } else {
      total = pending.length + (role === 'cashier' ? payable.length : 0) + todayCal;
      if (pending.length) parts.push(pending.length + ' 张单据待你审批');
      if (role === 'cashier' && payable.length) parts.push(payable.length + ' 笔付款待你执行');
      if (todayCal) parts.push(todayCal + ' 个节点今天到期');
    }
    const summary = total
      ? '今天有 ' + total + ' 件事需要你处理，其中' + parts.join('、')
      : '今天没有必须处理的事项，可以看看预算执行与关账进度。';

    /* 待办分栏 */
    const tabs = this.buildTabs(role);
    let tabKey = this.data.tabKey;
    let found = false;
    for (let i = 0; i < tabs.length; i++) if (tabs[i].key === tabKey) found = true;
    if (!found) tabKey = tabs[0].key;
    let current = tabs[0];
    for (let i = 0; i < tabs.length; i++) if (tabs[i].key === tabKey) current = tabs[i];

    /* 快捷入口 */
    const quick = QUICK.filter(q => q.roles.indexOf(role) >= 0).map(q => ({
      key: q.key, label: q.label, ch: q.ch, color: q.color, page: q.page
    }));

    /* 财务日历 */
    const calList = DATA.CALENDAR
      .filter(c => c.roles.indexOf(role) >= 0)
      .slice()
      .sort((a, b) => a.date < b.date ? -1 : 1)
      .slice(0, 6);
    const calendar = calList.map(c => {
      const t = CAL_TYPE[c.type] || { label: '其他', cls: 'tag-gray' };
      const diff = F.dayDiff(c.date);
      const done = c.state === 'done';
      return {
        key: c.date + c.title,
        dd: c.date.slice(8, 10),
        mm: Number(c.date.slice(5, 7)) + ' 月',
        title: c.title,
        typeLabel: t.label,
        typeCls: t.cls,
        rel: done ? '已完成' : F.relDay(c.date),
        done: done,
        urgent: !done && diff >= 0 && diff <= 2
      };
    });

    /* 通知与制度 */
    const notices = DATA.NOTICES.filter(n => n.roles.indexOf(role) >= 0).slice(0, 3).map(n => ({
      id: n.id, tag: n.tag, title: n.title, date: n.date, body: n.body
    }));

    this.setData({
      role: role,
      roleName: roleMeta.name,
      roleDesc: roleMeta.desc,
      greeting: F.greeting(),
      dateText: dateText,
      summary: summary,
      roles: roles,
      roleIndex: roleIndex,
      period: app.globalData.period,
      prevPeriod: app.globalData.prevPeriod,
      todoBadge: todoBadge,
      kpis: this.buildKpis(role),
      tabs: tabs.map(t => ({ key: t.key, label: t.label, count: t.list.length })),
      tabKey: tabKey,
      todos: current.list.slice(0, 6).map(d => this.rowOf(d, role)),
      todoTotal: current.list.length,
      quick: quick,
      calendar: calendar,
      notices: notices
    });
  },

  /* ---------- 交互 ---------- */
  onRoleChange(e) {
    const idx = Number(e.detail.value);
    const item = this.data.roles[idx];
    if (!item) return;
    app.setRole(item.key);
    this.setData({ tabKey: '' });
    this.refresh();
    wx.showToast({ title: '已切换为「' + item.name + '」', icon: 'none' });
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ tabKey: key });
    this.refresh();
  },

  openDoc(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  goTodo() {
    wx.switchTab({ url: '/pages/todo/todo' });
  },

  onKpi(e) {
    const target = e.currentTarget.dataset.target;
    if (target === 'todo') { wx.switchTab({ url: '/pages/todo/todo' }); return; }
    if (target === 'docs') { wx.switchTab({ url: '/pages/docs/docs' }); return; }
    wx.showToast({ title: '原型未开放该页面', icon: 'none' });
  },

  onQuick(e) {
    const page = e.currentTarget.dataset.page;
    if (page === 'docs') { wx.switchTab({ url: '/pages/docs/docs' }); return; }
    if (page === 'newdoc-exp') { this.goNew('expense'); return; }
    if (page === 'newdoc-pay') { this.goNew('payment'); return; }
    if (page === 'invadd') { wx.navigateTo({ url: '/pages/invadd/invadd' }); return; }
    wx.showToast({ title: '原型未开放该页面', icon: 'none' });
  },

  /* 发起单据：移动端第一步只填核心信息，明细可在电脑端补录 */
  goNew(type) {
    wx.navigateTo({ url: '/pages/newdoc/newdoc?type=' + type });
  },

  onNotice(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const n = this.data.notices[idx];
    if (!n) return;
    wx.showModal({
      title: n.title,
      content: n.body,
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
