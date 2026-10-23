/* ================= 报表导出 =================
   两条硬约束决定了实现方式：
     1. 零依赖、file:// 可直开 —— 不能用 xlsx.js / jsPDF（见 09 号文档）
     2. 表格里混着 <div class="strong">、<span class="tag">、↑↓ 箭头、进度条、纯色圆点
    → Excel 走 CSV（带 BOM），PDF 走浏览器打印；
    → 取数走数据层的 ReportData，不从 DOM 抽文本。

   为什么不用 DOM 抽取：结账清单的"通过/未通过"是一个 ✓ / ! 的圆点，没有文字。
   innerText 抓出来是空字符串，导出整列空白，而且不报错——比报错更难发现。
   数据层取数还有个好处：改样式不会把导出改坏，且取数函数是纯函数，可以直接断言。 */

/* ---------- 报表取数：每个报表一个纯函数，返回 {title, subtitle, headers, rows, note} ----------
   subtitle 必须写清口径（集团合计 / 单主体），因为导出文件会脱离页面上下文被转发、归档，
   标题里的口径说明是读者判断"这是什么数"的唯一依据。 */
/* 单据状态文案：必须与页面 statusTag() 的映射一致。
   两处各写一份是零依赖下的妥协，但值必须相同——否则导出文件里的"审批中"
   和屏幕上的"审批中"对不上，用户会以为是两份数据。test.js 里有断言比对。 */
const DOC_STATUS = {
  pending:'审批中', approved:'已审批', rejected:'已驳回', paid:'已付款', draft:'草稿'
};

const ReportData = {};

