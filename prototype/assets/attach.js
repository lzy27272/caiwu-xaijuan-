/* ================= 附件预览 =================
   问题：原型里附件只有元数据（name / size / kind），没有任何真实文件字节。
   如果老老实实显示「无法预览」，那这个功能等于没做——会计审批时最想确认的
   恰恰是"验收单到底写了什么、现场照片拍的是哪面墙"。

   做法：按「单据类型 + 费用项目 + 文件名关键词」生成一份**确定性的渲染预览**。
   - 同一份附件每次打开内容完全一样（seed 由 id + 下标算出来），不会翻两次看到两版
   - 预览页顶部强制挂一条「演示渲染」提示，不伪装成原件的扫描件
   - 只渲染与该业务相关的字段：验收单有数量/单价/收货人，现场照片有拍摄时间和
     水印坐标，对账单有期初/本期/期末——不渲染成通用的"假文本"

   接入真实系统时替换 openAttach() 里的 renderMock() 调用即可：
   取对象存储的签名 URL → 图片放 <img>、PDF 放 <iframe>、其他给下载。
   其余 UI（切换、上下翻、下载按钮、来源信息）都不用改。

   另一个约束：全站共用一个 #modal，在单据详情弹窗里点预览会把详情顶掉。
   所以预览页记住来源 docId，右上角给「返回单据」，Esc 也回到单据而不是全关。 */

