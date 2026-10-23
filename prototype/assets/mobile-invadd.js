/* ================= 手机预览：发票采集 =================
   与小程序 pages/invadd/ 同口径，供浏览器内预览使用。
   三步：上传 → 识别 → 人工确认入库；查重挡在入库前。 */

const IA = {
  box: [],
  cur: null,      // { ocr, id, fileName, lowKeys }
  inited: false
};

const IA_INBOX = [
  { id:'N1', name:'微信图片_20261020_0912.jpg', size:'2.4 MB', kind:'img', done:false,
    ocr:{ type:'电子发票（普通）', code:'052002600111', no:'33481907', date:'2026-10-20',
          seller:'贵阳清源商贸有限公司', amount:2860.00, tax:161.89, rate:.06,
          category:'客房物料', storeId:'S01', low:['seller','tax'] } },
  { id:'N2', name:'高速通行费电子发票.pdf', size:'186 KB', kind:'pdf', done:false,
    ocr:{ type:'增值税专用发票', code:'052001900288', no:'70112345', date:'2026-10-18',
          seller:'贵州高速公路集团有限公司', amount:320.00, tax:18.11, rate:.06,
          category:'差旅费', storeId:'S07', low:[] } },
  { id:'N3', name:'餐饮消费小票.jpg', size:'1.1 MB', kind:'img', done:false,
    ocr:{ type:'增值税普通发票', code:'052002600334', no:'90811223', date:'2026-10-19',
          seller:'贵阳悦膳餐饮管理有限公司', amount:1860.00, tax:105.28, rate:.06,
          category:'业务招待', storeId:'S12', low:[] } }
];

const IA_CATS = ['客房物料','办公费','办公设备','维修保养','洗涤服务','餐饮原材料',
  '广告推广','房屋租赁','物料消耗','水电燃气','通讯费','业务招待','员工福利','差旅费'];
const IA_RATES = [.13, .09, .06, .03, .01, 0];
const IA_TYPES = ['增值税专用发票','增值税普通发票','电子发票（普通）','铁路电子客票','航空运输电子客票行程单'];

