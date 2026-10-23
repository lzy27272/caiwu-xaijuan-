/* ================= 酒店集团财务管理工作台 · 小程序原型 ================= */

const DATA = require('./utils/data.js');

const ROLE_KEYS = ['staff', 'manager', 'storefin', 'hqfin', 'cashier', 'cfo'];
const DEMO_STORE_ID = 'S01';        // 移动端演示单店（门店店长 / 门店财务口径）

App({

  globalData: {
    role: 'hqfin',                        // 默认身份：总部财务经理（可看全集团）
    roleKeys: ROLE_KEYS,
    roles: DATA.ROLES,
    stores: DATA.STORES,
    group: DATA.GROUP,
    docs: JSON.parse(JSON.stringify(DATA.DOCS)),   // 审批状态变更的唯一载体，页面只改这里
    demoStoreId: DEMO_STORE_ID,
    period: '2026-10',
    prevPeriod: '2026-09',
    workbenchDate: DATA.WORKBENCH_DATE,
    lastAccount: null                      // 「记住上次账户」：{ payee, bank, account }
  },

  onLaunch() {
    // 读取上次记住的收款账户（纯本地缓存）
    try {
      const saved = wx.getStorageSync('lastAccount');
      if (saved && saved.bank) this.globalData.lastAccount = saved;
    } catch (e) {
      this.globalData.lastAccount = null;
    }
  },

  /* ---- 记住上次收款账户 ---- */
  setLastAccount(acct) {
    this.globalData.lastAccount = acct;
    try {
      if (acct) wx.setStorageSync('lastAccount', acct);
      else wx.removeStorageSync('lastAccount');
    } catch (e) { /* 演示环境忽略存储异常 */ }
  },

  getLastAccount() {
    return this.globalData.lastAccount;
  },

  /* ---- 角色 ---- */
  roleList() {
    return ROLE_KEYS.map(k => ({
      key: k,
      name: DATA.ROLES[k].name,
      desc: DATA.ROLES[k].desc
    }));
  },

  setRole(key) {
    if (!DATA.ROLES[key]) return;
    this.globalData.role = key;
  },

  /* ---- 主数据 ---- */
  storeById(id) {
    const list = DATA.STORES;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  },

  docById(id) {
    const list = this.globalData.docs;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  },

  /* ---- 数据范围（全端统一口径） ----
     门店员工：只看本人（演示申请人：陈晓燕）
     门店店长 / 门店财务：只看本店（演示门店：城东店 S01）
     总部财务经理 / 出纳 / 财务总监：全集团 14 家 */
  inScope(doc, role) {
    const r = role || this.globalData.role;
    if (r === 'staff') return doc.applicant === '陈晓燕';
    if (r === 'manager' || r === 'storefin') return doc.storeId === DEMO_STORE_ID;
    return true;
  },

  scopeLabel(role) {
    const r = role || this.globalData.role;
    if (r === 'manager' || r === 'storefin') {
      const s = this.storeById(DEMO_STORE_ID);
      return s.name + ' · ' + s.entityName;
    }
    return '集团 14 家独立法人';
  }
});
