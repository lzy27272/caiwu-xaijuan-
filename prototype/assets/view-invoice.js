/* ================= 发票池 / 进项抵扣台账 ================= */

Views['inv-pool'] = function(){
  const total = INVOICES.length;
  const dup = INVOICES.filter(i => i.status === 'dup').length;
  const abnormal = INVOICES.filter(i => i.status === 'abnormal').length;
  const unused = INVOICES.filter(i => i.status === 'unused').length;
  const dedAmt = INVOICES.filter(i => i.deduct === 'yes').reduce((a, b) => a + b.tax, 0);

  const statusTagOf = st => ({
    used: '<span class="tag tag-teal">已报销</span>',
    unused: '<span class="tag tag-blue">待使用</span>',
    dup: '<span class="tag tag-red">查重命中</span>',
    abnormal: '<span class="tag tag-amber">异常凭证</span>'
  })[st] || '';

  const rows = INVOICES.map(iv => {
    const s = storeById(iv.storeId);
    return `<tr onclick="App.openInv('${iv.id}')" style="cursor:pointer" ${iv.status === 'dup' ? 'class="rowdup"' : ''}>
      <td class="fs11">${iv.code}</td>
      <td class="strong">${iv.no}</td>
      <td>${iv.date}</td>
      <td>${e(iv.seller)}</td>
      <td class="num">${fmt(iv.amount)}</td>
      <td class="num">${fmt(iv.tax)}</td>
      <td>${s.name}</td>
      <td>${iv.deduct === 'yes' ? '<span class="tag tag-teal">可抵扣</span>' : '<span class="tag tag-gray">不可抵扣</span>'}</td>
      <td>${statusTagOf(iv.status)}</td>
    </tr>`;
  }).join('');

  const kpi = (label, value, unit, foot, barCls) => `
    <div class="kpi"><div class="kpi-bar ${barCls}"></div><div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}<small>${unit}</small></div>
      <div class="kpi-foot">${foot}</div></div>`;

  return `<div class="grid g-4" style="margin-bottom:14px">
    ${kpi('本期发票', fmt0(total), '张', '<span class="c3">14 家共用发票池</span>', 'bar-blue')}
    ${kpi('可抵扣税额', fmt0(dedAmt), '元', '<span class="c3">按主体分别归集</span>', 'bar-teal')}
    ${kpi('查重拦截', fmt0(dup), '张', '<span class="c3">避免重复报销</span>', 'bar-red')}
    ${kpi('异常凭证', fmt0(abnormal), '张', '<span class="ca">需处理后申报</span>', 'bar-amber')}
  </div>

  <div class="card">
    <div class="card-head">
      <div class="card-title">发票池<small>全集团统一索引，按「发票代码 + 号码」唯一</small></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="fs11 c3">待使用 ${unused} 张</span>
        ${exportBtn('inv-pool')}
        <button class="btn btn-primary btn-sm" onclick="App.go('inv-add')">上传发票</button>
      </div>
    </div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr>
          <th>发票代码</th><th>号码</th><th>开票日期</th><th>销售方</th>
          <th class="num">金额</th><th class="num">税额</th><th>归属主体</th><th>抵扣</th><th>状态</th>
        </tr></thead>
        <tbody>${rows || emptyRow(9, '发票池暂无发票', '可到「发票采集」上传，识别确认后自动入库')}</tbody>
      </table>
    </div>
  </div>

  <div class="grid g-2 mt16">
    <div class="card">
      <div class="card-head"><div class="card-title">查重机制</div></div>
      <div class="card-body" style="font-size:12px;line-height:1.8;color:var(--text-2)">
        <p style="margin-bottom:8px">按 <b>发票代码 + 号码 + 金额 + 开票方</b> 四要素建立全局唯一索引，跨门店、跨期间、跨申请人识别。</p>
        <p style="margin-bottom:8px">命中后不是简单报错，而是展示首次使用明细（门店、单据号、经办人、入账凭证），让员工自己看到"这张票已经用过了"。</p>
        <div class="notice notice-teal" style="font-size:11.5px">这是发票模块唯一能直接产生现金价值的控制点。14 家店人员流动大，纸质时代重复报销几乎无法查证。</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">酒店业抵扣陷阱</div></div>
      <div class="card-body" style="font-size:12px;line-height:1.8;color:var(--text-2)">
        <div class="stat-line"><span>自营餐饮采购食材</span><b class="cy">可抵扣</b></div>
        <div class="stat-line"><span>外购餐饮服务（含外包食堂）</span><b class="cr">不可抵扣</b></div>
        <div class="stat-line"><span>员工餐、集体福利</span><b class="cr">不可抵扣</b></div>
        <div class="stat-line"><span>客户招待餐饮</span><b class="cr">不可抵扣</b></div>
        <div class="stat-line"><span>客房布草、客用品</span><b class="cy">可抵扣</b></div>
        <div class="stat-line"><span>水电燃气（生产运营用）</span><b class="cy">可抵扣</b></div>
        <div class="notice notice-amber mt12" style="font-size:11.5px">系统按费用类目自动打标，不依赖会计个人判断。误抵后一旦被稽查调整，需补税并加收滞纳金。</div>
      </div>
    </div>
  </div>`;
};