function iaInit(){
  if (IA.inited) return;
  IA.box = IA_INBOX.map(x => JSON.parse(JSON.stringify(x)));
  IA.inited = true;
}
function iaToday(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function iaDeduct(cat){
  const r = DEDUCT_RULE[cat];
  return r ? r : { deduct:'yes', reason:'' };
}
function iaDup(o){
  const hit = INVOICES.find(iv => iv.code === o.code && iv.no === o.no);
  if (!hit) return null;
  const s = storeById(hit.storeId);
  return { iv: hit, storeName: s ? s.name : '—', docId: hit.docId || '—', date: hit.date };
}
function iaIssues(o){
  const out = [];
  const amt = Number(o.amount) || 0, tax = Number(o.tax) || 0;
  if (!amt) out.push('金额为 0，请确认是否填写');
  if (tax > 0 && o.rate > 0){
    const expect = amt / (1 + o.rate) * o.rate;
    if (Math.abs(expect - tax) > Math.max(1, tax * .05))
      out.push(`税额与税率不匹配：按 ${(o.rate*100).toFixed(0)}% 反算约 ¥${expect.toFixed(2)}，票面 ¥${tax.toFixed(2)}。请以票面为准。`);
  }
  if (!o.code || !o.no) out.push('发票代码/号码不完整，无法参与查重');
  return out;
}

/* ---------- 列表态 ---------- */
function pageInvAdd(){
  iaInit();
  const wait = IA.box.filter(x => !x.done).length;
  const done = IA.box.filter(x => x.done).length;

  const list = IA.box.map(b => `
    <div class="it">
      <div class="it-ico ${b.kind}">${b.kind === 'img' ? 'IMG' : 'PDF'}</div>
      <div class="it-mid">
        <div class="it-nm">${e(b.name)}</div>
        <div class="it-sub">${b.done
          ? `${e(b.ocr.seller)} · ¥${fmt(b.ocr.amount)}`
          : `${b.size} · 待识别`}</div>
      </div>
      ${b.done
        ? `<div class="it-b it-b-main" onclick="Mp.iaOpen('${b.id}')">确认</div>`
        : `<div class="it-b" onclick="Mp.iaOcr('${b.id}')">识别</div>`}
      <div class="it-x" onclick="Mp.iaDrop('${b.id}')">×</div>
    </div>`).join('');

  return `<div class="ia">
    <div class="notice notice-blue">
      <div>上传只负责把票弄进系统，<b>识别结果要人确认才入库</b>。
      <div class="ent-sub">纸质票请平铺拍摄、避开反光；电子发票（PDF）识别最准</div></div>
    </div>

    <div class="card up">
      <div class="up-ico">＋</div>
      <div class="up-t">上传发票</div>
      <div class="up-s">单张不超过 10 MB</div>
      <div class="up-btns">
        <div class="up-b up-b-main" onclick="Mp.iaAdd('img')">拍照</div>
        <div class="up-b" onclick="Mp.iaAdd('img')">相册</div>
        <div class="up-b" onclick="Mp.iaManual()">手工录入</div>
      </div>
    </div>

    <div class="card">
      <div class="card-ttl">本次待处理
        <span class="ttl-r">待识别 ${wait} · 已识别 ${done}</span></div>
      ${IA.box.length ? list : `<div class="empty"><div class="empty-t">还没有上传文件</div>
        <div class="empty-s">点上面的「拍照」，票当场就能录进来</div></div>`}
    </div>

    <div class="tip">
      <span class="tip-b">为什么先入库再报销：</span>查重必须挡在入库这一步。入库时拦一次，
      员工手上就没有这张票，后面想重复报销也没有票可用——等到提交报销时才查重，
      错的那张已经进了单据，改起来要连带撤回审批。
    </div>
  </div>`;
}

/* ---------- 编辑态 ---------- */
function pageInvEdit(){
  const c = IA.cur;
  if (!c) return pageInvAdd();
  const o = c.ocr;
  const dup = iaDup(o);
  const issues = iaIssues(o);
  const dd = iaDeduct(o.category);
  const s = storeById(o.storeId);
  const low = k => c.lowKeys.includes(k) ? 'low' : '';

  const field = (k, label, val, type) => `
    <div class="fld ${low(k)}">
      <div class="fld-l">${label}</div>
      <input class="fld-v in" type="${type || 'text'}" value="${val}"
             oninput="Mp.iaSet('${k}',this.value)">
    </div>`;

  return `<div class="ia">
    ${c.lowKeys.length ? `<div class="notice notice-amber">
      <div>有 <b>${c.lowKeys.length}</b> 个字段识别置信度偏低（已标黄），请对照原票核对。
      <div class="ent-sub">识别错一位数字，后面抵扣、申报、归档会一起错</div></div></div>` : ''}

    ${dup ? `<div class="notice notice-red">
      <div><b>查重命中：这张票已经在系统里了</b>
      <div class="ent-sub">首次入库：${dup.storeName}　开票日 ${dup.date}　关联单据 ${dup.docId}</div>
      <div class="ent-sub">同一张发票不得重复入库，也不得重复报销。</div></div></div>`
    : (o.code && o.no ? `<div class="notice notice-teal">
      <div>查重通过：14 个主体的发票索引里没有这张票，可以入库。</div></div>` : '')}

    <div class="card shot">
      <div class="shot-t">${e(c.fileName || '手工录入')}</div>
      <div class="shot-b">原型环境不加载真实图片。正式版此处为原票预览，可缩放旋转，字段与图上位置联动高亮。</div>
    </div>

    <div class="card">
      <div class="card-ttl">票面信息</div>
      ${field('code', '发票代码 *', o.code)}
      ${field('no', '发票号码 *', o.no)}
      ${field('date', '开票日期', o.date)}
      <div class="fld">
        <div class="fld-l">票种</div>
        <select class="fld-v in" onchange="Mp.iaSet('type',this.value)">
          ${IA_TYPES.map(t => `<option ${t === o.type ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      ${field('seller', '销售方', e(o.seller))}
      ${field('amount', '金额（不含税）', Number(o.amount).toFixed(2), 'number')}
      ${field('tax', '税额（票面实际）*', Number(o.tax).toFixed(2), 'number')}
      <div class="fld">
        <div class="fld-l">税率</div>
        <select class="fld-v in" onchange="Mp.iaSet('rate',this.value)">
          ${IA_RATES.map(r => `<option value="${r}" ${Math.abs(r-o.rate)<1e-9?'selected':''}>${(r*100).toFixed(0)}%</option>`).join('')}
        </select>
      </div>
      <div class="fld">
        <div class="fld-l">费用类目</div>
        <select class="fld-v in" onchange="Mp.iaSet('category',this.value)">
          ${IA_CATS.map(x => `<option ${x === o.category ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="fld">
        <div class="fld-l">归属主体</div>
        <select class="fld-v in" onchange="Mp.iaSet('storeId',this.value)">
          ${STORES.map(x => `<option value="${x.id}" ${x.id === o.storeId ? 'selected':''}>${x.name} · ${x.entityName}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-ttl">入库前校验</div>
      <div class="chk-row"><div class="chk-l">查重（票号全局唯一）</div>
        <div class="chk-r ${dup ? 'no' : 'ok'}">${dup ? '不通过' : '通过'}</div></div>
      <div class="chk-row"><div class="chk-l">税额与税率自洽</div>
        <div class="chk-r ${issues.length ? 'warn' : 'ok'}">${issues.length ? '需确认' : '通过'}</div></div>
      <div class="chk-row"><div class="chk-l">抵扣判定（按类目）</div>
        <div class="chk-r ${dd.deduct === 'yes' ? 'ok' : 'mute'}">${dd.deduct === 'yes' ? '可抵扣' : '不可抵扣'}</div></div>
      ${issues.map(x => `<div class="chk-issue">${x}</div>`).join('')}
      ${dd.reason ? `<div class="chk-issue">${dd.reason}</div>` : ''}
    </div>

    <div class="ent-card">
      <div class="ent-t">归属主体</div>
      <div class="ent-v">${s ? s.entityName : '—'}</div>
      <div class="ent-s">税号 ${s ? s.taxNo : '—'}　·　进项只能由该主体抵扣</div>
    </div>

    <div class="bar">
      <div class="bar-b" onclick="Mp.iaCancel()">取消</div>
      <div class="bar-b bar-main ${dup ? 'dis' : ''}" onclick="Mp.iaSubmit()">确认并入库</div>
    </div>
  </div>`;
}

/* ---------- 交互 ---------- */
window.MpInvd = ({
  iaAdd(kind){
    iaInit();
    const n = IA.box.length + 1;
    IA.box.push({
      id:'B' + n, name:`拍照_${Date.now().toString().slice(-6)}.jpg`, size:'2.1 MB', kind, done:false,
      ocr:{ type:'增值税普通发票', code:'0520026' + (30000 + n), no:String(33490000 + n * 137),
            date: iaToday(), seller:'待识别销售方', amount:0, tax:0, rate:.06,
            category:'办公费', storeId:'S01', low:[] }
    });
    render();
    mpToast('已上传，点击「识别」读取票面');
  },
  iaDrop(id){ IA.box = IA.box.filter(x => x.id !== id); if (IA.cur && IA.cur.id === id) IA.cur = null; render(); },
  iaOcr(id){
    iaInit();
    const b = IA.box.find(x => x.id === id);
    if (!b) return;
    b.done = true;
    render();
    mpToast('识别完成，正在打开核对页');
    setTimeout(() => Mp.iaOpen(id), 320);
  },
  iaOpen(id){
    const b = IA.box.find(x => x.id === id);
    if (!b) return;
    IA.cur = { id, fileName:b.name, ocr: JSON.parse(JSON.stringify(b.ocr)), lowKeys:(b.ocr.low || []).slice() };
    MP.tab = 'invadd-edit';
    render();
  },
  iaManual(){
    IA.cur = { id:'', fileName:'手工录入', lowKeys:[],
      ocr:{ type:'增值税专用发票', code:'', no:'', date: iaToday(), seller:'',
            amount:0, tax:0, rate:.13, category:'办公费', storeId: MP.role === 'staff' ? 'S01' : (State.storeId || 'S01') } };
    MP.tab = 'invadd-edit';
    render();
  },
  iaSet(k, v){
    const o = IA.cur.ocr;
    if (k === 'amount' || k === 'tax' || k === 'rate') o[k] = parseFloat(v) || 0;
    else o[k] = v;
    IA.cur.lowKeys = IA.cur.lowKeys.filter(x => x !== k);
    render();
  },
  iaCancel(){ IA.cur = null; MP.tab = 'invadd'; render(); },
  iaSubmit(){
    const c = IA.cur;
    if (!c) return;
    const o = c.ocr;
    if (!o.code || !o.no){ mpToast('发票代码和号码必填，否则无法查重'); return; }
    if (iaDup(o)){ mpToast('查重未通过：这张票已在发票池里'); return; }
    const dd = iaDeduct(o.category);
    INVOICES.unshift({
      id:'I' + (100 + INVOICES.length), code:o.code, no:o.no, date:o.date, seller:o.seller,
      amount:Number(o.amount) || 0, tax:Number(o.tax) || 0, rate:o.rate, type:o.type,
      status:'unused', storeId:o.storeId, docId:'', category:o.category,
      deduct: dd.deduct, deductReason: dd.reason || undefined,
      source: c.fileName === '手工录入' ? '手工录入' : 'OCR 识别',
      createdBy: ROLES[MP.role].name
    });
    if (c.id) IA.box = IA.box.filter(x => x.id !== c.id);
    IA.cur = null;
    MP.tab = 'invadd';
    render();
    mpToast('已入库，可在报销时勾选使用');
  }
});

/* 与 Mp 合并：无论两者谁先加载都能生效 */
if (typeof window.Mp === 'object' && window.Mp) Object.assign(window.Mp, window.MpInvd);
