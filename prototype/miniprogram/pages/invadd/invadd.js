/* ================= 发票采集（小程序端） =================
   与 PC 端 assets/view-invadd.js 同一套口径，只是把「拖入」换成「拍照/相册/聊天文件」：
     · 上传与录入分两步，OCR 结果必须人工确认才能入库
     · 税额只取票面实际值，不按税率倒算
     · 查重放在入库前，命中直接挡在门外
   移动端的核心价值是「当场拍」——员工在库房验收、在餐厅结账时就能把票录进来，
   回到电脑前只剩确认，不用积压到月底一次性补。 */

const DATA = require('../../utils/data.js');

const app = getApp();

/* 待识别票据样例：模拟拍照/聊天文件传来的票 */
const INBOX = [
  {
    id: 'N1', name: '微信图片_20261020_0912.jpg', size: '2.4 MB', kind: 'img',
    done: false,
    ocr: {
      type: '电子发票（普通）', code: '052002600111', no: '33481907', date: '2026-10-20',
      seller: '贵阳清源商贸有限公司', amount: '2860.00', tax: '161.89', rate: 0.06,
      category: '客房物料', storeId: 'S01',
      low: ['seller', 'tax']
    }
  },
  {
    id: 'N2', name: '高速通行费电子发票.pdf', size: '186 KB', kind: 'pdf',
    done: false,
    ocr: {
      type: '增值税专用发票', code: '052001900288', no: '70112345', date: '2026-10-18',
      seller: '贵州高速公路集团有限公司', amount: '320.00', tax: '18.11', rate: 0.06,
      category: '差旅费', storeId: 'S07',
      low: []
    }
  },
  {
    id: 'N3', name: '餐饮消费小票.jpg', size: '1.1 MB', kind: 'img',
    done: false,
    ocr: {
      type: '增值税普通发票', code: '052002600334', no: '90811223', date: '2026-10-19',
      seller: '贵阳悦膳餐饮管理有限公司', amount: '1860.00', tax: '105.28', rate: 0.06,
      category: '业务招待', storeId: 'S12',
      low: []
    }
  }
];

const CATS = ['客房物料', '办公费', '办公设备', '维修保养', '洗涤服务', '餐饮原材料',
  '广告推广', '房屋租赁', '物料消耗', '水电燃气', '通讯费', '业务招待', '员工福利', '差旅费'];

const RATE_OPTS = [0.13, 0.09, 0.06, 0.03, 0.01, 0];
const TYPE_OPTS = ['增值税专用发票', '增值税普通发票', '电子发票（普通）', '铁路电子客票', '航空运输电子客票行程单'];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function deductOf(cat) {
  const r = DATA.DEDUCT_RULE && DATA.DEDUCT_RULE[cat];
  if (!r) return { deduct: 'yes', reason: '' };
  return { deduct: r.deduct, reason: r.reason || '' };
}

/* 查重：票号是否已存在于发票池 */
function dupOf(code, no) {
  const hit = (DATA.INVOICES || []).filter(iv => iv.code === code && iv.no === no)[0];
  if (!hit) return null;
  const s = app.storeById(hit.storeId);
  return {
    storeName: s ? s.name : '—',
    docId: hit.docId || '—',
    date: hit.date
  };
}

