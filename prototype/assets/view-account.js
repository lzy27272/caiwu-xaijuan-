/* ================= 凭证 / 结账 / 预算 / 主数据 ================= */

Views['acc-voucher'] = function(){
  const rows = VOUCHERS.map(v => {
    const s = storeById(v.storeId);
    return `<tr onclick="App.openVoucher('${v.id}')" style="cursor:pointer">
      <td class="strong fs11">${v.id}</td>
      <td>${v.date}</td>
      <td>${s.name}</td>
      <td>${v.summary}</td>
      <td><span class="tag ${v.source === 'PMS日结' ? 'tag-blue' : 'tag-gray'}">${v.source}</span></td>
      <td class="num">${fmt(v.amount)}</td>
      <td>${v.status === 'posted' ? '<span class="tag tag-teal">已记账</span>' : '<span class="tag tag-amber">待审核</span>'}</td>
    </tr>`;
  }).join('');

  return `<div class="grid g-3" style="margin-bottom:14px">
    <div class="kpi"><div class="kpi-bar bar-blue"></div><div class="kpi-label">本月凭证</div>
      <div class="kpi-value">2,846<small>张</small></div>
      <div class="kpi-foot"><span class="c3">14 家合计</span></div></div>
    <div class="kpi"><div class="kpi-bar bar-teal"></div><div class="kpi-label">自动生成占比</div>
      <div class="kpi-value">91.2<small>%</small></div>
      <div class="kpi-foot"><span class="c3">PMS 日结 + 单据推送</span></div></div>
    <div class="kpi"><div class="kpi-bar bar-amber"></div><div class="kpi-label">待审核</div>
      <div class="kpi-value">37<small>张</small></div>
      <div class="kpi-foot"><span class="c3">含 4 张异常待处理</span></div></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div class="card-title">PMS 日结 → 凭证<small>收入数据自动结转，不再手工录凭证</small></div>
      <button class="btn btn-sm btn-primary" onclick="App.pmsPreview()">演示：导入日结数据</button>
    </div>
    <div class="card-body" style="font-size:12px;line-height:1.8;color:var(--text-2)">
      每日夜审后，PMS 日结数据自动推送，系统按预设规则生成收入结转凭证。跨日账、免费房、冲账、挂账四类脏数据按统一口径处理，尾差自动计入「营业外收入-尾差收入」。
      <div class="grid g-4 mt12">
        <div class="stat-line"><span>跨日账归属</span><b>按夜审日</b></div>
        <div class="stat-line"><span>免费房</span><b>不计收入</b></div>
        <div class="stat-line"><span>冲账</span><b>红字冲销</b></div>
        <div class="stat-line"><span>尾差</span><b>5301.04</b></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title">凭证列表</div>${exportBtn('acc-voucher')}</div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>凭证号</th><th>日期</th><th>主体</th><th>摘要</th><th>来源</th><th class="num">金额</th><th>状态</th></tr></thead>
        <tbody>${rows || emptyRow(7, '本期没有凭证', 'PMS 日结完成后会自动生成')}</tbody>
      </table>
    </div>
  </div>`;
};