(function(){

  const money = n => Math.round(n * 100) / 100;   // 导出保留 2 位，不写千分位（Excel 会把带逗号的当文本）

  /* ---- 单店损益表 ---- */
  ReportData['report-pl'] = function(){
    const s = storeById(State.storeId);
    const net = s.revenueNet;
    const row = (label, val, indent) => [
      (indent ? '　' + label : label),
      money(val),
      net ? +(val / net).toFixed(4) : null,        // 百分比导出小数，Excel 才能做运算
      money(val / PERIOD.days),
      money(val / s.availableRooms * PERIOD.days)
    ];
    return {
      title: '单店损益表',
      subtitle: `${s.name} · ${s.entityName} · ${PERIOD.label} · 管理口径 · 单位：元`,
      headers: ['项目', '本月金额', '占收入比', '日均', '单房日'],
      rows: [
        row('营业收入（不含税）', net),
        row('客房收入', s.roomRev / 1.06, 1),
        row('餐饮收入', s.fbRev / 1.06, 1),
        row('其他收入', s.otherRev / 1.06, 1),
        row('减：OTA 佣金', -s.otaComm, 1),
        row('营业收入净额', net),
        row('部门成本', -(s.roomCost + s.fbCost)),
        row('客房成本', -s.roomCost, 1),
        row('餐饮成本', -s.fbCost, 1),
        row('部门毛利', s.deptProfit),
        row('未分配营业费用', -s.opexTotal),
        row('人力成本', -s.labor, 1),
        row('能源费', -s.energy, 1),
        row('维修保养费', -s.repair, 1),
        row('物料消耗', -s.supply, 1),
        row('市场推广费', -s.mkt, 1),
        row('办公及其他费用', -s.admin, 1),
        row('营业毛利（GOP）', s.gop),
        row('折旧与摊销', -s.depreciation),
        row('总部管理费', -s.mgmtFee, 1),
        row('财务费用', -s.finance, 1),
        row('税金及附加', -s.surtax, 1),
        row('利润总额', s.netProfit + s.incomeTax),
        row('所得税费用', -s.incomeTax, 1),
        row('净利润', s.netProfit)
      ],
      note: '扣除所得税按小型微利口径示例计算；OTA 佣金按总额法计入销售费用，不冲减收入。'
    };
  };

  /* ---- 集团经营总览：14 家门店矩阵 ---- */
  ReportData['dashboard-group'] = function(){
    return {
      title: '集团门店经营矩阵',
      subtitle: `集团 14 家合计 · ${PERIOD.label} · 含税收入口径 · 金额单位：元`,
      headers: ['门店', '营业执照主体', '出租率', '均价', 'RevPAR', '收入', 'GOP', 'GOP率', '预算执行率'],
      rows: STORES.map(s => [
        s.name, s.entityName,
        +s.occ.toFixed(4), s.adr, s.revpar,
        s.totalRev, s.gop, +s.gopRate.toFixed(4), +s.budgetRate.toFixed(4)
      ]),
      note: `数据范围：集团 14 家独立法人合计，含税收入；GOP 率与预算执行率按不含税收入计算。`
    };
  };

  /* ---- 成本费用结构 ---- */
  ReportData['dashboard-cost'] = function(){
    const g = GROUP;
    const items = [
      ['人力成本', g.storeCount && STORES.reduce((a, s) => a + s.labor, 0)],
      ['能源费', STORES.reduce((a, s) => a + s.energy, 0)],
      ['客房成本', STORES.reduce((a, s) => a + s.roomCost, 0)],
      ['餐饮成本', STORES.reduce((a, s) => a + s.fbCost, 0)],
      ['OTA 佣金', STORES.reduce((a, s) => a + s.otaComm, 0)],
      ['维修保养', STORES.reduce((a, s) => a + s.repair, 0)],
      ['物料消耗', STORES.reduce((a, s) => a + s.supply, 0)],
      ['市场推广', STORES.reduce((a, s) => a + s.mkt, 0)],
      ['办公及其他', STORES.reduce((a, s) => a + s.admin, 0)]
    ];
    return {
      title: '集团成本费用结构',
      subtitle: `集团 14 家合计 · ${PERIOD.label} · 单位：元`,
      headers: ['费用项目', '金额', '占收入比'],
      rows: items.map(([n, v]) => [n, money(v), g.revenueNet ? +(v / g.revenueNet).toFixed(4) : null]),
      note: '占收入比的分母为不含税营业收入。'
    };
  };

  /* ---- 单店经营详情 ---- */
  ReportData['dashboard-store'] = function(){
    const s = storeById(State.storeId);
    return {
      title: '单店经营详情',
      subtitle: `${s.name} · ${s.entityName} · ${PERIOD.label} · 单位：元`,
      headers: ['指标', '本年', '去年同期', '同比'],
      /* 后四项没有去年同期数：导空字符串而不是 null。
         CSV 里 null 走 csvCell 也是空，但 '' 语义明确是「无此数据」，
         免得后续接入真数据时误判为「算出来是空」。 */
      rows: [
        ['出租率', +s.occ.toFixed(4), +s.occLy.toFixed(4), s.occLy ? +((s.occ - s.occLy) / s.occLy).toFixed(4) : ''],
        ['平均房价 ADR', s.adr, s.adrLy, s.adrLy ? +((s.adr - s.adrLy) / s.adrLy).toFixed(4) : ''],
        ['RevPAR', s.revpar, s.revparLy, s.revparLy ? +((s.revpar - s.revparLy) / s.revparLy).toFixed(4) : ''],
        ['营业收入（含税）', s.totalRev, s.revenueTotalLy, s.revenueTotalLy ? +((s.totalRev - s.revenueTotalLy) / s.revenueTotalLy).toFixed(4) : ''],
        ['营业收入（不含税）', s.revenueNet, '', ''],
        ['部门毛利', s.deptProfit, '', ''],
        ['营业毛利 GOP', s.gop, '', ''],
        ['净利润', s.netProfit, '', '']
      ],
      note: '出租率与房价为含税口径；去年同期为模拟值。'
    };
  };

  /* ---- 营业收入调节表（双口径衔接） ---- */
  ReportData['report-bridge'] = function(){
    const s = storeById(State.storeId);
    const pmsRev = s.totalRev;
    const net = s.revenueNet;
    /* 推导顺序要和页面上那张表一致，否则导出文件跟屏幕上看到的两套数：
       含税 → 价税分离得申报销售额 → 申报销售额 − 佣金 = 总账收入。
       佣金要在"申报销售额"之后减：申报表按含税/1.06 填，佣金不进申报表。 */
    const vatSales = pmsRev / 1.06;
    const vatAmount = pmsRev - vatSales;
    const ota = s.otaComm;
    const diff = vatSales - ota - net;
    return {
      title: '营业收入调节表',
      subtitle: `${s.name} · ${s.entityName} · ${PERIOD.label} · 双口径衔接 · 单位：元`,
      headers: ['项目', '金额', '口径说明'],
      rows: [
        ['PMS 日结营业收入（含税）', money(pmsRev), 'PMS 经营口径，T+1 08:30 取数'],
        ['减：增值税销项税额', money(-vatAmount), '价税分离，住宿与餐饮服务适用 6%'],
        ['增值税申报销售额', money(vatSales), '与申报表主表第 1 栏核对'],
        ['减：OTA 佣金', money(-ota), '总额法：佣金计入销售费用，不从申报销售额中扣除'],
        ['总账营业收入（不含税）', money(net), '总账会计口径，关账后取数'],
        ['差异', money(diff), diff === 0 ? '勾稽相符' : '不为 0 需逐项核对']
      ],
      note: '本表用于衔接「日报看 PMS、月报看总账」两个口径，差异行应为 0。'
    };
  };

  /* ---- 发票池 ---- */
  ReportData['inv-pool'] = function(){
    return {
      title: '发票池清单',
      subtitle: `集团 14 家共用发票池 · ${INVOICES.length} 张 · 按主体隔离抵扣`,
      headers: ['发票代码', '发票号码', '开票日期', '销售方', '金额', '税额', '税率', '归属主体', '抵扣', '状态'],
      rows: INVOICES.map(iv => {
        const s = storeById(iv.storeId);
        return [iv.code, iv.no, iv.date, iv.seller, iv.amount, iv.tax,
          +iv.rate.toFixed(4), s.name,
          iv.deduct === 'yes' ? '可抵扣' : '不可抵扣',
          { used:'已报销', unused:'待使用', dup:'查重命中', abnormal:'异常凭证' }[iv.status] || iv.status];
      }),
      note: '税额为票面实际值，未按税率倒算；小规模纳税人主体不涉及进项抵扣。'
    };
  };

  /* ---- 进项抵扣台账（按主体） ---- */
  ReportData['inv-input'] = function(){
    const s = storeById(State.storeId);
    const mine = INVOICES.filter(iv => iv.storeId === s.id);
    return {
      title: '进项抵扣台账',
      subtitle: `${s.name} · ${s.entityName} · ${s.taxNo} · ${s.vatLabel}`,
      headers: ['发票号码', '开票日期', '销售方', '费用类目', '金额', '税额', '抵扣判定', '判定依据'],
      rows: mine.map(iv => [iv.no, iv.date, iv.seller, iv.category, iv.amount, iv.tax,
        iv.deduct === 'yes' ? '可抵扣' : '不可抵扣', iv.deductReason || '']),
      note: `进项税额只能由本主体抵扣，不得跨主体使用。当前主体为${s.vatLabel}。`
    };
  };

  /* ---- 结账检查清单 ---- */
  ReportData['acc-close'] = function(){
    const heads = CLOSE_CHECKS.map(c => c.label);
    return {
      title: '月末结账检查清单',
      subtitle: `集团 14 家并行关账 · ${PERIOD.label}`,
      headers: ['门店', '营业执照主体'].concat(heads).concat(['状态']),
      rows: STORES.map(s => {
        const checks = CLOSE_CHECKS.map(c => c.bad.includes(s.id) ? '未通过' : '通过');
        const bad = CLOSE_CHECKS.filter(c => c.bad.includes(s.id)).length;
        return [s.name, s.entityName].concat(checks).concat([bad ? `未通过 ${bad} 项` : '全部通过']);
      }),
      note: '通过/未通过在原型页面上显示为圆点，导出时转换为文字，否则整列为空。'
    };
  };

  /* ---- 预算执行 ---- */
  ReportData['budget'] = function(){
    return {
      title: '集团费用预算执行',
      subtitle: `2026 年度 · 截至 ${PERIOD.label} · 单位：元`,
      headers: ['费用项目', '年度预算', '已用', '在途', '可用', '执行率', '状态'],
      rows: BUDGETS.map(b => {
        const avail = b.budget - b.used - b.inTrans;
        const rate = b.budget ? (b.used + b.inTrans) / b.budget : null;
        return [b.item, b.budget, b.used, b.inTrans, avail, rate === null ? null : +rate.toFixed(4),
          avail < 0 ? '超支' : rate > .95 ? '临近' : '正常'];
      }),
      note: '「在途」为已提交未审批、已审批未付款的占用额，不重复扣减；可用 = 预算 − 已用 − 在途。'
    };
  };

  /* ---- 法人主体主数据 ---- */
  ReportData['master'] = function(){
    return {
      title: '14 个独立法人主体',
      subtitle: '各自执照、独立开票、独立申报',
      headers: ['门店', '城市', '营业执照主体', '统一社会信用代码', '成立日期', '纳税人身份', '客房数'],
      rows: STORES.map(s => [s.name, s.city, s.entityName, s.taxNo, s.foundDate || '', s.vatLabel, s.rooms]),
      note: '纳税人身份直接决定进项能否抵扣、申报频次与销项税率，不得混用。'
    };
  };

  /* ---- 凭证列表 ---- */
  ReportData['acc-voucher'] = function(){
    return {
      title: '凭证列表',
      subtitle: `${PERIOD.label} · 业务单据与 PMS 日结自动生成`,
      headers: ['凭证号', '日期', '主体', '摘要', '来源', '金额', '状态'],
      rows: VOUCHERS.map(v => [v.id, v.date, storeById(v.storeId).entityName, v.summary, v.source,
        v.amount, v.status === 'posted' ? '已过账' : '待审核']),
      note: '凭证金额为借贷方合计，借贷必须平衡。'
    };
  };

  /* ---- 我的单据 ---- */
  ReportData['flow-my'] = function(){
    const list = State.docs.filter(d => inScope(d));
    return {
      title: '单据清单',
      subtitle: `${ROLES[State.role].name} 可见范围 · ${PERIOD.label}`,
      headers: ['单据号', '类型', '门店', '申请人', '事由', '金额', '状态'],
      rows: list.map(d => [d.id, d.typeLabel, storeById(d.storeId).name, d.applicant, d.title,
        d.amount, DOC_STATUS[d.status] || d.status]),
      note: '金额为该单据核定金额，含税。'
    };
  };

})();