/* ---------- 确定性伪随机 ---------- */
function attHash(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}
function attRand(seed){
  let x = seed || 1;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

/* ---------- 业务内容还原 ---------- */
const SUPPLIERS = [
  '贵州洁雅纺织品有限公司', '贵阳净美洗涤服务有限公司', '贵州恒信机电工程有限公司',
  '贵阳晨光文具有限公司', '贵阳老城置业有限公司', '黔中物业保洁有限公司'
];
const PEOPLE = ['王建国', '李慧敏', '周志强', '何秀兰', '杨小东', '吴莉莉'];

/* 按附件类型给出「这份文件应该有什么」 */
function attDocType(a, doc){
  const n = a.name;
  if (/验收单|GRN|入库单/i.test(n)) return 'grn';
  if (/照片|现场|图片|截图|\.jpe?g|\.png/i.test(n)) return 'photo';
  if (/对账单|结算单|账单/i.test(n)) return 'statement';
  if (/合同|协议/i.test(n)) return 'contract';
  if (/报价|比价|询价/i.test(n)) return 'quote';
  if (/签到|会议|培训/i.test(n)) return 'signin';
  if (/回单|付款凭证/i.test(n)) return 'receipt';
  return 'generic';
}

function attMeta(doc, a, idx){
  const seed = attHash((doc ? doc.id : 'x') + '#' + idx + '#' + a.name);
  const r = attRand(seed);
  const n = a.name;
  const ext = String(n).split('.').pop().toLowerCase();

  /* 金额从单据里取，不从随机数造——预览上的数字必须和单据对得上，
     否则会计一眼看出矛盾，整页可信度就没了 */
  const amount = doc ? doc.amount : 0;
  const type = attDocType(a, doc);
  const d = new Date(doc && doc.submitDate ? doc.submitDate.replace(/[^\d-]/g, '-') : '2026-10-16');
  if (isNaN(d.getTime())) d.setTime(Date.parse('2026-10-16'));
  d.setDate(d.getDate() + Math.floor(r() * 3));

  const no = 'GRN' + (doc ? doc.id.replace(/\D/g, '') : '2026100000') + '-' + (idx + 1);
  return {
    type, ext, amount, seed,
    no,
    date: d.toISOString().slice(0, 10),
    supplier: SUPPLIERS[seed % SUPPLIERS.length],
    person: doc ? doc.applicant : PEOPLE[seed % PEOPLE.length],
    checker: PEOPLE[(seed >> 3) % PEOPLE.length],
    qty: 10 + (seed >> 4) % 90,
    store: doc ? storeById(doc.storeId) : null,
    pageCount: 1 + (seed >> 7) % 3
  };
}

/* 数字表：验收单/对账单用 */
function attTable(type, m){
  const r = attRand(m.seed + 7);
  const rows = type === 'grn'
    ? [['布草-床单（白）', '条'], ['布草-被套（白）', '条'], ['毛巾-浴巾', '条'], ['枕套', '只']]
    : [['客房用品', '批'], ['洗涤服务', '月'], ['维修材料', '批']];
  /* 关键：先定数量，再由 单价×数量 得金额，最后一行吸收尾差。
     反过来（先摊金额、再倒算单价）会出现「25 条 × 103.26 = 2917.07」这种一眼就错的算式——
     会计看到第一行就会怀疑整份材料是造的，预览的意义就没了。 */
  const total = m.amount;
  const weights = rows.map(() => 0.5 + r());
  const sum = weights.reduce((a, b) => a + b, 0);
  const targetNet = Math.round(total / 1.13 * 100) / 100;

  const plan = rows.map((row, i) => {
    /* 数量按"件"给整数，单价按"分"给两位小数；两者都定了金额自然就对得上 */
    const qty = Math.max(1, Math.round(m.qty * weights[i] / 2) + 1);
    const price = Math.round(targetNet * (weights[i] / sum) / qty * 100) / 100;
    return { name: row[0], unit: row[1], qty, price, amt: Math.round(price * qty * 100) / 100 };
  });

  /* 尾差调最后一行。单改数量补不上千元级差额（价差 / 单价 ≈ 件数），
     所以按 gap 反推最后一行应有的含税金额，再反解数量：
     整数解无解就保留小数数量（布草按"米/条"计，0.6 条本身就是常见写法），
     反正 单价 × 数量 = 金额 必须成立——这是会计核对时第一眼要看的东西。 */
  const grossRows = plan.reduce((a, b) => a + b.amt, 0);
  const gap = Math.round((targetNet - grossRows) * 100) / 100;
  const last = plan[plan.length - 1];
  if (Math.abs(gap) >= 0.01 && last.price > 0){
    const want = Math.round((last.amt + gap) * 100) / 100;
    const qty = Math.round(want / last.price * 100) / 100;
    if (qty > 0){
      last.qty = qty;
      last.amt = Math.round(last.price * last.qty * 100) / 100;
    }
  }

  /* 到这一步通常还差几分钱。单价 × 数量 已经把行金额锁死，硬改单价会让
     单价出现三位小数，反而更假。这里不改数据，只把差额留给调用方显示：
     单据表尾的「不含税小计」直接写 targetNet，与含税合计、税额三行自洽；
     分项合计差几分钱在真实对账单上本来就有（分摊进位），会计不会为此停手。
     真正不能容忍的是「25 × 103.26 = 2917.07」那种行内算式不平——那才是一眼假。 */
  plan.forEach(r => { r.price = Math.round(r.price * 100) / 100; r.amt = Math.round(r.amt * 100) / 100; });
  return plan;
}

/* ---------- 渲染：各类页面 ---------- */
function renderMockImg(m){
  const r = attRand(m.seed + 11);
  const w = 640, h = 460;
  /* 现场照片：画一张示意图（房间/墙面/物品），带拍摄水印 */
  const hue = 200 + Math.floor(r() * 40);
  let shapes = '';
  if (m.type === 'photo'){
    shapes = `
      <rect x="0" y="300" width="${w}" height="160" fill="hsl(${hue},12%,88%)"/>
      <rect x="40" y="150" width="200" height="150" rx="4" fill="hsl(${hue},16%,80%)"/>
      <rect x="52" y="162" width="176" height="90" rx="2" fill="hsl(${hue},22%,72%)"/>
      <rect x="270" y="120" width="180" height="180" rx="6" fill="hsl(${hue},10%,84%)"/>
      <rect x="300" y="150" width="120" height="120" rx="3" fill="hsl(${hue},14%,78%)"/>
      <circle cx="520" cy="200" r="46" fill="hsl(${hue},18%,76%)"/>
      <path d="M40 300 L600 300" stroke="hsl(${hue},10%,70%)" stroke-width="2"/>
      <text x="70" y="215" font-size="15" fill="hsl(${hue},25%,42%)" font-family="sans-serif">客房</text>`;
  } else {
    shapes = `
      <rect x="0" y="0" width="${w}" height="${h}" fill="#F5F7FA"/>
      <g transform="translate(60,70)">
        <rect x="0" y="0" width="520" height="${170 + m.pageCount * 20}" rx="6" fill="#fff" stroke="#DCE1E8"/>
        <rect x="24" y="24" width="180" height="14" rx="3" fill="#B9C2CE"/>
        ${[0,1,2,3].map(i => `<rect x="24" y="${60 + i*34}" width="${420 - i*40}" height="10" rx="2" fill="#E3E7ED"/>`).join('')}
        <rect x="24" y="${60 + 4*34}" width="150" height="10" rx="2" fill="#E3E7ED"/>
      </g>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block;border-radius:6px;background:#FAFBFC">
    ${shapes}
    <g font-family="ui-monospace,monospace" font-size="11" fill="#fff">
      <rect x="0" y="${h - 54}" width="${w}" height="54" fill="rgba(20,26,36,.62)"/>
      <text x="16" y="${h - 32}">${e(m.store ? m.store.name : '')} ${m.date} 10:2${m.seed % 9}</text>
      <text x="16" y="${h - 16}">34.6${m.seed % 10}°N 106.7${m.seed % 10}°E · ${m.person} 拍摄</text>
      <text x="${w - 16}" y="${h - 16}" text-anchor="end">拖动可放大 · 演示渲染</text>
    </g>
  </svg>`;
}

function renderMockGrn(m){
  const rows = attTable('grn', m);
  /* 表尾三行必须自洽：不含税小计 + 税额 = 价税合计 = 单据金额。
     分项合计与不含税小计的几分钱差额，真实单据上也有（分摊进位），不修。 */
  const gross = m.amount;
  const net = Math.round(gross / 1.13 * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  return `<div class="vd-paper">
    <div class="vd-hd">
      <div>
        <div class="vd-title">物 料 验 收 单</div>
        <div class="vd-sub">${e(m.store ? m.store.entityName : '')}</div>
      </div>
      <div class="vd-no"><div>编号</div><div class="mono">${m.no}</div></div>
    </div>
    <div class="vd-fields">
      <div><span>供应商</span><b>${e(m.supplier)}</b></div>
      <div><span>收货日期</span><b>${m.date}</b></div>
      <div><span>收货门店</span><b>${e(m.store ? m.store.name : '—')}</b></div>
      <div><span>关联单据</span><b class="mono">${m.docId || '—'}</b></div>
    </div>
    <table class="vd-table">
      <thead><tr><th style="width:44%">品名</th><th>单位</th><th class="num">数量</th><th class="num">单价</th><th class="num">金额</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${e(r.name)}</td><td>${r.unit}</td>
        <td class="num">${r.qty}</td><td class="num">${r.price.toFixed(2)}</td><td class="num">${fmt(r.amt)}</td></tr>`).join('')}</tbody>
      <tfoot>
        <tr><td colspan="4" class="num">不含税小计</td><td class="num">${fmt(net)}</td></tr>
        <tr><td colspan="4" class="num">税额（13%）</td><td class="num">${fmt(vat)}</td></tr>
        <tr class="vd-total"><td colspan="4" class="num">价税合计</td><td class="num">¥${fmt(gross)}</td></tr>
      </tfoot>
    </table>
    <div class="vd-sign">
      <div><span>收货人</span><b>${e(m.person)}</b></div>
      <div><span>验收人</span><b>${e(m.checker)}</b></div>
      <div><span>仓管</span><b>${e(PEOPLE[(m.seed >> 5) % PEOPLE.length])}</b></div>
    </div>
    <div class="vd-note">验收结论：数量相符，外观无破损，可入库。本单为三单匹配（合同 / 验收单 / 发票）中的验收环节依据。</div>
  </div>`;
}

function renderMockStatement(m){
  const rows = attTable('statement', m);
  return `<div class="vd-paper">
    <div class="vd-hd">
      <div><div class="vd-title">供 应 商 对 账 单</div>
        <div class="vd-sub">${e(m.supplier)} · 截至 ${m.date}</div></div>
      <div class="vd-no"><div>对账期间</div><div class="mono">2026-09</div></div>
    </div>
    <div class="vd-fields">
      <div><span>往来主体</span><b>${e(m.store ? m.store.entityName : '—')}</b></div>
      <div><span>结算方式</span><b>月结 30 天</b></div>
    </div>
    <table class="vd-table">
      <thead><tr><th>项目</th><th class="num">笔数</th><th class="num">金额</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${e(r.name)}</td><td class="num">${r.qty % 7 + 1}</td><td class="num">${fmt(r.amt)}</td></tr>`).join('')}</tbody>
      <tfoot>
        <tr><td class="num">本期发生额</td><td></td><td class="num">${fmt(m.amount)}</td></tr>
        <tr><td class="num">期末应付余额</td><td></td><td class="num vd-total">${fmt(m.amount)}</td></tr>
      </tfoot>
    </table>
    <div class="vd-sign"><div><span>供应商盖章</span><b>（章）</b></div><div><span>财务核对</span><b>${e(m.checker)}</b></div></div>
  </div>`;
}

function renderMockContract(m){
  const r = attRand(m.seed + 3);
  const clauses = [
    '第一条 服务范围：乙方按甲方要求提供服务，质量标准见附件一。',
    '第二条 合同金额：本合同价税合计人民币 ' + fmt(m.amount) + ' 元，含增值税。',
    '第三条 结算方式：月结，乙方开具增值税专用发票后 30 日内付款。',
    '第四条 违约责任：逾期交付按日万分之五计违约金。',
    '第五条 争议解决：提交合同签订地人民法院管辖。'
  ];
  return `<div class="vd-paper">
    <div class="vd-hd"><div><div class="vd-title">合 同 摘 要</div>
      <div class="vd-sub">${e(m.store ? m.store.entityName : '')} 与 ${e(m.supplier)}</div></div>
      <div class="vd-no"><div>共 ${m.pageCount + 2} 页</div><div class="mono">HT-2026-${100 + m.seed % 800}</div></div></div>
    <div class="vd-fields">
      <div><span>合同金额</span><b>¥${fmt(m.amount)}</b></div>
      <div><span>签订日期</span><b>${m.date}</b></div>
      <div><span>甲方</span><b>${e(m.store ? m.store.entityName : '—')}</b></div>
      <div><span>乙方</span><b>${e(m.supplier)}</b></div>
    </div>
    <div class="vd-clause">${clauses.map(c => `<p>${e(c)}</p>`).join('')}</div>
    <div class="vd-note">摘要仅列关键条款，正式审批以盖章原件为准。本预览用于核对金额、主体与付款条件三项是否与申请一致。</div>
  </div>`;
}

function renderMockQuote(m){
  return `<div class="vd-paper">
    <div class="vd-hd"><div><div class="vd-title">报 价 单</div><div class="vd-sub">${e(m.supplier)}</div></div>
      <div class="vd-no"><div>有效期</div><div class="mono">30 天</div></div></div>
    <table class="vd-table">
      <thead><tr><th>项目</th><th class="num">数量</th><th class="num">单价</th><th class="num">金额</th></tr></thead>
      <tbody>${attTable('grn', m).map(r => `<tr><td>${e(r.name)}</td><td class="num">${r.qty}</td>
        <td class="num">${r.price.toFixed(2)}</td><td class="num">${fmt(r.amt)}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="vd-total"><td colspan="3" class="num">报价合计</td><td class="num">¥${fmt(m.amount)}</td></tr></tfoot>
    </table>
    <div class="vd-note">报价含税、含运费。比价记录需附至少 2 家供应商报价方可走「市场推广」类付款。</div>
  </div>`;
}

function renderMockSignin(m){
  const r = attRand(m.seed + 5);
  const names = Array.from({ length: 8 }, (_, i) => PEOPLE[(m.seed + i * 3) % PEOPLE.length] + (i > 4 ? '（代签）' : ''));
  return `<div class="vd-paper">
    <div class="vd-hd"><div><div class="vd-title">会 议 签 到 表</div>
      <div class="vd-sub">${e(m.store ? m.store.name : '')} · ${m.date}</div></div>
      <div class="vd-no"><div>应到 / 实到</div><div class="mono">8 / ${6 + m.seed % 3}</div></div></div>
    <table class="vd-table">
      <thead><tr><th style="width:60px">序号</th><th>姓名</th><th>部门</th><th>签名</th></tr></thead>
      <tbody>${names.map((n, i) => `<tr><td class="num">${i + 1}</td><td>${e(n)}</td>
        <td>${['前厅', '客房', '餐饮', '工程', '财务'][i % 5]}</td>
        <td class="vd-sign-cell">${e(n.replace(/（代签）/, ''))}</td></tr>`).join('')}</tbody>
    </table>
    <div class="vd-note">签到表是会议费、培训费报销的必要附件，缺签到表一律退回。</div>
  </div>`;
}

function renderMockReceipt(m){
  return `<div class="vd-paper vd-receipt">
    <div class="vd-hd"><div><div class="vd-title">银 行 回 单</div>
      <div class="vd-sub">${e(m.store ? m.store.entityName : '')}</div></div>
      <div class="vd-no"><div>打印时间</div><div class="mono">${m.date}</div></div></div>
    <table class="vd-table vd-kv">
      <tbody>
        <tr><td>付款账号</td><td class="mono">${m.store ? m.store.taxNo.slice(-8) : '—'}****${1000 + m.seed % 9000}</td>
            <td>收款账号</td><td class="mono">****${2000 + m.seed % 7000}</td></tr>
        <tr><td>收款方</td><td>${e(m.supplier)}</td><td>用途</td><td>货款</td></tr>
        <tr><td>金额</td><td class="vd-total">¥${fmt(m.amount)}</td><td>状态</td><td>交易成功</td></tr>
        <tr><td>流水号</td><td class="mono">${m.seed}${100000 + m.seed % 899999}</td><td>渠道</td><td>企业网银</td></tr>
      </tbody>
    </table>
    <div class="vd-note">回单是「资金实际流出」的唯一外部凭证，付款后必须归档。金额与本单核对一致。</div>
  </div>`;
}

function renderMockGeneric(m, a){
  return `<div class="vd-paper">
    <div class="vd-hd"><div><div class="vd-title">文 件 摘 要</div>
      <div class="vd-sub">${e(m.store ? m.store.name : '')} · ${m.date}</div></div>
      <div class="vd-no"><div>大小</div><div class="mono">${a.size || '—'}</div></div></div>
    <div class="vd-fields">
      <div><span>所属单据</span><b class="mono">${m.docId || '—'}</b></div>
      <div><span>上传人</span><b>${e(a.by || m.person)}</b></div>
      <div><span>上传时间</span><b>${e(a.time || m.date)}</b></div>
      <div><span>文件类型</span><b>${m.ext.toUpperCase()}</b></div>
    </div>
    <div class="vd-note">该格式在原型中不还原版式。接入真实系统后，图片直接显示，PDF 内嵌阅读器，Office 文件走在线转换或下载。</div>
  </div>`;
}

function renderMock(a, m){
  switch (m.type){
    case 'grn': return renderMockGrn(m);
    case 'statement': return renderMockStatement(m);
    case 'contract': return renderMockContract(m);
    case 'quote': return renderMockQuote(m);
    case 'signin': return renderMockSignin(m);
    case 'receipt': return renderMockReceipt(m);
    case 'photo': return `<div class="vd-imgbox">${renderMockImg(m)}</div>`;
    default: return renderMockGeneric(m, a);
  }
}

/* 附件来源三处：已提交单据的附件、新建单据的暂存附件、付款后上传的银行回单。
   统一成 { list, docId } 后再走同一条渲染路径。 */
function attSource(docId){
  if (docId === '__form__') return { list: State.formAttach, doc: null, docId: null };
  const doc = docById(docId);
  if (!doc) return { list: [], doc: null, docId };
  if (docId === '__receipt__') return { list: doc.receipt ? [Object.assign({ kind: 'img' }, doc.receipt)] : [], doc, docId: doc.id };
  return { list: doc.attach || [], doc, docId: doc.id };
}

/* ---------- 预览弹窗 ---------- */
let ATT_CTX = null;   // { docId, idx }，用于上下切换与返回单据

function openAttach(docId, idx){
  const src = attSource(docId);
  const list = src.list;
  if (!list[idx]) return;
  ATT_CTX = { docId, idx, back: src.docId };

  const doc = src.doc;
  const a = list[idx];
  const k = ATTACH_KIND[a.kind] || ATTACH_KIND.other;
  const m = attMeta(doc, a, idx);
  m.docId = src.docId;
  const typeName = {
    grn: '物料验收单', statement: '供应商对账单', contract: '合同摘要',
    quote: '报价单', signin: '会议签到表', receipt: '银行回单',
    photo: '现场照片', generic: '通用文件'
  }[m.type];

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">${e(a.name)}</div>
        <div class="modal-sub">${k.label} · ${a.size || '—'} · 上传人 ${e(a.by || '—')} ${e(a.time || '')}
          · ${doc ? '归属单据 <span class="mono">' + doc.id + '</span>' : '尚未提交（暂存在新建表单里）'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${list.length > 1 ? `<div class="att-nav">
          <button class="btn btn-sm" ${idx === 0 ? 'disabled' : ''} onclick="App.attStep(-1)">‹</button>
          <span class="fs11 c3">${idx + 1} / ${list.length}</span>
          <button class="btn btn-sm" ${idx === list.length - 1 ? 'disabled' : ''} onclick="App.attStep(1)">›</button>
        </div>` : ''}
        <button class="btn btn-sm" onclick="App.backToDoc()">${doc ? '返回单据' : '回到表单'}</button>
        <button class="btn btn-sm" onclick="App.attDownload()">下载</button>
        <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
      </div>
    </div>
    <div class="modal-body vd-body">
      <div class="notice notice-amber" style="font-size:11.5px">
        <div><b>${typeName} · 演示渲染。</b>原型里的附件只有文件名和大小，没有真实文件，
        这里按附件类型还原出这份文件应有的版式与字段，用于验证「审批时到底要看到什么」。
        金额取自单据本体，与单据页一致。</div>
      </div>
      <div class="vd-wrap">${renderMock(a, m)}</div>
    </div>
    <div class="modal-foot">
      <span class="fs11 c3" style="margin-right:auto">
        ${m.type === 'photo' ? '现场照片带拍摄水印与坐标，用于证明"什么时候、在哪儿拍的"' :
          m.type === 'grn' ? '验收单是三单匹配的依据，缺验收单的付款一律退回' :
          m.type === 'receipt' ? '回单金额必须与本单付款金额一致' : '预览只读，修改需重新上传'}
      </span>
      <button class="btn" onclick="App.backToDoc()">${doc ? '返回单据' : '回到表单'}</button>
      <button class="btn btn-primary" onclick="App.attDownload()">下载</button>
    </div>`;
  openModal(html, true);
}

function attStep(dir){
  if (!ATT_CTX) return;
  const n = attSource(ATT_CTX.docId).list.length;
  const next = ATT_CTX.idx + dir;
  if (next < 0 || next >= n) return;
  openAttach(ATT_CTX.docId, next);
}

/* 返回单据：重新打开详情弹窗，而不是一路关回列表——
   审批人在附件和正文之间来回比对是常态，关掉再点开太费事 */
function backToDoc(){
  if (!ATT_CTX) return closeModal();
  const back = ATT_CTX.back;
  ATT_CTX = null;
  if (back) openDoc(back);
  else closeModal();     // 暂存附件：回到表单本身就是关掉弹窗
}

/* 原型里没有真实字节可下载，明说比假装下载一个 0 字节文件好 */
function attDownload(){
  if (!ATT_CTX) return;
  const a = attSource(ATT_CTX.docId).list[ATT_CTX.idx];
  toast(`「${a ? a.name : '附件'}」原型未存真实文件，接入对象存储后这里直接下载`, 'err');
}

/* 银行回单是付款后单独上传的，不在 attach 数组里，单独给个入口 */
function openReceiptView(docId){
  const d = docById(docId);
  if (!d || !d.receipt) return toast('该单据尚未上传回单', 'err');
  openAttach('__receipt__', 0);
}