function openVoucher(id){
  const v = VOUCHERS.find(x => x.id === id);
  if (!v) return;
  const s = storeById(v.storeId);
  const dr = v.lines.reduce((a, b) => a + b.debit, 0);
  const cr = v.lines.reduce((a, b) => a + b.credit, 0);
  const rows = v.lines.map(l => `<tr>
    <td class="fs11">${l.subj}</td><td>${l.name}</td>
    <td class="num">${l.debit ? fmt(l.debit) : ''}</td>
    <td class="num">${l.credit ? fmt(l.credit) : ''}</td>
  </tr>`).join('');

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">记账凭证 · ${v.id}</div>
        <div class="modal-sub">${s.entityName} · ${v.date} · ${v.summary}</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <thead><tr><th>科目编码</th><th>科目名称</th><th class="num">借方</th><th class="num">贷方</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="row-total"><td colspan="2">合计</td><td class="num">${fmt(dr)}</td><td class="num">${fmt(cr)}</td></tr></tfoot>
      </table>
      <div class="notice ${Math.abs(dr - cr) < 0.01 ? 'notice-teal' : 'notice-red'} mt12" style="font-size:11.5px">
        <div>${Math.abs(dr - cr) < 0.01 ? '借贷平衡，凭证校验通过。所有维度（主体 / 门店 / 部门 / 费用项目）由源单据自动继承，不允许在凭证上手工改维度。' : '借贷不平衡，凭证不可记账。'}</div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="App.closeModal()">关闭</button></div>`;
  openModal(html, true);
}

function pmsPreview(){
  const s = storeById(State.storeId);
  const html = `
    <div class="modal-head">
      <div><div class="modal-title">PMS 日结导入预览</div>
        <div class="modal-sub">${s.name} · 2026-09-30 · 夜审数据</div></div>
      <button class="btn btn-sm" onclick="App.closeModal()">关闭</button>
    </div>
    <div class="modal-body">
      <div class="section-title">原始日结数据</div>
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <tbody>
          <tr><td class="muted">已售房 / 可售房</td><td>${s.rooms} / ${s.rooms}</td><td class="muted">出租率</td><td>${pct(s.occ)}</td></tr>
          <tr><td class="muted">客房收入（含税）</td><td>¥${fmt(s.roomRev / 30)}</td><td class="muted">餐饮收入</td><td>¥${fmt(s.fbRev / 30)}</td></tr>
          <tr><td class="muted">免费房 / 内部房</td><td>3 间</td><td class="muted">冲账笔数</td><td>1 笔</td></tr>
          <tr><td class="muted">应收挂账</td><td>¥${fmt(4850)}</td><td class="muted">OTA 待结算</td><td>¥${fmt(9870)}</td></tr>
        </tbody>
      </table>

      <div class="section-title">将生成的凭证（自动）</div>
      <table class="table" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <thead><tr><th>科目</th><th>名称</th><th class="num">借方</th><th class="num">贷方</th></tr></thead>
        <tbody>
          <tr><td class="fs11">1002.01</td><td>银行存款-人民币户</td><td class="num">${fmt(45180.45)}</td><td class="num"></td></tr>
          <tr><td class="fs11">1122.02</td><td>应收账款-OTA平台</td><td class="num">${fmt(9870)}</td><td class="num"></td></tr>
          <tr><td class="fs11">1122.01</td><td>应收账款-协议单位挂账</td><td class="num">${fmt(4850)}</td><td class="num"></td></tr>
          <tr><td class="fs11">5001.01.04</td><td>客房收入-OTA</td><td class="num"></td><td class="num">${fmt(32800)}</td></tr>
          <tr><td class="fs11">5001.01.01</td><td>客房收入-散客</td><td class="num"></td><td class="num">${fmt(21400)}</td></tr>
          <tr><td class="fs11">5001.02.01</td><td>餐饮收入-中餐</td><td class="num"></td><td class="num">${fmt(11860)}</td></tr>
          <tr><td class="fs11">2221.01.02</td><td>应交增值税-销项税额</td><td class="num"></td><td class="num">${fmt(3867.20)}</td></tr>
          <tr><td class="fs11">5301.04</td><td>营业外收入-尾差收入</td><td class="num"></td><td class="num">0.05</td></tr>
        </tbody>
        <tfoot><tr class="row-total"><td colspan="2">合计</td><td class="num">${fmt(69900.45)}</td><td class="num">${fmt(69900.45)}</td></tr></tfoot>
      </table>
      <div class="notice notice-amber mt12" style="font-size:11.5px">
        <div><b>尾差 0.05 元</b>自动计入「营业外收入-尾差收入」，不强行调整收入科目。3 间免费房不计收入，仅将对应客用品成本计入客房成本。</div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="App.confirmPms()">确认生成</button>
    </div>`;
  openModal(html, true);
}

function confirmPms(){
  closeModal();
  toast('已生成 14 家收入结转凭证，共 14 张', 'ok');
}

/* ---------- 月末结账 ---------- */
Views['acc-close'] = function(){
  /* 检查项在 9 项固定校验之外，追加一项动态校验：付款是否都有银行回单 */
  const missingReceipt = Array.from(new Set(State.docs.filter(d => d.status === 'paid' && !d.receipt).map(d => d.storeId)));
  const CHECKS = CLOSE_CHECKS.concat([{ key:'receipt', label:'银行回单已全部归档', bad: missingReceipt }]);
  const head = CHECKS.map(c => `<th class="nowrap" style="font-size:10.5px;text-align:center;max-width:76px">${c.label}</th>`).join('');
  const body = STORES.map(s => {
    const cells = CHECKS.map(c => {
      const bad = c.bad.includes(s.id);
      return `<td style="text-align:center">${bad
        ? '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--red-50);color:var(--red-600);font-size:10px;line-height:16px">!</span>'
        : '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--teal-50);color:var(--teal-600);font-size:10px;line-height:16px">✓</span>'}</td>`;
    }).join('');
    const badCount = CHECKS.filter(c => c.bad.includes(s.id)).length;
    return `<tr>
      <td><div class="strong">${s.name}</div><div class="fs11 c3">${s.city} · ${s.rooms} 间</div></td>
      ${cells}
      <td style="text-align:center">${badCount
        ? `<span class="tag tag-red">${badCount} 项</span>`
        : `<span class="tag tag-teal">可关账</span>`}</td>
    </tr>`;
  }).join('');

  /* 未通过项明细：全绿时原来的写法是整卡留白，容易被当成没加载出来 */
  const badRows = STORES.map(s => {
    const bad = CHECKS.filter(c => c.bad.includes(s.id));
    if (!bad.length) return '';
    return `<div class="alert-item">
      <div class="alert-dot dot-p1"></div>
      <div class="alert-main">
        <div class="alert-title">${s.name}</div>
        <div class="alert-meta">${bad.map(b => b.label).join('；')}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="notice notice-blue" style="margin-bottom:14px">
    <div><b>14 家并行结账检查。</b>每项校验未通过的单元格显示为提示点，点击可跳转处理。全部通过后方可执行关账——关账后当期凭证锁定，调整需走红字冲销并由总部财务复核。</div>
  </div>

  <div class="card">
    <div class="card-head">
      <div class="card-title">2026 年 9 月结账检查清单</div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="tag tag-amber">4 家存在未通过项</span>
        ${exportBtn('acc-close')}
        <button class="btn btn-sm" onclick="App.finishClose()">执行关账</button>
      </div>
    </div>
    <div class="card-body tight" style="overflow-x:auto">
      <table class="table" style="min-width:860px">
        <thead><tr><th style="min-width:130px">门店 / 主体</th>${head}<th style="text-align:center">状态</th></tr></thead>
        <tbody>${body || emptyRow(11, '暂无门店')}</tbody>
      </table>
    </div>
  </div>

  <div class="grid g-2 mt16">
    <div class="card">
      <div class="card-head"><div class="card-title">结账顺序（不可颠倒）</div></div>
      <div class="card-body">
        <div class="timeline">
          <div class="tl-item ok"><div class="tl-main">业务单据全部审批完成</div><div class="tl-sub">报销、付款、收款认领</div></div>
          <div class="tl-item ok"><div class="tl-main">PMS 日结与总账收入核对</div><div class="tl-sub">差异率 &gt; 1% 需说明</div></div>
          <div class="tl-item ok"><div class="tl-main">发票认证与进项税归集</div><div class="tl-sub">按主体分别完成</div></div>
          <div class="tl-item ok"><div class="tl-main">往来账龄复核与坏账计提</div><div class="tl-sub">超 90 天逐笔确认</div></div>
          <div class="tl-item now"><div class="tl-main">折旧、摊销、计提</div><div class="tl-sub">当前步骤</div></div>
          <div class="tl-item"><div class="tl-main">损益结转、生成报表</div></div>
          <div class="tl-item"><div class="tl-main">关账并锁定</div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">未通过项明细</div></div>
      <div class="card-body tight">
        ${badRows || emptyState({ title:'14 家门店全部通过结账检查', desc:'本月无未通过项，可正常关账' })}
      </div>
    </div>
  </div>`;
};

function finishClose(){
  toast('存在 4 家未通过校验，无法执行关账。请先处理未通过项。', 'err');
}

/* ---------- 预算执行 ---------- */
Views['budget'] = function(){
  const rows = BUDGETS.map(b => {
    const avail = b.budget - b.used - b.inTrans;
    const rate = b.budget ? (b.used + b.inTrans) / b.budget : 0;   // 预算为 0 时避免除零算出 Infinity
    const over = avail < 0;
    return `<tr>
      <td class="strong">${b.item}</td>
      <td class="num">${fmt(b.budget)}</td>
      <td class="num">${fmt(b.used)}</td>
      <td class="num">${fmt(b.inTrans)}</td>
      <td class="num ${over ? 'cr strong' : ''}">${fmt(avail)}</td>
      <td style="width:150px">
        <div class="progress"><div class="progress-in ${over ? 'p-red' : rate > .95 ? 'p-amber' : 'p-teal'}" style="width:${Math.min(rate * 100, 100)}%"></div></div>
      </td>
      <td class="num ${over ? 'cr' : ''}">${pct(rate)}</td>
      <td>${over ? '<span class="tag tag-red">超支</span>' : rate > .95 ? '<span class="tag tag-amber">临近</span>' : '<span class="tag tag-teal">正常</span>'}</td>
    </tr>`;
  }).join('');

  return `<div class="notice notice-amber" style="margin-bottom:14px">
    <div><b>预算控制强度分三档：</b>强控项目（客房物料、能耗、维修）超出即阻断，需走超预算审批；弱控项目（市场推广、办公）超出给警告并自动加一级审批；监控项目（租赁、折旧）只做执行分析不阻断。</div>
  </div>
  <div class="card">
    <div class="card-head"><div class="card-title">集团费用预算执行<small>2026 年 9 月 · 集团合计</small></div>${exportBtn('budget')}</div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>费用项目</th><th class="num">年度预算</th><th class="num">已用</th><th class="num">在途</th><th class="num">可用</th><th></th><th class="num">执行率</th><th>状态</th></tr></thead>
        <tbody>${rows || emptyRow(8, '暂无预算项目')}</tbody>
      </table>
    </div>
  </div>
  <div class="notice notice-blue mt16">
    <div><b>「在途」是关键字段。</b>已提交未审批、已审批未付款的金额都要占用预算，否则会出现在同一周内多张单据各自都"没超预算"、合计却已超支的情况。很多线上审批系统漏掉这一栏，预算控制就形同虚设。</div>
  </div>`;
};

/* ---------- 主数据 ---------- */
Views['master'] = function(){
  const rows = STORES.map(s => `<tr>
    <td><div class="strong">${s.name}</div><div class="fs11 c3">${s.city}</div></td>
    <td class="fs11">${s.entityName}</td>
    <td class="fs11" style="font-family:ui-monospace,monospace">${s.taxNo}</td>
    <td class="fs11">${s.foundDate || '—'}</td>
    <td>${s.vat === 'general'
        ? '<span class="tag tag-blue">一般纳税人</span>'
        : '<span class="tag tag-gray">小规模纳税人</span>'}</td>
    <td class="num">${s.rooms}</td>
    <td><span class="tag tag-teal">独立账套</span></td>
  </tr>`).join('');

  const subj = SUBJECTS.map(x => `<tr>
    <td class="fs11" style="padding-left:${10 + (x.lv - 1) * 20}px">${x.code}</td>
    <td>${x.name}</td>
    <td>${x.lv === 1 ? '<span class="tag tag-blue">一级</span>' : x.lv === 2 ? '<span class="tag tag-gray">二级</span>' : '<span class="tag tag-gray">三级</span>'}</td>
  </tr>`).join('');

  return `<div class="card" style="margin-bottom:14px">
    <div class="card-head"><div class="card-title">14 个独立法人主体<small>各自执照、独立开票、独立申报</small></div>${exportBtn('master')}</div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr><th>门店</th><th>营业执照主体</th><th>统一社会信用代码</th><th>成立日期</th><th>纳税人身份</th><th class="num">客房数</th><th>核算</th></tr></thead>
        <tbody>${rows || emptyRow(7, '暂无主体数据')}</tbody>
      </table>
    </div>
  </div>

  <div class="grid g-2">
    <div class="card">
      <div class="card-head"><div class="card-title">统一会计科目表<small>节选</small></div></div>
      <div class="card-body tight" style="max-height:420px;overflow-y:auto">
        <table class="table"><tbody>${subj || emptyRow(3, '暂无科目')}</tbody></table>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">科目控制规则</div></div>
      <div class="card-body" style="font-size:12px;line-height:1.8;color:var(--text-2)">
        <div class="stat-line"><span>一级科目</span><b>集团统一锁定，不可增删</b></div>
        <div class="stat-line"><span>二级明细</span><b>集团统一发布，门店只读</b></div>
        <div class="stat-line"><span>三级明细</span><b>按需申请，总部审批</b></div>
        <div class="stat-line"><span>门店自建科目</span><b class="cr">禁止</b></div>
        <div class="stat-line"><span>部门 / 费用项目</span><b>走辅助核算维度</b></div>
        <div class="stat-line"><span>受控科目</span><b>只能由系统生成凭证</b></div>
        <div class="notice notice-blue mt12" style="font-size:11.5px">
          「账乱」的根因不是会计水平，而是<b>每家店都能自建科目和明细</b>。一旦允许自建，14 家就会长出 14 套口径，永远无法合并统计。<br><br>
          正确做法：科目只保留到集团需要的粒度，门店的差异用<b>辅助核算维度</b>（部门、费用项目、业态）承载。<b>科目数量被锁死，维度可以无限组合。</b>
        </div>
      </div>
    </div>
  </div>`;
};