Page({

  data: {
    inbox: [],
    waitCount: 0,
    doneCount: 0,

    /* 编辑态 */
    editing: false,
    cur: null,
    lowKeys: [],
    dup: null,
    issues: [],
    deduct: 'yes',
    deductReason: '',
    storeNames: [],
    storeIndex: 0,
    catIndex: 0,
    rateIndex: 0,
    typeIndex: 0,
    storeEntity: '',
    storeTaxNo: '',

    cats: CATS,
    rates: RATE_OPTS.map(r => (r * 100).toFixed(0) + '%'),
    types: TYPE_OPTS
  },

  onLoad() {
    this.refresh();
  },

  refresh() {
    const inbox = INBOX.map(x => Object.assign({}, x));
    this.setData({
      inbox,
      waitCount: inbox.filter(x => !x.done).length,
      doneCount: inbox.filter(x => x.done).length
    });
  },

  /* ---------- 上传 ---------- */
  onCamera() {
    const n = INBOX.length + 1;
    INBOX.push({
      id: 'B' + n, name: '拍照_' + Date.now().toString().slice(-6) + '.jpg',
      size: '2.1 MB', kind: 'img', done: false,
      ocr: {
        type: '增值税普通发票', code: '0520026' + (30000 + n), no: String(33490000 + n * 137),
        date: todayStr(), seller: '待识别销售方', amount: '0.00', tax: '0.00', rate: 0.06,
        category: '办公费', storeId: app.globalData.demoStoreId || 'S01', low: []
      }
    });
    this.refresh();
    wx.showToast({ title: '已上传，点击识别', icon: 'none' });
  },

  onAlbum() { this.onCamera(); },

  /* ---------- 识别 ---------- */
  onOcr(e) {
    const id = e.currentTarget.dataset.id;
    const it = INBOX.filter(x => x.id === id)[0];
    if (!it) return;
    it.done = true;
    this.refresh();
    wx.showToast({ title: '识别完成，请核对', icon: 'none' });
    setTimeout(() => this.openEdit(id), 500);
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    const i = INBOX.findIndex(x => x.id === id);
    if (i >= 0) INBOX.splice(i, 1);
    this.refresh();
  },

  /* ---------- 打开确认页 ---------- */
  openEdit(id) {
    const it = INBOX.filter(x => x.id === id)[0];
    if (!it) return;
    this.setCur(it.ocr, it.id, it.name, it.ocr.low || []);
  },

  onManual() {
    this.setCur({
      type: '增值税专用发票', code: '', no: '', date: todayStr(), seller: '',
      amount: '0.00', tax: '0.00', rate: 0.13, category: '办公费',
      storeId: app.globalData.demoStoreId || 'S01'
    }, '', '手工录入', []);
  },

  setCur(ocr, id, fileName, lowKeys) {
    const storeIndex = Math.max(0, DATA.STORES.findIndex(s => s.id === ocr.storeId));
    const s = DATA.STORES[storeIndex];
    this.setData({
      editing: true,
      cur: Object.assign({}, ocr),
      curId: id,
      curFile: fileName,
      lowKeys,
      catIndex: Math.max(0, CATS.indexOf(ocr.category)),
      rateIndex: Math.max(0, RATE_OPTS.indexOf(ocr.rate)),
      typeIndex: Math.max(0, TYPE_OPTS.indexOf(ocr.type)),
      storeIndex,
      storeNames: DATA.STORES.map(x => x.name + ' · ' + x.entityName),
      storeEntity: s ? s.entityName : '',
      storeTaxNo: s ? s.taxNo : ''
    });
    this.check();
  },

  /* 实时校验：查重 + 税额自洽 + 抵扣判定 */
  check() {
    const o = this.data.cur;
    if (!o) return;
    const dup = dupOf(o.code, o.no);
    const dd = deductOf(o.category);

    const issues = [];
    const amt = parseFloat(o.amount) || 0;
    const tax = parseFloat(o.tax) || 0;
    if (!amt) issues.push('金额为 0，请确认是否填写');
    if (tax > 0 && o.rate > 0) {
      const expect = amt / (1 + o.rate) * o.rate;
      if (Math.abs(expect - tax) > Math.max(1, tax * 0.05)) {
        issues.push('税额与税率不匹配：按 ' + (o.rate * 100).toFixed(0) + '% 反算约 ¥' +
          expect.toFixed(2) + '，票面 ¥' + tax.toFixed(2) + '。请以票面为准。');
      }
    }
    if (!o.code || !o.no) issues.push('发票代码/号码不完整，无法参与查重');

    this.setData({ dup, issues, deduct: dd.deduct, deductReason: dd.reason });
  },

  onField(e) {
    const k = e.currentTarget.dataset.k;
    const cur = Object.assign({}, this.data.cur);
    cur[k] = e.detail.value;
    // 人工改过的字段不再标黄
    const lowKeys = this.data.lowKeys.filter(x => x !== k);
    this.setData({ cur, lowKeys });
    this.check();
  },

  onStore(e) {
    const i = parseInt(e.detail.value, 10);
    const s = DATA.STORES[i];
    const cur = Object.assign({}, this.data.cur, { storeId: s.id });
    this.setData({ storeIndex: i, cur, storeEntity: s.entityName, storeTaxNo: s.taxNo });
    this.check();
  },

  onCat(e) {
    const i = parseInt(e.detail.value, 10);
    const cur = Object.assign({}, this.data.cur, { category: CATS[i] });
    this.setData({ catIndex: i, cur });
    this.check();
  },

  onRate(e) {
    const i = parseInt(e.detail.value, 10);
    const cur = Object.assign({}, this.data.cur, { rate: RATE_OPTS[i] });
    this.setData({ rateIndex: i, cur });
    this.check();
  },

  onType(e) {
    const i = parseInt(e.detail.value, 10);
    const cur = Object.assign({}, this.data.cur, { type: TYPE_OPTS[i] });
    this.setData({ typeIndex: i, cur });
  },

  onCancel() {
    this.setData({ editing: false, cur: null });
  },

  /* ---------- 入库 ---------- */
  onSubmit() {
    const o = this.data.cur;
    if (!o.code || !o.no) {
      wx.showToast({ title: '发票代码和号码必填', icon: 'none' });
      return;
    }
    if (this.data.dup) {
      wx.showToast({ title: '查重未通过，不能入库', icon: 'none' });
      return;
    }
    const amt = parseFloat(o.amount) || 0;
    const tax = parseFloat(o.tax) || 0;
    const dd = deductOf(o.category);

    const iv = {
      id: 'I' + (100 + DATA.INVOICES.length),
      code: o.code, no: o.no, date: o.date, seller: o.seller,
      amount: amt, tax: tax, rate: o.rate, type: o.type,
      status: 'unused', storeId: o.storeId, docId: '',
      category: o.category, deduct: dd.deduct,
      deductReason: dd.reason || '',
      source: this.data.curId ? 'OCR 识别' : '手工录入',
      createdBy: (app.globalData.roleName || '门店员工')
    };
    DATA.INVOICES.unshift(iv);

    if (this.data.curId) {
      const i = INBOX.findIndex(x => x.id === this.data.curId);
      if (i >= 0) INBOX.splice(i, 1);
    }
    this.setData({ editing: false, cur: null });
    this.refresh();
    wx.showToast({ title: '已入库', icon: 'success' });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  }
});
