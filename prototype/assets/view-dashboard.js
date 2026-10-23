/* ================= 集团看板 / 单店 / 损益表 / 调节表 ================= */

/* ---------- 集团经营总览 ---------- */
Views['dashboard-group'] = function(){
  const g = GROUP;
  const yoyCls = v => v >= 0 ? 'cr' : 'cy';
  const arrow = v => v >= 0 ? '↑' : '↓';

  const kpi = (label, value, unit, foot, barCls) => `
    <div class="kpi"><div class="kpi-bar ${barCls}"></div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}<small>${unit}</small></div>
      <div class="kpi-foot">${foot}</div>
    </div>`;

  const top = `<div class="grid g-6" style="margin-bottom:14px">
    ${kpi('营业收入（不含税）', wan(g.revenueNet), '万元', `<span class="${yoyCls(g.revYoY)}">${arrow(g.revYoY)} ${pct(Math.abs(g.revYoY))}</span><span class="c3">同比</span>`, 'bar-blue')}
    ${kpi('RevPAR', fmt0(g.revpar), '元', `<span class="c3">出租率 ${pct(g.occ)} × 均价 ${fmt0(g.adr)}</span>`, 'bar-blue')}
    ${kpi('GOP 率', pct(g.gopRate), '', `<span class="c3">GOP ${wan(g.gop)} 万元 · 行业参考 35%</span>`, g.gopRate >= .35 ? 'bar-teal' : 'bar-amber')}
    ${kpi('净利润', wan(g.netProfit), '万元', `<span class="c3">净利率 ${pct(g.netMargin)}</span>`, 'bar-teal')}
    ${kpi('费用预算执行率', pct(g.budgetRate), '', `<span class="${g.budgetRate > .95 ? 'cr' : 'c3'}">已用 ${wan(g.budgetUsed)} / ${wan(g.budgetTotal)} 万</span>`, g.budgetRate > .95 ? 'bar-red' : 'bar-teal')}
    ${kpi('应收账款', wan(g.receivable), '万元', `<span class="ca">超 90 天 ${wan(g.arOver90)} 万</span>`, 'bar-amber')}
  </div>`;

  const rows = STORES.map(s => {
    const alerts = ALERTS.filter(a => a.storeId === s.id);
    const p1 = alerts.filter(a => a.level === 'P1').length;
    const cell = (v, good) => `<td class="num">${v}</td>`;
    return `<tr onclick="App.openStore('${s.id}')" style="cursor:pointer">
      <td><div class="strong">${s.name}</div><div class="fs11 c3">${s.city} · ${s.rooms} 间</div></td>
      <td class="num">${pct(s.occ)}</td>
      <td class="num">${fmt0(s.adr)}</td>
      <td class="num strong">${fmt0(s.revpar)}</td>
      <td class="num ${yoyCls(s.revYoY)}">${arrow(s.revYoY)} ${pct(Math.abs(s.revYoY))}</td>
      <td class="num">${wan(s.revenueNet)}</td>
      <td class="num ${s.gopRate < .28 ? 'cr' : ''}">${pct(s.gopRate)}</td>
      <td class="num ${s.budgetRate > .95 ? 'cr' : ''}">${pct(s.budgetRate)}</td>
      <td>${p1 ? `<span class="tag tag-red">${p1} 项</span>` : alerts.length ? `<span class="tag tag-amber">${alerts.length} 项</span>` : `<span class="tag tag-teal">正常</span>`}</td>
    </tr>`;
  }).join('');

  const matrix = `<div class="card">
    <div class="card-head">
      <div class="card-title">14 家门店经营矩阵<small>点击任意一行查看单店详情 · 2026 年 9 月</small></div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="fs11 c3">同比：<span class="cr">红为增长</span> / <span class="cy">绿为下降</span></div>
        ${exportBtn('dashboard-group')}
      </div>
    </div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr>
          <th>门店 / 主体</th><th class="num">出租率</th><th class="num">均价</th><th class="num">RevPAR</th>
          <th class="num">同比</th><th class="num">收入(万)</th><th class="num">GOP率</th><th class="num">预算执行</th><th>预警</th>
        </tr></thead>
        <tbody>${rows || emptyRow(9, '暂无门店数据')}</tbody>
        <tfoot><tr class="row-total">
          <td>集团合计 / 加权</td>
          <td class="num">${pct(GROUP.occ)}</td><td class="num">${fmt0(GROUP.adr)}</td><td class="num">${fmt0(GROUP.revpar)}</td>
          <td class="num ${yoyCls(GROUP.revYoY)}">${arrow(GROUP.revYoY)} ${pct(Math.abs(GROUP.revYoY))}</td>
          <td class="num">${wan(GROUP.revenueNet)}</td><td class="num">${pct(GROUP.gopRate)}</td>
          <td class="num">${pct(GROUP.budgetRate)}</td><td>${ALERTS.length} 项</td>
        </tr></tfoot>
      </table>
    </div>
  </div>`;

  /* 预警列表与「共 N 项 / P1 N」的计数必须同源，否则会出现「共 9 项」但卡片空白 */
  const alertList = ALERTS.slice().sort((a, b) => a.level.localeCompare(b.level)).slice(0, 9).map(a => {
    const s = storeById(a.storeId);
    /* 门店被合并或删除后，历史预警可能指向不存在的门店；此时不能直接取 name，
       否则整页看板会因为一条孤儿预警白屏 */
    const storeName = s ? s.name : '未知门店';
    return `<div class="alert-item">
      <div class="alert-dot ${a.level === 'P1' ? 'dot-p1' : 'dot-p2'}"></div>
      <div class="alert-main">
        <div class="alert-title">${e(a.text)}</div>
        <div class="alert-meta">${storeName} · ${a.level} · 规则 ${a.rule}</div>
      </div>
    </div>`;
  }).join('');

  const alerts = `<div class="card">
    <div class="card-head"><div class="card-title">需关注事项<small>共 ${ALERTS.length} 项</small></div>
      ${ALERTS.length ? `<span class="tag tag-red">P1 ${ALERTS.filter(a => a.level === 'P1').length}</span>` : ''}</div>
    <div class="card-body tight" style="max-height:332px;overflow-y:auto">${alertList || emptyState({ title:'当前无需要关注的异常', desc:'14 家门店经营指标均在正常区间' })}</div>
  </div>`;

  const trend = `<div class="card">
    <div class="card-head"><div class="card-title">集团营业收入趋势<small>近 12 个月 · 含税 · 万元</small></div></div>
    <div class="card-body">${lineChart(TREND.map(t => ({ m:t.m, v:t.rev })), { height:170 })}</div>
  </div>`;

  const funds = `<div class="card">
    <div class="card-head"><div class="card-title">资金与往来</div></div>
    <div class="card-body">
      <div class="stat-line"><span>账面现金及银行存款</span><b>¥${wan(GROUP.cash)} 万</b></div>
      <div class="stat-line"><span>应收账款</span><b>¥${wan(GROUP.receivable)} 万</b></div>
      <div class="stat-line"><span>其中超 90 天</span><b class="ca">¥${wan(GROUP.arOver90)} 万</b></div>
      <div class="stat-line"><span>应付账款</span><b>¥${wan(GROUP.payable)} 万</b></div>
      <div class="stat-line"><span>本期应交税费</span><b>¥${wan(GROUP.vat + GROUP.surtax + GROUP.incomeTax)} 万</b></div>
      <div class="notice notice-blue mt12" style="font-size:11.5px">
        14 个独立法人各自申报，<b>进项不得跨主体抵扣</b>。系统按主体强制隔离。
      </div>
    </div>
  </div>`;

  const closeCard = `<div class="card">
    <div class="card-head"><div class="card-title">9 月结账状态</div><span class="tag tag-teal">14 / 14 已关账</span></div>
    <div class="card-body">
      <div class="stat-line"><span>已生成凭证</span><b>2,846 张</b></div>
      <div class="stat-line"><span>自动生成占比</span><b class="cy">91.2%</b></div>
      <div class="stat-line"><span>手工凭证</span><b>251 张</b></div>
      <div class="stat-line"><span>异常待处理</span><b class="ca">4 家</b></div>
    </div>
  </div>`;

  /* ---------- 成本费用栏 ---------- */
  const sum = k => STORES.reduce((a, s) => a + s[k], 0);
  const rev = g.revenueNet;
  const costItems = [
    { name:'客房成本',   v: sum('roomCost'),     note:'布草、客用品、洗涤', color:'#185FA5' },
    { name:'餐饮成本',   v: sum('fbCost'),       note:'食材、酒水、餐具',   color:'#378ADD' },
    { name:'OTA 平台佣金', v: sum('otaComm'),    note:'总额法计入销售费用，不冲减收入', color:'#BA7517' },
    { name:'人力成本',   v: sum('labor'),        note:'工资、社保、员工餐', color:'#0F6E56' },
    { name:'能源费',     v: sum('energy'),       note:'水、电、燃气',       color:'#1D9E75' },
    { name:'维修保养',   v: sum('repair'),       note:'电梯、空调、客房维修', color:'#5F5E5A' },
    { name:'物料消耗',   v: sum('supply'),       note:'低值易耗品',         color:'#888780' },
    { name:'市场推广',   v: sum('mkt'),          note:'广告、渠道',         color:'#A32D2D' },
    { name:'办公及其他', v: sum('admin'),        note:'办公、差旅、通讯',   color:'#B4B2A9' },
    { name:'折旧摊销',   v: sum('depreciation'), note:'按直线法计提',       color:'#0C447C' },
    { name:'总部管理费', v: sum('mgmtFee'),      note:'关联交易，双边记账', color:'#085041' },
    { name:'财务费用',   v: sum('finance'),      note:'手续费、利息',       color:'#633806' },
    { name:'税金及附加', v: sum('surtax'),       note:'城建税、教育费附加', color:'#791F1F' }
  ];
  const costTotal = costItems.reduce((a, c) => a + c.v, 0);
  const controllable = sum('labor') + sum('energy') + sum('repair') + sum('supply') + sum('mkt') + sum('admin');

  const costRows = costItems.map(c => {
    const r = c.v / rev;
    return `<tr>
      <td class="cat">${c.name}</td>
      <td class="num">${wan(c.v)}</td>
      <td class="num">${pct(r)}</td>
      <td>
        <div class="ratio-bar"><i style="width:${Math.min(r * 300, 100)}%;background:${c.color}"></i></div>
      </td>
      <td class="fs11 c3">${c.note}</td>
    </tr>`;
  }).join('');

  const costCard = `<div class="card">
    <div class="card-head">
      <div class="card-title">成本费用结构<small>2026 年 9 月 · 14 家合计</small></div>
      <span class="tag ${costTotal / rev > .75 ? 'tag-amber' : 'tag-teal'}">费用率 ${pct(costTotal / rev)}</span>
    </div>
    <div class="card-body" style="padding:12px 16px 6px">
      <div class="grid g-3" style="gap:10px;margin-bottom:12px">
        <div><div class="kpi-label">成本费用合计</div><div style="font-size:17px;font-weight:500">¥${wan(costTotal)} 万</div></div>
        <div><div class="kpi-label">其中可控费用</div><div style="font-size:17px;font-weight:500">¥${wan(controllable)} 万</div></div>
        <div><div class="kpi-label">可控费用率</div><div style="font-size:17px;font-weight:500">${pct(controllable / rev)}</div></div>
      </div>
      <table class="table fin-table">
        <thead><tr><th>项目</th><th class="num">金额(万)</th><th class="num">占收入</th><th style="width:88px">分布</th><th>说明</th></tr></thead>
        <tbody>${costRows}</tbody>
        <tfoot><tr class="row-total">
          <td>成本费用合计</td><td class="num">${wan(costTotal)}</td><td class="num">${pct(costTotal / rev)}</td>
          <td colspan="2" class="fs11 c3">含折旧、管理费、财务费用与税金及附加</td>
        </tr></tfoot>
      </table>
      <div class="notice notice-blue mt12" style="font-size:11.5px">
        <div>口径提示：OTA 佣金按<b>总额法</b>计入销售费用，不冲减营业收入；总部管理费为<b>关联交易</b>，管理公司与门店双边记账，合并报表时抵销。</div>
      </div>
    </div>
  </div>`;

  /* ---------- 利润栏 ---------- */
  const dept = sum('deptProfit');
  const pretax = g.gop - sum('depreciation') - sum('mgmtFee') - sum('finance') - sum('surtax');
  const ladder = [
    { name:'营业收入', v: rev, color:'#185FA5', note:'不含税' },
    { name:'部门毛利', v: dept, color:'#378ADD', note:'扣客房、餐饮成本与 OTA 佣金' },
    { name:'GOP 营业毛利', v: g.gop, color:'#0F6E56', note:'再扣可控费用' },
    { name:'利润总额', v: pretax, color:'#1D9E75', note:'再扣折旧、管理费、财务费用、税金及附加' },
    { name:'净利润', v: g.netProfit, color:'#085041', note:'小型微利实际税负 5%' }
  ];
  const ladderRows = ladder.map(l => `
    <div class="ladder-row">
      <div class="ladder-name">${l.name}</div>
      <div class="ladder-bar"><i style="width:${Math.max(l.v / rev * 100, 1)}%;background:${l.color}"></i></div>
      <div class="ladder-val">${wan(l.v)} 万</div>
      <div class="ladder-pct">${pct(l.v / rev)}</div>
    </div>`).join('');

  const profitCard = `<div class="card">
    <div class="card-head">
      <div class="card-title">利润形成过程<small>USALI 六层结构 · 万元</small></div>
      <span class="tag tag-teal">净利率 ${pct(g.netMargin)}</span>
    </div>
    <div class="card-body" style="padding:14px 16px">
      ${ladderRows}
      <div class="grid g-3" style="gap:10px;margin-top:14px">
        <div><div class="kpi-label">毛利率（部门）</div><div style="font-size:16px;font-weight:500">${pct(dept / rev)}</div></div>
        <div><div class="kpi-label">GOP 率</div><div style="font-size:16px;font-weight:500;color:${g.gopRate >= .35 ? 'var(--teal-600)' : 'var(--amber-600)'}">${pct(g.gopRate)}</div></div>
        <div><div class="kpi-label">净利率</div><div style="font-size:16px;font-weight:500">${pct(g.netMargin)}</div></div>
      </div>
      <div class="notice notice-teal mt12" style="font-size:11.5px">
        <div><b>税负：</b>14 家按单一法人分别判定小型微利，年应纳税所得额 300 万以内实际税负 5%，本期所得税 ¥${wan(g.incomeTax)} 万。<b>不得合并判定</b>——集团合并计算会直接失去优惠资格。</div>
      </div>
    </div>
  </div>`;

  return `<div class="grid" style="gap:14px">
    ${top}
    <div class="grid g-2-1">${matrix}${alerts}</div>
    <div class="grid g-2">${costCard}${profitCard}</div>
    <div class="grid g-2-1">${trend}
      <div class="grid" style="gap:14px">${funds}${closeCard}</div>
    </div>
  </div>`;
};

