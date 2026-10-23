/* ================= 发票采集：上传 → OCR 确认 → 查重入库 =================
   设计要点（三条，都是线上化后才可能做对的事）：
   1. 上传与录入是两步。上传只负责"把票弄进系统"，OCR 出结果后必须人工确认，
      因为纸质票识别错一位数字，后面抵扣、申报、归档全都错，且很难回溯。
   2. 税额只取票面实际值，绝不按税率倒算。餐饮 6%、房租 9%、农产品 9% 混在一起，
      按 13% 倒算出来的进项税额在申报时必然对不上。
   3. 查重放在「入库前」而不是「提交报销时」。入库时拦一次，
      员工拿不到这张票，后面就不可能拿它去报销，从源头断掉重复报销。
*/

/* ---------- 暂存区 ---------- */
const INVK = {
  box: [],        // 待处理文件 {id, fileName, kind, size, status:'idle'|'ocr'|'done', mock, ocr}
  cur: null,      // 当前正在确认的票据
  modalShown: false
};

function invkInit(){
  if (INVK.box.length) return;
  INVK.box = INBOX_SEED.map(x => Object.assign({ status:'idle', ocr:null }, x));
}

/* 生成一个"OCR 结果"，模拟识别精度：有一处需要人工核对 */
function invkOcr(boxId){
  invkInit();
  const b = INVK.box.find(x => x.id === boxId);
  if (!b) return null;
  b.status = 'done';
  b.ocr = {
    code: b.mock.code,
    no: b.mock.no,
    date: b.mock.date,
    type: b.mock.type,
    seller: b.mock.seller,
    amount: b.mock.amount,
    tax: b.mock.tax,
    rate: b.mock.rate,
    category: b.mock.category,
    storeId: b.mock.storeId,
    // 识别置信度（低于 .95 的字段标黄，要求人工确认）
    conf: { code:.99, no:.97, date:.96, seller:.94, amount:.99, tax:.88 },
    verified: false
  };
  return b;
}

function invkBlank(){
  return {
    code:'', no:'', date: todayStr(), type:'增值税专用发票', seller:'',
    amount:0, tax:0, rate:.13, category:'客房物料', storeId: State.storeId,
    conf:{}, verified:true, manual:true
  };
}
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- 查重：入库前预检 ---------- */
function invkDupCheck(o){
  const hit = INVOICES.find(iv => iv.code === o.code && iv.no === o.no);
  if (!hit) return null;
  const s = storeById(hit.storeId);
  return {
    iv: hit,
    storeName: s ? s.name : '—',
    docId: hit.docId || '—',
    usedAt: hit.date,
    tip: hit.status === 'dup'
      ? '该票号此前已被标记为"查重命中"，说明已有另一张同号票在用。'
      : '该票号已在发票池中，不得再次入库。'
  };
}

/* 税额与金额的逻辑校验：价税合计是否自洽 */
function invkMath(o){
  const issues = [];
  if (!o.amount) issues.push({ level:'warn', text:'金额为 0，请确认是否填写' });
  if (o.tax > 0 && o.rate > 0){
    const expect = o.amount / (1 + o.rate) * o.rate;
    const diff = Math.abs(expect - o.tax);
    if (diff > Math.max(1, o.tax * .05)){
      issues.push({ level:'warn', text:`税额与税率不匹配：按 ${(o.rate * 100).toFixed(0)}% 反算应约 ¥${expect.toFixed(2)}，票面为 ¥${o.tax.toFixed(2)}（差 ¥${diff.toFixed(2)}）。请以票面为准，或核对税率。` });
    }
  }
  if (!o.code || !o.no) issues.push({ level:'warn', text:'发票代码/号码未填写完整，无法参与查重' });
  return issues;
}

/* 该类目可否抵扣 */
function invkDeduct(o){
  const r = DEDUCT_RULE[o.category];
  if (!r) return { deduct:'yes', reason:'' };
  return { deduct:r.deduct, reason:r.reason || '' };
}