function openInv(id){
  const iv = INVOICES.find(i => i.id === id);
  if (!iv) return;
  const s = storeById(iv.storeId);
  const dupOf = iv.status === 'dup' ? INVOICES.find(x => x.code === iv.code && x.no === iv.no && x.id !== iv.id) : null;
  const html = `
    <div class="modal-head">
      <div><div class="modal-title">发票详情 · ${iv.no}</div>
        <div class="modal-sub">${e(iv.seller)} · ${iv.date}</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <tbody>
          <tr><td class="muted" style="width:110px">发票代码</td><td>${iv.code}</td>
              <td class="muted" style="width:110px">发票号码</td><td>${iv.no}</td></tr>
          <tr><td class="muted">开票日期</td><td>${iv.date}</td>
              <td class="muted">票种</td><td>${iv.type}</td></tr>
          <tr><td class="muted">金额 / 税额</td><td>¥${fmt(iv.amount)} / ¥${fmt(iv.tax)}</td>
              <td class="muted">税率</td><td>${pct(iv.rate, 0)}</td></tr>
          <tr><td class="muted">归属主体</td><td colspan="3">${s.entityName} · 税号 ${s.taxNo}</td></tr>
          <tr><td class="muted">费用类目</td><td>${iv.category}</td>
              <td class="muted">抵扣判定</td><td>${iv.deduct === 'yes' ? '<span class="tag tag-teal">可抵扣</span>' : '<span class="tag tag-gray">不可抵扣</span>'}</td></tr>
          ${iv.deductReason ? `<tr><td class="muted">判定依据</td><td colspan="3" class="ca">${e(iv.deductReason)}</td></tr>` : ''}
        </tbody>
      </table>

      ${dupOf ? `<div class="notice notice-red mt12">
        <div><b>查重命中：该发票已被使用</b><br>
        <span style="font-size:11.5px">首次使用门店：${storeById(dupOf.storeId).name}　单据号：${dupOf.docId}　入账状态：已入账　开票方：${e(dupOf.seller)}</span></div>
      </div>` : ''}

      ${iv.status === 'abnormal' ? `<div class="notice notice-amber mt12">
        <div><b>异常凭证：供应商已被认定为非正常户</b><br>
        <span style="font-size:11.5px">处理方式：若已抵扣需做进项税额转出；若未抵扣不得抵扣。请留存供应商失联证明材料备查。</span></div>
      </div>` : ''}
    </div>
    <div class="modal-foot"><button class="btn" onclick="App.closeModal()">关闭</button></div>`;
  openModal(html);
}

/* ---------- 进项抵扣台账 ---------- */
Views['inv-input'] = function(){
  const sid = State.storeId;
  const s = storeById(sid);
  const mine = INVOICES.filter(iv => iv.storeId === sid);
  const yes = mine.filter(i => i.deduct === 'yes');
  const no = mine.filter(i => i.deduct === 'no');
  const sumYes = yes.reduce((a, b) => a + b.tax, 0);

  const line = iv => `<tr>
    <td class="fs11">${iv.no}</td><td>${iv.date}</td><td>${e(iv.seller)}</td>
    <td>${iv.category}</td><td class="num">${fmt(iv.amount)}</td><td class="num">${fmt(iv.tax)}</td>
    <td>${iv.status === 'used' ? '<span class="tag tag-teal">已计入</span>' : '<span class="tag tag-blue">待勾选</span>'}</td>
  </tr>`;

  return `<div class="notice notice-blue" style="margin-bottom:14px">
    <div><b>抵扣台账按纳税主体单独核算。</b>当前查看：<b>${s.entityName}</b>（${s.vatLabel}）。14 个主体各自认证抵扣，<b>本主体的进项税额不得用于其他主体抵扣</b>；勾选操作时系统强制校验主体一致性。</div>
  </div>

  <div class="grid g-3" style="margin-bottom:14px">
    <div class="kpi"><div class="kpi-bar bar-teal"></div><div class="kpi-label">本期可抵扣税额</div>
      <div class="kpi-value">${fmt0(sumYes)}<small>元</small></div><div class="kpi-foot"><span class="c3">${yes.length} 张发票</span></div></div>
    <div class="kpi"><div class="kpi-bar bar-gray"></div><div class="kpi-label">不可抵扣税额</div>
      <div class="kpi-value">${fmt0(no.reduce((a, b) => a + b.tax, 0))}<small>元</small></div><div class="kpi-foot"><span class="c3">${no.length} 张，已计入费用</span></div></div>
    <div class="kpi"><div class="kpi-bar bar-amber"></div><div class="kpi-label">本期应交增值税</div>
      <div class="kpi-value">${fmt0(s.vat)}<small>元</small></div><div class="kpi-foot"><span class="c3">销项 − 进项（示例）</span></div></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head"><div class="card-title">可抵扣进项（已认证）</div>${exportBtn('inv-input')}</div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>发票号</th><th>开票日期</th><th>销售方</th><th>类目</th><th class="num">金额</th><th class="num">税额</th><th>状态</th></tr></thead>
        <tbody>${yes.length ? yes.map(line).join('') : emptyRow(7, '本主体本期没有可抵扣进项', '小规模纳税人不涉及进项抵扣')}</tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title">不可抵扣 / 需转出</div></div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>发票号</th><th>开票日期</th><th>销售方</th><th>类目</th><th class="num">金额</th><th class="num">税额</th><th>原因</th></tr></thead>
        <tbody>${no.length ? no.map(iv => `<tr>
          <td class="fs11">${iv.no}</td><td>${iv.date}</td><td>${e(iv.seller)}</td><td>${iv.category}</td>
          <td class="num">${fmt(iv.amount)}</td><td class="num">${fmt(iv.tax)}</td>
          <td class="fs11 ca">${e(iv.deductReason || '')}</td></tr>`).join('') : emptyRow(7, '没有需转出的进项税')}</tbody>
      </table>
    </div>
  </div>`;
};