/* ---------- 单店经营详情 ---------- */
Views['dashboard-store'] = function(){
  const s = storeById(State.storeId);
  const yoyCls = v => v >= 0 ? 'cr' : 'cy';
  const arrow = v => v >= 0 ? '↑' : '↓';

  const kpi = (label, value, unit, foot, barCls) => `
    <div class="kpi"><div class="kpi-bar ${barCls}"></div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}<small>${unit}</small></div>
      <div class="kpi-foot">${foot}</div></div>`;

  const kpis = `<div class="grid g-6" style="margin-bottom:14px">
    ${kpi('出租率 OCC', pct(s.occ), '', `<span class="${yoyCls(s.occ - s.occLy)}">${arrow(s.occ-s.occLy)} ${((s.occ - s.occLy)*100).toFixed(1)}pt</span><span class="c3">同比</span>`, 'bar-blue')}
    ${kpi('平均房价 ADR', fmt0(s.adr), '元', `<span class="${yoyCls(s.adr - s.adrLy)}">${arrow(s.adr-s.adrLy)} ${pct((s.adr-s.adrLy)/s.adrLy)}</span><span class="c3">同比</span>`, 'bar-blue')}
    ${kpi('RevPAR', fmt0(s.revpar), '元', `<span class="c3">去年 ${fmt0(s.revparLy)} 元</span>`, 'bar-blue')}
    ${kpi('营业收入', wan(s.revenueNet), '万元', `<span class="${yoyCls(s.revYoY)}">${arrow(s.revYoY)} ${pct(Math.abs(s.revYoY))}</span><span class="c3">同比</span>`, 'bar-teal')}
    ${kpi('GOP 率', pct(s.gopRate), '', `<span class="c3">GOP ${wan(s.gop)} 万元</span>`, s.gopRate >= .35 ? 'bar-teal' : 'bar-amber')}
    ${kpi('净利润', wan(s.netProfit), '万元', `<span class="c3">净利率 ${pct(s.netMargin)}</span>`, 'bar-teal')}
  </div>`;

  const revStruct = `<div class="card">
    <div class="card-head"><div class="card-title">收入结构<small>含税</small></div></div>
    <div class="card-body">
      <div class="split-bar">
        <div style="width:${100 - s.fbRatio*100 - 6}%;background:#185FA5">客房 ${pct(1 - s.fbRatio - .06, 0)}</div>
        <div style="width:${s.fbRatio*100}%;background:#1D9E75">餐饮 ${pct(s.fbRatio, 0)}</div>
        <div style="width:6%;background:#BA7517"></div>
      </div>
      <div class="legend">
        <span><i style="background:#185FA5"></i>客房 ¥${wan(s.roomRev)} 万</span>
        <span><i style="background:#1D9E75"></i>餐饮 ¥${wan(s.fbRev)} 万</span>
        <span><i style="background:#BA7517"></i>其他 ¥${wan(s.otherRev)} 万</span>
      </div>
      <div class="stat-line mt12"><span>OTA 渠道占比</span><b>${pct(s.otaRatio)}</b></div>
      <div class="stat-line"><span>OTA 佣金支出</span><b>¥${fmt0(s.otaComm)}</b></div>
      <div class="stat-line"><span>佣金率</span><b class="ca">${pct(s.otaComm / (s.roomRev * s.otaRatio))}</b></div>
    </div>
  </div>`;

  const opexStruct = `<div class="card">
    <div class="card-head"><div class="card-title">成本费用结构<small>占收入比</small></div></div>
    <div class="card-body">
      ${hbars([
        { name:'人力成本', value:s.labor, display:pct(s.labor/s.totalRev) },
        { name:'客房成本', value:s.roomCost, display:pct(s.roomCost/s.totalRev) },
        { name:'餐饮成本', value:s.fbCost, display:pct(s.fbCost/s.totalRev) },
        { name:'能源费', value:s.energy, display:pct(s.energy/s.totalRev), cls: s.energy/s.totalRev > .095 ? 'red' : '' },
        { name:'折旧摊销', value:s.depreciation, display:pct(s.depreciation/s.totalRev) },
        { name:'维修保养', value:s.repair, display:pct(s.repair/s.totalRev) },
        { name:'市场推广', value:s.mkt, display:pct(s.mkt/s.totalRev) },
        { name:'物料消耗', value:s.supply, display:pct(s.supply/s.totalRev) }
      ])}
    </div>
  </div>`;

  /* 9 月日历热力 */
  const rnd = seeded(parseInt(s.id.slice(1)) * 31);
  let cal = '';
  ['一','二','三','四','五','六','日'].forEach(d => cal += `<div class="cal-head">${d}</div>`);
  const firstDow = 1;
  for (let i = 0; i < firstDow; i++) cal += '<div></div>';
  for (let d = 1; d <= 30; d++){
    const v = Math.max(.35, Math.min(.98, s.occ + (rnd() - .5) * .22));
    const alpha = 0.12 + v * 0.78;
    cal += `<div class="cal-cell" style="background:rgba(24,95,165,${alpha.toFixed(2)});color:${alpha > .55 ? '#fff' : '#5B6270'}" title="9月${d}日 出租率 ${pct(v,0)}">${d}</div>`;
  }

  const calendar = `<div class="card">
    <div class="card-head"><div class="card-title">9 月每日出租率<small>颜色越深出租率越高</small></div></div>
    <div class="card-body"><div class="cal">${cal}</div></div>
  </div>`;

  const pl = `<div class="card">
    <div class="card-head"><div class="card-title">单店损益快报<small>管理口径</small></div>${exportBtn('dashboard-store')}</div>
      <button class="btn btn-sm" onclick="App.go('report-pl')">查看完整损益表</button></div>
    <div class="card-body tight">
      <table class="table">
        <tbody>
          <tr><td>营业收入（不含税）</td><td class="num">${fmt(s.revenueNet)}</td><td class="num muted">100.0%</td></tr>
          <tr><td>部门成本合计</td><td class="num">${fmt(s.roomCost + s.fbCost)}</td><td class="num muted">${pct((s.roomCost+s.fbCost)/s.revenueNet)}</td></tr>
          <tr class="row-sub"><td>部门毛利</td><td class="num strong">${fmt(s.deptProfit)}</td><td class="num muted">${pct(s.deptProfit/s.revenueNet)}</td></tr>
          <tr><td>未分配费用合计</td><td class="num">${fmt(s.opexTotal)}</td><td class="num muted">${pct(s.opexTotal/s.revenueNet)}</td></tr>
          <tr class="row-sub"><td>营业毛利 GOP</td><td class="num strong">${fmt(s.gop)}</td><td class="num strong">${pct(s.gopRate)}</td></tr>
          <tr><td>折旧摊销 / 管理费 / 财务费用</td><td class="num">${fmt(s.depreciation + s.mgmtFee + s.finance)}</td><td class="num muted">${pct((s.depreciation+s.mgmtFee+s.finance)/s.revenueNet)}</td></tr>
          <tr><td>税金及附加</td><td class="num">${fmt(s.surtax)}</td><td class="num muted">${pct(s.surtax/s.revenueNet)}</td></tr>
          <tr><td>所得税</td><td class="num">${fmt(s.incomeTax)}</td><td class="num muted">${pct(s.incomeTax/s.revenueNet)}</td></tr>
          <tr class="row-total"><td>净利润</td><td class="num">${fmt(s.netProfit)}</td><td class="num">${pct(s.netMargin)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;

  return `<div class="grid" style="gap:14px">
    ${kpis}
    <div class="grid g-3">${revStruct}${opexStruct}${calendar}</div>
    ${pl}
  </div>`;
};

/* ---------- 单店损益表（USALI 结构） ---------- */
Views['report-pl'] = function(){
  const s = storeById(State.storeId);
  const net = s.revenueNet;
  const line = (label, val, opts = {}) => {
    const cls = opts.total ? 'row-total' : opts.sub ? 'row-sub' : '';
    const ratio = (val / net * 100).toFixed(1) + '%';
    return `<tr class="${cls}">
      <td style="padding-left:${opts.indent ? 22 : 10}px">${label}</td>
      <td class="num ${opts.strong ? 'strong' : ''}">${fmt(val)}</td>
      <td class="num muted">${ratio}</td>
      <td class="num muted">${fmt(val / PERIOD.days)}</td>
      <td class="num muted">${fmt(val / s.availableRooms * PERIOD.days)}</td>
    </tr>`;
  };

  const rows = [
    line('营业收入（不含税）', net, { total:true, strong:true }),
    line('客房收入', s.roomRev / 1.06, { indent:true }),
    line('餐饮收入', s.fbRev / 1.06, { indent:true }),
    line('其他收入', s.otherRev / 1.06, { indent:true }),
    line('减：OTA 佣金', -s.otaComm, { indent:true }),
    line('营业收入净额', net, { sub:true, strong:true }),
    line('部门成本', -(s.roomCost + s.fbCost), { total:true }),
    line('客房成本', -s.roomCost, { indent:true }),
    line('餐饮成本', -s.fbCost, { indent:true }),
    line('部门毛利（Departmental Profit）', s.deptProfit, { sub:true, strong:true }),
    line('未分配营业费用', -s.opexTotal, { total:true }),
    line('人力成本', -s.labor, { indent:true }),
    line('能源费', -s.energy, { indent:true }),
    line('维修保养费', -s.repair, { indent:true }),
    line('物料消耗', -s.supply, { indent:true }),
    line('市场推广费', -s.mkt, { indent:true }),
    line('办公及其他费用', -s.admin, { indent:true }),
    line('营业毛利（GOP）', s.gop, { sub:true, strong:true }),
    line('折旧与摊销', -s.depreciation, { total:true }),
    line('总部管理费', -s.mgmtFee, { indent:true }),
    line('财务费用', -s.finance, { indent:true }),
    line('税金及附加', -s.surtax, { indent:true }),
    line('利润总额', s.netProfit + s.incomeTax, { sub:true, strong:true }),
    line('所得税费用', -s.incomeTax, { indent:true }),
    line('净利润', s.netProfit, { total:true, strong:true })
  ].join('');

  return `<div class="card">
    <div class="card-head">
      <div class="card-title">${storeById(State.storeId).entityName} · 损益表
        <small>2026 年 9 月 · 管理口径 · 单位：元</small></div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="tag tag-blue">独立法人 · ${s.vatLabel}</span>
        ${exportBtn('report-pl')}
      </div>
    </div>
    <div class="card-body tight">
      <table class="table">
        <thead><tr>
          <th>项目</th><th class="num">本月金额</th><th class="num">占收入比</th>
          <th class="num">日均</th><th class="num">单房日</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="notice notice-blue mt16">
    <div><b>口径说明：</b>本表为管理口径（USALI 结构），与对外报送的利润表存在差异：① 收入按不含税列示，OTA 佣金单列不冲减收入；② 总部管理费按收入 2.5% 计提，各店确认费用的同时总部确认「管理费收入」，属关联交易，需按独立交易原则定价并开具发票。对外报表需按会计准则口径重分类。</div>
  </div>`;
};

/* ---------- 营业收入调节表 ---------- */
Views['report-bridge'] = function(){
  const s = storeById(State.storeId);
  const pmsRev = s.totalRev;                      // PMS 含税营业额
  const discount = Math.round(pmsRev * .021);     // 折扣减免
  const freeRoom = Math.round(pmsRev * .008);     // 免费房/内部房
  const reversal = Math.round(pmsRev * .004);     // 冲账红冲
  const commission = s.otaComm;                   // OTA 佣金（净额结算差额）
  const deemed = Math.round(pmsRev * .0015);      // 视同销售（员工房、自用）
  const vatSales = pmsRev - discount - freeRoom - reversal - deemed;
  const vat = Math.round(vatSales / 1.06 * .06);
  const acctRev = vatSales - vat;

  const row = (label, val, sign, note) => `<tr>
    <td>${label}</td>
    <td class="num ${sign === '-' ? 'cr' : ''}">${sign === '-' ? '(' + fmt(val) + ')' : sign === '=' ? fmt(val) : fmt(val)}</td>
    <td class="fs11 c3">${note}</td>
  </tr>`;

  return `<div class="grid g-1-2">
    <div class="card">
      <div class="card-head"><div class="card-title">两套口径为什么要分开</div></div>
      <div class="card-body" style="font-size:12.5px;line-height:1.75;color:var(--text-2)">
        <p style="margin-bottom:10px"><b style="color:var(--text)">PMS 经营口径</b>：含税、收付实现、T+1 出数。店长每天早上 8:30 看的就是它，用来抓当日经营。</p>
        <p style="margin-bottom:10px"><b style="color:var(--text)">总账会计口径</b>：不含税、权责发生、关账后出数。用来报税、出财报、算利润。</p>
        <p style="margin-bottom:10px">两者天然不等。硬把它们合成一套，结果就是：管理层拿日报告的数据去考核，财务拿月报解释差异，永远对不上。</p>
        <div class="notice notice-teal" style="font-size:11.5px">正确做法：日报用经营口径，月报用会计口径，中间用这张表解释差异。</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">${s.name} · 营业收入调节表<small>2026 年 9 月 · 单位：元</small></div>${exportBtn('report-bridge')}</div>
      <div class="card-body tight">
        <table class="table">
          <thead><tr><th>项目</th><th class="num">金额</th><th>口径说明</th></tr></thead>
          <tbody>
            <tr class="row-sub"><td class="strong">PMS 营业收入（含税）</td><td class="num strong">${fmt(pmsRev)}</td><td class="fs11 c3">PMS 日结汇总</td></tr>
            ${row('减：折扣与减免', discount, '-', '前台折扣、协议折扣、优惠券')}
            ${row('减：免费房 / 内部房 / 自用房', freeRoom, '-', '不计收入，仅计成本')}
            ${row('减：冲账与红冲', reversal, '-', '前台改单、撤销结账')}
            ${row('减：视同销售（员工房、自用）', deemed, '-', '税务上可能仍需计税')}
            <tr class="row-total"><td>增值税申报销售额</td><td class="num strong">${fmt(vatSales)}</td><td class="fs11 c3">与申报表主表第 1 栏核对</td></tr>
            ${row('减：销项税额（6%）', vat, '-', '住宿及餐饮服务适用 6%')}
            <tr class="row-total"><td>总账营业收入（不含税）</td><td class="num strong">${fmt(acctRev)}</td><td class="fs11 c3">与损益表「营业收入」核对</td></tr>
            <tr><td>OTA 佣金（净额结算差额）</td><td class="num ${s.otaComm > 0 ? 'ca' : ''}">${fmt(commission)}</td><td class="fs11 c3">总额法：佣金计入销售费用，不冲减收入</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="notice notice-amber mt16">
    <div><b>这张表的三个用途：</b>① 月结时用它核对「PMS 收入 = 申报销售额 = 账面收入」是否三方一致；② 差异超过 1% 时自动触发复核任务；③ OTA 净额结算导致银行到账少于收入，差额直接冲佣金费用，不再每月手工调账。</div>
  </div>`;
};