/* ================= 采集页（独立视图） ================= */
Views['inv-add'] = function(){
  invkInit();
  const waiting = INVK.box.filter(b => b.status !== 'done').length;
  const done = INVK.box.filter(b => b.status === 'done').length;

  const rows = INVK.box.map(b => {
    const tag = b.status === 'done'
      ? '<span class="tag tag-teal">已识别 · 待确认</span>'
      : '<span class="tag tag-amber">待识别</span>';
    return `<tr>
      <td><div class="ia-file">
        <span class="ia-ico ${b.kind}">${b.kind === 'img' ? 'IMG' : 'PDF'}</span>
        <div><div class="strong fs12">${e(b.fileName)}</div>
        <div class="fs11 c3">${b.size}</div></div>
      </div></td>
      <td>${b.status === 'done' ? b.ocr.type : '—'}</td>
      <td class="fs11">${b.status === 'done' ? b.ocr.no : '—'}</td>
      <td>${b.status === 'done' ? e(b.ocr.seller) : '—'}</td>
      <td class="num">${b.status === 'done' ? fmt(b.ocr.amount) : '—'}</td>
      <td>${tag}</td>
      <td style="text-align:right">
        ${b.status === 'done'
          ? `<button class="btn btn-sm btn-primary" onclick="App.invkOpen('${b.id}')">确认录入</button>`
          : `<button class="btn btn-sm" onclick="App.invkRun('${b.id}')">识别</button>`}
        <button class="btn btn-sm" onclick="App.invkDrop('${b.id}')">移除</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="notice notice-blue" style="margin-bottom:14px">
    <div><b>发票采集分两步：上传 → 确认。中间不允许跳过。</b>
    OCR 只是把票面"读"出来，读出来的东西必须有人看过才能进发票池。
    这一步多花 20 秒，能挡掉后面抵扣错、申报错、归档错的一整串返工。</div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div class="card-title">采集区<small>支持拍照、相册、扫描件与电子发票文件</small></div>
      <div class="fs11 c3">待处理 ${waiting} · 已识别 ${done}</div>
    </div>
    <div class="card-body">
      <div class="ia-drop">
        <div class="ia-drop-ico">＋</div>
        <div class="ia-drop-t">拖入发票图片 / PDF，或从下面三种方式上传</div>
        <div class="ia-drop-s">单张不超过 10 MB；电子发票（PDF/OFD）优先，识别准确率最高</div>
        <div class="ia-btns">
          <button class="btn btn-primary btn-sm" onclick="App.invkAdd('img')">拍照上传</button>
          <button class="btn btn-sm" onclick="App.invkAdd('img')">从相册选择</button>
          <button class="btn btn-sm" onclick="App.invkAdd('pdf')">选择文件 / 电子发票</button>
        </div>
      </div>
      <div class="ia-tip">
        <b>为什么电子发票优先：</b>PDF/OFD 里带着结构化的发票要素，直接读取比为图片做 OCR 准确得多，
        也不会有反光、折痕、倾斜导致的误读。纸质票请尽量平铺拍摄，避开反光。
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title">本次待处理（${INVK.box.length}）</div></div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>文件</th><th>票种</th><th>发票号码</th><th>销售方</th><th class="num">金额</th><th>状态</th><th></th></tr></thead>
        <tbody>${rows || emptyRow(7, '还没有上传文件', '点上方「拍照上传」或「选择文件」，票当场就能录进来')}</tbody>
      </table>
    </div>
  </div>

  <div class="card mt16">
    <div class="card-head"><div class="card-title">手工录入<small>没有电子文件时的兜底</small></div></div>
    <div class="card-body">
      <div class="fs12 c2" style="line-height:1.8;margin-bottom:12px">
        纸质票实在拍不清楚时，可以直接按票面手填。手填同样要走查重与抵扣判定，不走特殊通道。
      </div>
      <button class="btn" onclick="App.invkManual()">手工填写一张</button>
    </div>
  </div>`;
};

/* ---------- 交互 ---------- */
function invkAdd(kind){
  invkInit();
  const n = INVK.box.length + 1;
  const fname = kind === 'pdf' ? `电子发票_${Date.now().toString().slice(-6)}.pdf` : `发票照片_${n}.jpg`;
  // 复用种子票据的票面数据（演示用）
  const seed = INBOX_SEED[(n - 1) % INBOX_SEED.length];
  INVK.box.push({
    id:'B' + Date.now(), fileName: fname, kind, size: kind === 'pdf' ? '164 KB' : '1.8 MB',
    status:'idle', mock: Object.assign({}, seed.mock, { no: String(33000000 + Math.floor(Math.random() * 90000)) }), ocr:null
  });
  toast('已上传，点击「识别」开始读取票面');
  render();
}

function invkDrop(id){
  INVK.box = INVK.box.filter(x => x.id !== id);
  render();
}

function invkRun(id){
  invkOcr(id);
  toast('票面识别完成，请逐项核对');
  render();
  setTimeout(() => invkOpen(id), 120);
}

function invkManual(){
  INVK.cur = { id:'M' + Date.now(), blank:true, ocr: invkBlank() };
  invkModal();
}

function invkOpen(id){
  const b = INVK.box.find(x => x.id === id);
  if (!b || !b.ocr) return;
  INVK.cur = { id, blank:false, fileName:b.fileName, ocr:b.ocr };
  invkModal();
}

/* 表单输入不重绘整页，只局部刷新预览区 */
function invkSet(k, v){
  if (!INVK.cur) return;
  const o = INVK.cur.ocr;
  if (k === 'amount' || k === 'tax' || k === 'rate') o[k] = parseFloat(v) || 0;
  else o[k] = v;
  o.conf = {};      // 人工改过的字段不再提示低置信度
  invkPreview();
}

function invkLow(k){
  const o = INVK.cur && INVK.cur.ocr;
  if (!o) return false;
  return o.conf && o.conf[k] !== undefined && o.conf[k] < .95;
}

function invkPreview(){
  const box = document.getElementById('iaPreview');
  if (!box || !INVK.cur) return;
  const o = INVK.cur.ocr;
  const dup = invkDupCheck(o);
  const issues = invkMath(o);
  const dd = invkDeduct(o);
  const s = storeById(o.storeId);

  const lowN = Object.keys(o.conf || {}).filter(k => o.conf[k] < .95).length;

  box.innerHTML = `
    ${lowN ? `<div class="notice notice-amber" style="margin-bottom:10px">
      <div><b>有 ${lowN} 个字段识别置信度偏低，已标黄。</b>请对照原票逐一核对，确认无误后再提交。</div>
    </div>` : ''}
    ${dup ? `<div class="notice notice-red" style="margin-bottom:10px">
      <div><b>查重命中：这张票已经在系统里了</b><br>
      <span style="font-size:11.5px">
        发票代码 ${dup.iv.code} / 号码 ${dup.iv.no}<br>
        首次入库：${dup.storeName}　开票日期 ${dup.usedAt}　关联单据 ${dup.docId}<br>
        ${dup.tip}
      </span></div>
    </div>` : `<div class="notice notice-teal" style="margin-bottom:10px">
      <div><b>查重通过：</b>全集团 14 个主体的发票索引里没有这张票，可以入库。</div>
    </div>`}
    ${issues.map(x => `<div class="notice notice-amber" style="margin-bottom:10px"><div>${x.text}</div></div>`).join('')}

    <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
      <tbody>
        <tr>
          <td class="muted" style="width:96px">发票代码</td><td>${o.code || '<span class="cr">未填写</span>'}</td>
          <td class="muted" style="width:96px">发票号码</td><td>${o.no || '<span class="cr">未填写</span>'}</td>
        </tr>
        <tr>
          <td class="muted">开票日期</td><td>${o.date}</td>
          <td class="muted">票种</td><td>${o.type}</td>
        </tr>
        <tr>
          <td class="muted">销售方</td><td colspan="3">${e(o.seller)}</td>
        </tr>
        <tr>
          <td class="muted">归属主体</td>
          <td colspan="3">${s ? s.entityName : '—'}　税号 ${s ? s.taxNo : '—'}</td>
        </tr>
        <tr>
          <td class="muted">金额 / 税额</td>
          <td>¥${fmt(o.amount)} / ¥${fmt(o.tax)}</td>
          <td class="muted">税率</td><td>${pct(o.rate, 0)}</td>
        </tr>
        <tr>
          <td class="muted">费用类目</td><td>${o.category}</td>
          <td class="muted">抵扣判定</td>
          <td>${dd.deduct === 'yes'
            ? '<span class="tag tag-teal">可抵扣</span>'
            : '<span class="tag tag-gray">不可抵扣</span>'}
            ${dd.reason ? `<div class="fs11 ca" style="margin-top:3px">${dd.reason}</div>` : ''}</td>
        </tr>
      </tbody>
    </table>`;
}

function invkModal(){
  if (!INVK.cur) return;
  const o = INVK.cur.ocr;
  const storeOpts = STORES.map(s =>
    `<option value="${s.id}" ${s.id === o.storeId ? 'selected' : ''}>${s.name} · ${s.entityName}</option>`).join('');
  const catOpts = Object.keys(DEDUCT_RULE).map(c =>
    `<option value="${c}" ${c === o.category ? 'selected' : ''}>${c}</option>`).join('');
  const typeOpts = [...new Set(INVOICE_TYPES.map(t => t.name))].map(t =>
    `<option value="${t}" ${t === o.type ? 'selected' : ''}>${t}</option>`).join('');

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">${INVK.cur.blank ? '手工录入发票' : 'OCR 识别结果确认'}</div>
        <div class="modal-sub">${INVK.cur.fileName || '手工录入'} · 逐项核对后才可入库</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body ia-modal">
      <div class="ia-two">
        <div class="ia-left">
          <div class="ia-shot">
            <div class="ia-shot-in">
              <div class="ia-shot-t">${INVK.cur.blank ? '手工录入' : (INVK.cur.fileName || '').split('.').pop().toUpperCase() + ' 原件'}</div>
              <div class="ia-shot-s">原型环境不加载真实图片。<br>正式实现时此处为原票预览，可缩放、可旋转，<br>右侧字段与图上位置联动高亮。</div>
            </div>
          </div>
          <div class="ia-note">
            <b>联动高亮是刚需。</b>会计核对 OCR 结果时，要能一眼看到"这个数字读的是票上哪一处"。
            纯文本列表核对慢且容易看错行——这是纸质转电子最容易漏掉的交互细节。
          </div>
        </div>
        <div class="ia-right">
          <div class="ia-frm">
            <label class="ia-f ${invkLow('code') ? 'low' : ''}">
              <span>发票代码</span>
              <input class="input" value="${o.code}" oninput="App.invkSet('code',this.value)">
            </label>
            <label class="ia-f ${invkLow('no') ? 'low' : ''}">
              <span>发票号码</span>
              <input class="input" value="${o.no}" oninput="App.invkSet('no',this.value)">
            </label>
            <label class="ia-f ${invkLow('date') ? 'low' : ''}">
              <span>开票日期</span>
              <input class="input" type="date" value="${o.date}" oninput="App.invkSet('date',this.value)">
            </label>
            <label class="ia-f">
              <span>票种</span>
              <select class="input" onchange="App.invkSet('type',this.value)">${typeOpts}</select>
            </label>
            <label class="ia-f ${invkLow('seller') ? 'low' : ''}" style="grid-column:1/-1">
              <span>销售方名称</span>
              <input class="input" value="${e(o.seller)}" oninput="App.invkSet('seller',this.value)">
            </label>
            <label class="ia-f ${invkLow('amount') ? 'low' : ''}">
              <span>金额（不含税）</span>
              <input class="input" type="number" step="0.01" value="${o.amount}" oninput="App.invkSet('amount',this.value)">
            </label>
            <label class="ia-f ${invkLow('tax') ? 'low' : ''}">
              <span>税额（票面实际）</span>
              <input class="input" type="number" step="0.01" value="${o.tax}" oninput="App.invkSet('tax',this.value)">
            </label>
            <label class="ia-f">
              <span>税率</span>
              <select class="input" onchange="App.invkSet('rate',this.value)">
                ${[.13, .09, .06, .03, .01, 0].map(r =>
                  `<option value="${r}" ${Math.abs(r - o.rate) < 1e-9 ? 'selected' : ''}>${(r * 100).toFixed(0)}%</option>`).join('')}
              </select>
            </label>
            <label class="ia-f">
              <span>费用类目</span>
              <select class="input" onchange="App.invkSet('category',this.value)">${catOpts}</select>
            </label>
            <label class="ia-f" style="grid-column:1/-1">
              <span>归属主体（决定进项归谁抵扣）</span>
              <select class="input" onchange="App.invkSet('storeId',this.value)">${storeOpts}</select>
            </label>
          </div>
        </div>
      </div>
      <div id="iaPreview" class="mt12"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="App.invkSave()">确认并入库</button>
    </div>`;
  openModal(html, true);
  invkPreview();
}

function invkSave(){
  if (!INVK.cur) return;
  const o = INVK.cur.ocr;
  if (!o.code || !o.no){
    toast('发票代码和号码必须填写，否则无法参与查重', 'err');
    return;
  }
  const dup = invkDupCheck(o);
  if (dup){
    toast('查重未通过：这张票已经在发票池里，不能重复入库', 'err');
    return;
  }
  const dd = invkDeduct(o);
  const id = 'I' + (100 + INVOICES.length);
  INVOICES.unshift({
    id, code:o.code, no:o.no, date:o.date, seller:o.seller,
    amount:o.amount, tax:o.tax, rate:o.rate, type:o.type,
    status:'unused', storeId:o.storeId, docId:'',
    category:o.category, deduct:dd.deduct,
    deductReason: dd.reason || undefined,
    source: INVK.cur.blank ? '手工录入' : 'OCR 识别',
    createdBy: ROLES[State.role].name
  });
  if (INVK.cur.id && String(INVK.cur.id).indexOf('B') === 0){
    INVK.box = INVK.box.filter(x => x.id !== INVK.cur.id);
  }
  INVK.cur = null;
  closeModal();
  toast('已入库，可在发票池中勾选使用');
  render();
}
