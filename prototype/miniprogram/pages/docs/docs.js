/* ================= 单据：全量清单与状态筛选 ================= */

const DATA = require('../../utils/data.js');
const F = require('../../utils/format.js');

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
    scopeText: '',
    total: 0,
    totalAmountText: '0.00',
    filters: [],
    filterKey: 'all',
    list: [],
    emptyText: '该状态下暂无单据。'
  },

  onShow() {
    this.refresh();
  },

  sumAmount(list) {
    let s = 0;
    for (let i = 0; i < list.length; i++) s += list[i].amount;
    return s;
  },

  rowOf(d) {
    const store = app.storeById(d.storeId);
    const st = STATUS_MAP[d.status] || STATUS_MAP.draft;
    return {
      id: d.id,
      title: d.title,
      meta: d.typeLabel + ' · ' + store.name + ' · ' + d.applicant,
      submitDate: d.submitDate,
      amountText: F.fmt(d.amount),
      statusText: st.text,
      statusClass: st.cls
    };
  },

  refresh() {
    const docs = app.globalData.docs;

    const filters = [
      { key: 'all',      label: '全部',   count: docs.length },
      { key: 'pending',  label: '审批中', count: docs.filter(d => d.status === 'pending').length },
      { key: 'approved', label: '已审批', count: docs.filter(d => d.status === 'approved').length },
      { key: 'rejected', label: '已驳回', count: docs.filter(d => d.status === 'rejected').length }
    ];

    let filterKey = this.data.filterKey;
    let exists = false;
    for (let i = 0; i < filters.length; i++) if (filters[i].key === filterKey) exists = true;
    if (!exists) filterKey = 'all';

    const list = filterKey === 'all'
      ? docs.slice()
      : docs.filter(d => d.status === filterKey);

    this.setData({
      scopeText: '集团 ' + DATA.STORES.length + ' 家独立法人',
      total: docs.length,
      totalAmountText: F.fmt(this.sumAmount(docs)),
      filters: filters,
      filterKey: filterKey,
      list: list.map(d => this.rowOf(d)),
      emptyText: '该状态下暂无单据。'
    });
  },

  onFilter(e) {
    this.setData({ filterKey: e.currentTarget.dataset.key });
    this.refresh();
  },

  openDoc(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  /* 底部「+」：选报销或付款 */
  onNew() {
    const self = this;
    wx.showActionSheet({
      itemList: ['新建费用报销', '新建付款申请'],
      success(res) {
        self.goNew(res.tapIndex === 0 ? 'expense' : 'payment');
      }
    });
  },

  goNew(type) {
    wx.navigateTo({ url: '/pages/newdoc/newdoc?type=' + type });
  }
});