/* ================= 导出实现 ================= */

/* ---------- CSV ---------- */
function csvCell(v){
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* BOM 不能省：不加 \uFEFF，Excel 双击打开中文全是乱码，WPS 也一样。
   数值导出不加千分位——'1,234.00' 会被 Excel 当文本，求和结果是 0，而用户不会立刻发现。 */
function exportCsv(pageId){
  const d = (ReportData[pageId] || ReportData['report-pl'])();
  const lines = [];
  lines.push([d.title].map(csvCell).join(','));
  lines.push([d.subtitle].map(csvCell).join(','));
  lines.push('');
  lines.push(d.headers.map(csvCell).join(','));
  d.rows.forEach(r => lines.push(r.map(csvCell).join(',')));
  if (d.note){
    lines.push('');
    lines.push(['说明：' + d.note].map(csvCell).join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(d.title, 'csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('已导出 CSV，可直接用 Excel / WPS 打开');
}

function fileName(title, ext){
  const s = storeById(State.storeId);
  const single = ['report-pl', 'report-bridge', 'dashboard-store', 'inv-input'].includes(State.page);
  const scope = single ? '_' + s.name : '';
  const period = String(PERIOD.year) + String(PERIOD.month).padStart(2, '0');
  return `${title}${scope}_${period}.${ext}`.replace(/[\\/:*?"<>|]/g, '-');
}

/* ---------- PDF：走浏览器打印 ----------
   纯前端造 PDF 需要给中文字体做子集嵌入（十几 MB），不现实。
   打印成 PDF 时文件名取 document.title，所以先临时改名，打完再恢复。 */
function exportPdf(pageId){
  const d = (ReportData[pageId] || ReportData['report-pl'])();
  const oldTitle = document.title;
  document.title = fileName(d.title, '').replace(/\.$/, '');

  document.body.classList.add('printing');
  const card = document.querySelector('.content .card');
  if (card) card.classList.add('print-target');

  // 打印是同步阻塞的，DOM 修改必须在同一执行栈内完成，print() 返回后才开始布局
  window.print();

  // 不用 onafterprint：部分浏览器不触发；直接在下一次事件循环恢复即可
  setTimeout(() => {
    document.body.classList.remove('printing');
    if (card) card.classList.remove('print-target');
    document.title = oldTitle;
  }, 300);
}

/* ---------- 统一入口：导出前先给用户看口径 ---------- */
function exportDialog(pageId){
  const d = ReportData[pageId];
  if (!d){
    toast('当前页面暂不支持导出', 'err');
    return;
  }
  const s = storeById(State.storeId);
  const single = ['report-pl', 'report-bridge', 'dashboard-store', 'inv-input'].includes(pageId);
  const rows = single ? d.rows.length : d.rows.length;

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">导出「${e(d.title)}」</div>
        <div class="modal-sub">${e(d.subtitle)}</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <tbody>
          <tr><td class="muted" style="width:96px">数据口径</td>
              <td><b>${single ? '单主体 · ' + e(s.entityName) : '集团 14 家合计'}</b></td></tr>
          <tr><td class="muted">会计期间</td><td>${PERIOD.label}</td></tr>
          <tr><td class="muted">数据规模</td><td>${rows} 行 × ${d.headers.length} 列</td></tr>
          <tr><td class="muted">文件名</td><td class="fs11">${e(fileName(d.title, 'csv'))}</td></tr>
        </tbody>
      </table>

      ${d.note ? `<div class="notice notice-blue mt12"><div>${e(d.note)}</div></div>` : ''}

      <div class="notice notice-amber mt12">
        <div><b>两种格式的差别：</b>
        <div style="margin-top:5px;line-height:1.75">
          <b>Excel（CSV）</b>——数值是真数值，可以直接求和、做透视表；不含格式与公式。<br>
          <b>PDF</b>——保留页面版式，适合打印和归档；在打印对话框里选「另存为 PDF」。
        </div></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn" onclick="App.doExportPdf('${pageId}')">导出 PDF</button>
      <button class="btn btn-primary" onclick="App.doExportCsv('${pageId}')">导出 Excel（CSV）</button>
    </div>`;
  openModal(html);
}

function doExportCsv(pageId){ closeModal(); setTimeout(() => exportCsv(pageId), 120); }
function doExportPdf(pageId){ closeModal(); setTimeout(() => exportPdf(pageId), 120); }

/* 哪些页面可以导出（决定卡片头是否出现导出按钮） */
const EXPORTABLE = ['dashboard-group', 'dashboard-store', 'report-pl', 'report-bridge',
  'inv-pool', 'inv-input', 'acc-close', 'budget', 'master', 'acc-voucher', 'flow-my'];

function exportBtn(pageId){
  if (!EXPORTABLE.includes(pageId)) return '';
  return `<button class="btn btn-sm" onclick="App.exportDialog('${pageId}')">导出</button>`;
}
