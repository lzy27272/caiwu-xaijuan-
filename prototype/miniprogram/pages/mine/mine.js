/* ================= 我的：身份、期间、数据范围 ================= */

const DATA = require('../../utils/data.js');
const F = require('../../utils/format.js');

const app = getApp();

Page({

  data: {
    role: 'hqfin',
    roleName: '',
    roleDesc: '',
    avatarChar: '',
    roles: [],
    roleIndex: 3,
    period: '2026-10',
    prevPeriod: '2026-09',
    scopeText: '',
    myDocsCount: 0,
    invUnused: 0,
    budgetRate: '0%',
    budgetOver: false,
    demoDate: '',
    menu: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const role = app.globalData.role;
    const roles = app.roleList();
    let roleIndex = 0;
    for (let i = 0; i < roles.length; i++) if (roles[i].key === role) roleIndex = i;
    const meta = roles[roleIndex];

    const docs = app.globalData.docs;
    const myDocsCount = docs.filter(d => app.inScope(d, role)).length;
    const invUnused = DATA.INVOICES.filter(i => i.status === 'unused').length;

    let budget = 0, used = 0, inTrans = 0;
    for (let i = 0; i < DATA.BUDGETS.length; i++) {
      budget += DATA.BUDGETS[i].budget;
      used += DATA.BUDGETS[i].used;
      inTrans += DATA.BUDGETS[i].inTrans;
    }
    const rate = (used + inTrans) / budget;

    const menu = [
      {
        key: 'exp',
        ch: '报',
        color: 'blue',
        label: '发起费用报销',
        sub: '手机拍照即传，明细可回电脑端补录',
        action: 'new-expense'
      },
      {
        key: 'pay',
        ch: '付',
        color: 'amber',
        label: '发起付款申请',
        sub: '需合同 / 验收单等依据附件',
        action: 'new-payment'
      },
      {
        key: 'inv',
        ch: '票',
        color: 'red',
        label: '发票采集',
        sub: '拍照上传，识别确认后入库',
        action: 'invadd'
      },
      {
        key: 'docs',
        ch: '单',
        color: 'blue',
        label: '我的单据',
        sub: myDocsCount + ' 张 · 含审批中与已审批',
        action: 'docs'
      },
      {
        key: 'acct',
        ch: '卡',
        color: 'teal',
        label: '收款账户',
        sub: this.acctSub(),
        action: 'acct'
      },
      {
        key: 'inv',
        ch: '票',
        color: 'red',
        label: '发票池',
        sub: invUnused + ' 张待认证 · 按主体隔离抵扣',
        action: ''
      },
      {
        key: 'budget',
        ch: '预',
        color: 'amber',
        label: '预算执行',
        sub: '含在途执行率 ' + F.pct(rate) + ' · ' + DATA.BUDGETS.length + ' 个费用项目',
        action: ''
      },
      {
        key: 'master',
        ch: '主',
        color: 'teal',
        label: '主数据',
        sub: DATA.STORES.length + ' 个独立法人主体 · 科目与供应商档案',
        action: ''
      },
      {
        key: 'about',
        ch: 'i',
        color: 'gray',
        label: '关于本原型',
        sub: '数据来源、接入方式与已知限制',
        action: 'about'
      }
    ];

    this.setData({
      role: role,
      roleName: meta.name,
      roleDesc: meta.desc,
      avatarChar: meta.name.slice(0, 1),
      roles: roles,
      roleIndex: roleIndex,
      period: app.globalData.period,
      prevPeriod: app.globalData.prevPeriod,
      scopeText: app.scopeLabel(role),
      myDocsCount: myDocsCount,
      invUnused: invUnused,
      budgetRate: F.pct(rate),
      budgetOver: rate > 1,
      demoDate: DATA.WORKBENCH_DATE,
      menu: menu
    });
  },

  onRoleChange(e) {
    const idx = Number(e.detail.value);
    const item = this.data.roles[idx];
    if (!item) return;
    app.setRole(item.key);
    this.refresh();
    wx.showToast({ title: '已切换为「' + item.name + '」', icon: 'none' });
  },

  /* 记住账户的一句摘要 */
  acctSub() {
    const last = app.globalData.lastAccount;
    if (last && last.bank) return '已记住 ' + last.bank + ' · 报销时自动带出';
    return '报销时可记住上次账户，下次自动带出';
  },

  /* 收款账户管理：查看 / 清除已记住的账户 */
  onAcct() {
    const last = app.globalData.lastAccount;
    if (!last || !last.bank) {
      wx.showModal({
        title: '尚未记住账户',
        content: '在费用报销页勾选「记住本次账户」，系统会记住开户行与账号，下次新建时自动带出，避免每次重填。\n\n出于安全考虑，正式版只记住账户与开户行，不记住户名；更换设备需重新验证。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    const self = this;
    wx.showModal({
      title: '已记住的收款账户',
      content: '收款人：' + last.payee + '\n开户行：' + last.bank + '\n账号：' + last.account + '\n\n清除后，下次新建报销需重新填写账户信息。',
      confirmText: '清除',
      cancelText: '保留',
      success(res) {
        if (res.confirm) {
          app.setLastAccount(null);
          self.refresh();
          wx.showToast({ title: '已清除记住的账户', icon: 'none' });
        }
      }
    });
  },

  onMenu(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.menu[idx];
    if (!item) return;

    if (item.action === 'docs') {
      wx.switchTab({ url: '/pages/docs/docs' });
      return;
    }

    if (item.action === 'new-expense') {
      wx.navigateTo({ url: '/pages/newdoc/newdoc?type=expense' });
      return;
    }

    if (item.action === 'new-payment') {
      wx.navigateTo({ url: '/pages/newdoc/newdoc?type=payment' });
      return;
    }

    if (item.action === 'invadd') {
      wx.navigateTo({ url: '/pages/invadd/invadd' });
      return;
    }

    if (item.action === 'acct') {
      this.onAcct();
      return;
    }

    if (item.action === 'about') {
      wx.showModal({
        title: '关于本原型',
        content: '本原型为纯前端演示：全部数字来自本地模拟数据（utils/data.js），不连接任何真实财务系统；审批动作只修改本机内存，重启小程序即还原。\n\n正式版接入：utils/data.js 改为 wx.request 调用后端接口；utils/flow.js 的审批链改由后端下发；登录与角色通过 wx.login 换取会话后由后端返回权限，前端只做展示与校验。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    wx.showToast({ title: '原型未开放该页面', icon: 'none' });
  }
});
