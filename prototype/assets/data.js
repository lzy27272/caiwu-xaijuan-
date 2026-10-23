/* ================= 模拟数据 =================
   全部为演示用模拟数据，不连接任何真实系统。
   金额单位：元（除特别标注）
*/

const PERIOD = { year: 2026, month: 9, days: 30, label: '2026年9月' };

/* ---- 14 家门店基础属性（来源：门店信息.xlsx「开票与账户信息」） ----
   真实字段：门店名 / 公司名称（开票主体）/ 纳税身份 / 成立日期 / 纳税人识别号。
   经营字段（房量、出租率、均价、收入结构）为演示模拟值——表格未提供，按同城同档位合理设定，
   接入 PMS 后由日结数据替换。vat 由「纳税身份」直接映射，不另行假设。 */

const STORES_BASE = [
  { id:'S01', name:'秀漫店',              city:'贵阳', entity:'贵阳风生水起酒店管理有限公司', vat:'small',   found:'2023-04-03', taxNo:'91520102MACE5JPXX4', rooms:118, occ:.71, adr:238, fb:.21, ota:.29, occLy:.68, adrLy:232 },
  { id:'S02', name:'漫宿店',              city:'贵阳', entity:'贵阳秀漫酒店管理有限公司',     vat:'small',   found:'2026-03-09', taxNo:'91520102MAK8X0NQXW', rooms: 96, occ:.64, adr:226, fb:.19, ota:.33, occLy:.60, adrLy:220 },
  { id:'S03', name:'归来店',              city:'贵阳', entity:'贵阳归来酒店有限责任公司',     vat:'general', found:'2024-11-22', taxNo:'91520102MAE5Y81F3N', rooms:132, occ:.75, adr:268, fb:.24, ota:.25, occLy:.71, adrLy:258 },
  { id:'S04', name:'秀舍店',              city:'贵阳', entity:'贵州态好酒店管理有限公司',     vat:'small',   found:'2024-10-23', taxNo:'91520102MAE30KD885', rooms: 88, occ:.66, adr:214, fb:.18, ota:.31, occLy:.63, adrLy:208 },
  { id:'S05', name:'语舍店',              city:'贵阳', entity:'贵州语舍逸酒店管理有限公司',   vat:'small',   found:'2015-01-23', taxNo:'915201023220987170', rooms:106, occ:.78, adr:246, fb:.22, ota:.24, occLy:.76, adrLy:238 },
  { id:'S06', name:'天泰店',              city:'贵阳', entity:'贵阳态六酒店有限公司',         vat:'small',   found:'2025-12-19', taxNo:'91520102MAK40H3M2A', rooms: 92, occ:.62, adr:222, fb:.20, ota:.32, occLy:.58, adrLy:216 },
  { id:'S07', name:'黔里店',              city:'贵阳', entity:'贵州慧博酒店有限公司',         vat:'small',   found:'2016-07-26', taxNo:'91520190MA6DNE7Q0P', rooms:124, occ:.73, adr:254, fb:.25, ota:.26, occLy:.70, adrLy:246 },
  { id:'S08', name:'智博店',              city:'贵阳', entity:'贵阳市智博酒店管理有限公司',   vat:'small',   found:'2024-01-04', taxNo:'91520115MAD9HN1943', rooms:110, occ:.69, adr:236, fb:.21, ota:.28, occLy:.66, adrLy:230 },
  { id:'S09', name:'新店解放路（1-5层）', city:'贵阳', entity:'贵阳乾汇富酒店管理有限公司',   vat:'small',   found:'2025-07-14', taxNo:'91520103MAEQ803Q1G', rooms: 84, occ:.58, adr:206, fb:.17, ota:.35, occLy:.54, adrLy:200 },
  { id:'S10', name:'态六酒店（7-9）',     city:'贵阳', entity:'贵阳时尚酒店管理有限公司',     vat:'small',   found:'2025-06-04', taxNo:'91520103MAELKUW656', rooms: 96, occ:.61, adr:212, fb:.18, ota:.33, occLy:.57, adrLy:206 },
  { id:'S11', name:'VAYA HEY HOTEL（5-6）',city:'贵阳', entity:'贵阳维璟酒店管理有限公司',    vat:'small',   found:'2025-06-04', taxNo:'91520103MAEMC9RQ78', rooms: 78, occ:.66, adr:288, fb:.27, ota:.22, occLy:.62, adrLy:276 },
  { id:'S12', name:'喷水池22楼/21楼',     city:'贵阳', entity:'贵阳品序酒店有限公司',         vat:'small',   found:'2025-09-30', taxNo:'91520103MAG0AERY9F', rooms: 72, occ:.74, adr:302, fb:.26, ota:.20, occLy:.70, adrLy:290 },
  { id:'S13', name:'毕节店',              city:'毕节', entity:'毕节慧博酒店管理有限公司',     vat:'small',   found:'2023-05-19', taxNo:'91520502MACH4QNW53', rooms:138, occ:.67, adr:198, fb:.23, ota:.30, occLy:.64, adrLy:192 },
  { id:'S14', name:'金阳金融城',          city:'贵阳', entity:'贵阳马上黔来酒店管理有限公司', vat:'small',   found:'2026-07-16', taxNo:'91520115MAKHWNAJ5H', rooms:102, occ:.56, adr:264, fb:.24, ota:.27, occLy:.50, adrLy:256 }
];

/* 确定性伪随机，保证每次刷新数据一致 */
function seeded(n){ let a = n; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildStore(b, idx){
  const r = seeded(idx * 7919 + 13);
  const other = .06;
  const roomRev = Math.round(b.rooms * b.occ * PERIOD.days * b.adr);        // 含税客房收入
  const totalRev = Math.round(roomRev / (1 - b.fb - other));                 // 含税总收入
  const fbRev = Math.round(totalRev * b.fb);
  const otherRev = totalRev - roomRev - fbRev;

  const otaComm = Math.round(roomRev * b.ota * (.12 + r() * .03));           // OTA佣金
  const revenueNet = Math.round(totalRev / 1.06);                            // 不含税收入

  const roomCost = Math.round(roomRev * (.19 + r() * .045));                 // 客房成本
  const fbCost   = Math.round(fbRev * (.43 + r() * .05));                    // 餐饮成本
  const labor    = Math.round(totalRev * (.21 + r() * .05));                 // 人力成本
  const energy   = Math.round(totalRev * (.062 + r() * .028));               // 能源费
  const repair   = Math.round(totalRev * (.016 + r() * .008));               // 维修保养
  const supply   = Math.round(totalRev * (.011 + r() * .005));               // 物料消耗
  const mkt      = Math.round(totalRev * (.012 + r() * .006));               // 市场推广
  const admin    = Math.round(totalRev * (.018 + r() * .006));               // 办公及其他
  const opexTotal = labor + energy + repair + supply + mkt + admin;

  const deptProfit = revenueNet - roomCost - fbCost - otaComm;               // 部门毛利
  const gop = deptProfit - opexTotal;                                        // 营业毛利 GOP
  const depreciation = Math.round(b.rooms * (620 + r() * 180));              // 折旧摊销
  const mgmtFee = Math.round(totalRev * .025);                               // 总部管理费（关联交易）
  const finance = Math.round(totalRev * (.006 + r() * .004));                // 财务费用
  const vat = b.vat === 'general'
      ? Math.max(0, Math.round(revenueNet * .06 - revenueNet * .025))
      : Math.round(revenueNet * .03);
  const surtax = Math.round(vat * .12);                                      // 附加税费合计约12%
  const pretax = gop - depreciation - mgmtFee - finance - surtax;
  const incomeTax = pretax > 0 ? Math.round(pretax * .05) : 0;               // 小微口径示例
  const netProfit = pretax - incomeTax;

  const budgetTotal = Math.round(totalRev * (.60 + r() * .10));
  const budgetUsed  = opexTotal + Math.round(depreciation * .15);
  const budgetInTrans = Math.round(budgetTotal * (.01 + r() * .04));

  const occLy = b.occLy, adrLy = b.adrLy;
  const revpar = Math.round(b.occ * b.adr);
  const revparLy = Math.round(occLy * adrLy);
  const revenueTotalLy = Math.round(roomRev / (1 - b.fb - other) * (occLy * adrLy) / (b.occ * b.adr));

  return {
    id:b.id, name:b.name, city:b.city, rooms:b.rooms,
    entityName:b.entity, taxNo:b.taxNo, foundDate:b.found,
    vatType:b.vat, vatLabel: b.vat === 'general' ? '一般纳税人' : '小规模纳税人',
    occ:b.occ, adr:b.adr, occLy, adrLy, revpar, revparLy,
    roomNights: Math.round(b.rooms * b.occ * PERIOD.days),
    availableRooms: b.rooms * PERIOD.days,
    roomRev, fbRev, otherRev, totalRev, revenueNet, otaComm,
    fbRatio:b.fb, otaRatio:b.ota,
    roomCost, fbCost, labor, energy, repair, supply, mkt, admin, opexTotal,
    deptProfit, gop, gopRate: gop / revenueNet,
    depreciation, mgmtFee, finance, vat, surtax, incomeTax, netProfit,
    netMargin: netProfit / revenueNet,
    budgetTotal, budgetUsed, budgetInTrans,
    budgetRate: budgetUsed / budgetTotal,
    revenueTotalLy,
    revYoY: (totalRev - revenueTotalLy) / revenueTotalLy,
    energyRate: energy / totalRev,
    receivable: Math.round(totalRev * (.10 + r() * .12)),
    payable: Math.round(totalRev * (.12 + r() * .14)),
    cash: Math.round(totalRev * (.28 + r() * .22)),
    arOver90: Math.round(totalRev * (r() * .035))
  };
}

const STORES = STORES_BASE.map(buildStore);

/* ---- 集团汇总 ---- */
const GROUP = (() => {
  const sum = k => STORES.reduce((s, x) => s + x[k], 0);
  const revenueNet = sum('revenueNet'), gop = sum('gop'), netProfit = sum('netProfit');
  const totalRev = sum('totalRev'), revenueTotalLy = sum('revenueTotalLy');
  const budgetTotal = sum('budgetTotal'), budgetUsed = sum('budgetUsed');
  const rooms = sum('rooms'), roomNights = sum('roomNights'), availableRooms = sum('availableRooms');
  return {
    storeCount: STORES.length, rooms,
    revenueNet, totalRev, gop, netProfit,
    gopRate: gop / revenueNet, netMargin: netProfit / revenueNet,
    roomNights, availableRooms,
    occ: roomNights / availableRooms,
    adr: Math.round(sum('roomRev') / roomNights),
    revpar: Math.round(sum('roomRev') / availableRooms),
    revenueTotalLy,
    revYoY: (totalRev - revenueTotalLy) / revenueTotalLy,
    budgetTotal, budgetUsed, budgetRate: budgetUsed / budgetTotal,
    receivable: sum('receivable'), payable: sum('payable'), cash: sum('cash'),
    arOver90: sum('arOver90'),
    vat: sum('vat'), surtax: sum('surtax'), incomeTax: sum('incomeTax'), mgmtFee: sum('mgmtFee')
  };
})();

/* ---- 集团近 12 个月收入（含税，万元） ---- */
const TREND = [
  { m:'2025-10', rev:1180, gop:.31 },
  { m:'2025-11', rev:1092, gop:.29 },
  { m:'2025-12', rev: 984, gop:.27 },
  { m:'2026-01', rev: 892, gop:.24 },
  { m:'2026-02', rev:1024, gop:.28 },
  { m:'2026-03', rev:1128, gop:.30 },
  { m:'2026-04', rev:1216, gop:.32 },
  { m:'2026-05', rev:1352, gop:.34 },
  { m:'2026-06', rev:1408, gop:.35 },
  { m:'2026-07', rev:1486, gop:.36 },
  { m:'2026-08', rev:1542, gop:.37 },
  { m:'2026-09', rev: Math.round(GROUP.totalRev / 10000), gop: GROUP.gopRate }
];

/* ---- 角色与权限 ---- */
const ROLES = {
  staff:    { name:'门店员工',   desc:'只能提交自己的报销单、查看进度', home:'workbench' },
  manager:  { name:'门店店长',   desc:'本店全部单据审批、本店经营数据', home:'workbench' },
  storefin: { name:'门店财务',   desc:'本店单据初审、发票录入、日报核对', home:'workbench' },
  hqfin:    { name:'总部财务经理',desc:'14 家账务、税务、报表，全部单据终审', home:'workbench' },
  cashier:  { name:'总部出纳',   desc:'付款执行、银行对账，不能修改审批结果', home:'workbench' },
  cfo:      { name:'财务总监',   desc:'全部数据与审批、预算调整', home:'workbench' }
};

/* ---- 导航结构（按角色过滤） ---- */
const NAV = [
  { group:'工作台', items:[
    { id:'workbench', label:'我的工作台', roles:['staff','manager','storefin','hqfin','cashier','cfo'] }
  ]},
  { group:'经营看板', items:[
    { id:'dashboard-group', label:'集团经营总览', roles:['hqfin','cfo','cashier'] },
    { id:'dashboard-store', label:'单店经营详情', roles:['manager','storefin','hqfin','cfo','cashier'] },
    { id:'report-pl',       label:'单店损益表',   roles:['manager','storefin','hqfin','cfo'] },
    { id:'report-bridge',   label:'营业收入调节表', roles:['hqfin','cfo','storefin'] }
  ]},
  { group:'审批与单据', items:[
    { id:'flow-todo', label:'我的待办', roles:['manager','storefin','hqfin','cfo'] },
    { id:'flow-my',   label:'我的单据', roles:['staff','manager','storefin','hqfin','cfo','cashier'] },
    { id:'flow-exp',  label:'费用报销', roles:['staff','manager','storefin','hqfin','cashier','cfo'] },
    { id:'flow-pay',  label:'付款申请', roles:['staff','manager','storefin','hqfin','cashier','cfo'] }
  ]},
  { group:'票据与账务', items:[
    { id:'inv-pool',  label:'发票池', roles:['storefin','hqfin','cfo','staff'] },
    { id:'inv-add',   label:'发票采集', roles:['storefin','hqfin','cfo','staff'] },
    { id:'inv-input', label:'进项抵扣台账', roles:['hqfin','cfo'] },
    { id:'acc-voucher', label:'凭证中心', roles:['storefin','hqfin','cfo'] },
    { id:'acc-close',  label:'月末结账', roles:['hqfin','cfo'] }
  ]},
  { group:'预算与主数据', items:[
    { id:'budget',  label:'预算执行', roles:['manager','storefin','hqfin','cfo'] },
    { id:'master',  label:'主数据', roles:['hqfin','cfo'] }
  ]}
];

/* ---- 票据类型与抵扣判定规则 ----
   核心原则：税额取发票实际开具值，绝不按统一税率倒算。
   酒店业常见的餐饮票(6%)、服务票(6%)、房租(9%)、农产品收购(9%)各不相同，倒算必错。 */
const INVOICE_TYPES = [
  { code:'v-spec',  name:'增值税专用发票', rate:.13, memo:'默认 13%，可按实际修改' },
  { code:'v-spec6', name:'增值税专用发票', rate:.06, memo:'服务类 6%' },
  { code:'v-spec9', name:'增值税专用发票', rate:.09, memo:'不动产租赁/交通运输 9%' },
  { code:'v-common',name:'增值税普通发票', rate:.13, memo:'普票不可抵扣' },
  { code:'v-elec',  name:'电子发票（普通）', rate:.06, memo:'需验真，可重复打印但有唯一号' },
  { code:'v-train', name:'铁路电子客票',   rate:.09, memo:'注明旅客信息的客票可计算抵扣' },
  { code:'v-air',   name:'航空运输电子客票行程单', rate:.09, memo:'按票价+燃油附加费计算抵扣' }
];

/* 费用类目 → 抵扣判定（类目决定可否抵扣，不靠会计个人记忆） */
const DEDUCT_RULE = {
  '客房物料':{ deduct:'yes' }, '办公费':{ deduct:'yes' }, '办公设备':{ deduct:'yes' },
  '维修保养':{ deduct:'yes' }, '洗涤服务':{ deduct:'yes' }, '餐饮原材料':{ deduct:'yes' },
  '广告推广':{ deduct:'yes' }, '房屋租赁':{ deduct:'yes' }, '物料消耗':{ deduct:'yes' },
  '水电燃气':{ deduct:'yes' }, '通讯费':{ deduct:'yes' },
  '业务招待':{ deduct:'no', reason:'外购餐饮服务/招待支出，进项税额不得抵扣' },
  '员工福利':{ deduct:'no', reason:'用于集体福利或个人消费，进项税额不得抵扣' },
  '差旅费':{ deduct:'no', reason:'除旅客运输客票外，其他票据按票面判定' }
};

/* 待采集票据（模拟"拍照/扫描待 OCR"的新票，用于走通录入链路） */
const INBOX_SEED = [
  { id:'N1', fileName:'IMG_20261020_0912.jpg', kind:'img', size:'2.4 MB',
    mock:{ type:'电子发票（普通）', code:'052002600111', no:'33481907', date:'2026-10-20',
           seller:'贵阳清源商贸有限公司', amount:2860.00, tax:161.89, rate:.06,
           category:'客房物料', storeId:'S01' } },
  { id:'N2', fileName:'高速通行费电子发票.pdf', kind:'pdf', size:'186 KB',
    mock:{ type:'增值税专用发票', code:'052001900288', no:'70112345', date:'2026-10-18',
           seller:'贵州高速公路集团有限公司', amount:320.00, tax:18.11, rate:.06,
           category:'差旅费', storeId:'S07' } },
  { id:'N3', fileName:'餐饮消费小票.jpg', kind:'img', size:'1.1 MB',
    mock:{ type:'增值税普通发票', code:'052002600334', no:'90811223', date:'2026-10-19',
           seller:'贵阳悦膳餐饮管理有限公司', amount:1860.00, tax:105.28, rate:.06,
           category:'业务招待', storeId:'S12' } }
];

/* ---- 待办单据（含各类异常场景） ---- */
const DOCS = [
  {
    id:'BX2026100012', type:'expense', typeLabel:'费用报销',
    storeId:'S01', applicant:'陈晓燕', dept:'客房部', title:'9月客房布草补充采购',
    amount: 8640.00, taxAmount: 984.91, submitDate:'2026-10-16 09:24',
    budgetItem:'客房物料消耗', status:'pending', currentNode:1,
    invoices:[{ code:'032002100311', no:'88451206', amount:8640.00, seller:'贵州洁雅纺织品有限公司' }],
    lines:[
      { item:'床单（1.8m）', qty:24, price:186, amount:4464, taxRate:.13 },
      { item:'被套（1.8m）', qty:24, price:174, amount:4176, taxRate:.13 }
    ],
    note:'原布草使用满 18 个月，按标准更换',
    attach:[
      { name:'布草验收单-GRN20261012.pdf', size:'286 KB', kind:'pdf', by:'陈晓燕', time:'2026-10-16 09:20' },
      { name:'旧布草现场照片-01.jpg', size:'1.2 MB', kind:'img', by:'陈晓燕', time:'2026-10-16 09:21' },
      { name:'旧布草现场照片-02.jpg', size:'1.1 MB', kind:'img', by:'陈晓燕', time:'2026-10-16 09:21' }
    ],
    risk:[]
  },
  {
    id:'BX2026100018', type:'expense', typeLabel:'费用报销',
    storeId:'S07', applicant:'王建国', dept:'工程部', title:'中央空调主机维修',
    amount: 28600.00, taxAmount: 3269.03, submitDate:'2026-10-17 14:05',
    budgetItem:'维修保养费', status:'pending', currentNode:1,
    invoices:[{ code:'032002100412', no:'77319044', amount:28600.00, seller:'贵州恒信机电工程有限公司' }],
    lines:[{ item:'压缩机更换及冷媒加注', qty:1, price:28600, amount:28600, taxRate:.13 }],
    note:'8 月能耗异常升高，检修确认为压缩机故障',
    risk:[{ level:'warn', code:'B4', text:'该供应商近 12 个月未发生交易，属于新供应商大额支出，建议核对合同与验收单' }]
  },
  {
    id:'FK2026100007', type:'payment', typeLabel:'付款申请',
    storeId:'S05', applicant:'李海涛', dept:'财务部', title:'10月房租支付',
    amount: 186000.00, taxAmount: 15357.80, submitDate:'2026-10-15 10:12',
    budgetItem:'租赁费', status:'pending', currentNode:2,
    payee:'贵阳老城置业有限公司', payeeAccount:'2402 0186 0000 1234 567',
    invoices:[{ code:'032002100108', no:'66120438', amount:186000.00, seller:'贵阳老城置业有限公司' }],
    lines:[{ item:'2026年10月房屋租金', qty:1, price:186000, amount:186000, taxRate:.09 }],
    note:'合同号 ZL-2023-018，租期 2023.7-2028.6',
    risk:[]
  },
  {
    id:'FK2026100011', type:'payment', typeLabel:'付款申请',
    storeId:'S09', applicant:'周敏', dept:'采购部', title:'布草洗涤服务费（9月）',
    amount: 42300.00, taxAmount: 2394.34, submitDate:'2026-10-16 16:38',
    budgetItem:'清洁绿化费', status:'pending', currentNode:1,
    payee:'贵阳净美洗涤服务有限公司', payeeAccount:'2401 0234 0000 9876 001',
    invoices:[{ code:'032001900233', no:'55208814', amount:42300.00, seller:'贵阳净美洗涤服务有限公司' }],
    lines:[{ item:'9月布草洗涤（按件结算）', qty:1, price:42300, amount:42300, taxRate:.06 }],
    note:'附洗涤明细清单 1 份',
    risk:[]
  },
  {
    id:'BX2026100021', type:'expense', typeLabel:'费用报销',
    storeId:'S12', applicant:'张伟', dept:'销售部', title:'客户招待餐费',
    amount: 4680.00, taxAmount: 264.91, submitDate:'2026-10-17 19:42',
    budgetItem:'业务招待费', status:'pending', currentNode:1,
    invoices:[{ code:'032002000517', no:'33902271', amount:4680.00, seller:'贵阳悦膳餐饮管理有限公司' }],
    lines:[{ item:'协议单位签约招待（6人）', qty:1, price:4680, amount:4680, taxRate:.06 }],
    note:'陪同：销售部2人，客户方4人',
    risk:[
      { level:'block', code:'T1', text:'外购餐饮服务进项税额不得抵扣，本单已自动按不可抵扣处理，税额 ¥264.91 计入费用' },
      { level:'warn', code:'B7', text:'业务招待费累计已达年度扣除限额的 82.4%，请注意汇算清缴调整' }
    ]
  },
  {
    id:'BX2026100024', type:'expense', typeLabel:'费用报销',
    storeId:'S01', applicant:'刘芳', dept:'前厅部', title:'前台办公用品',
    amount: 1180.00, taxAmount: 135.75, submitDate:'2026-10-18 08:15',
    budgetItem:'办公费', status:'pending', currentNode:0,
    invoices:[{ code:'032002100601', no:'44017728', amount:1180.00, seller:'贵阳晨光文具有限公司' }],
    lines:[{ item:'A4 纸、签字笔、房卡套等', qty:1, price:1180, amount:1180, taxRate:.13 }],
    note:'',
    risk:[
      { level:'warn', code:'D3', text:'疑似拆单：申请人刘芳在 7 日内另有 2 笔同类费用（¥860、¥1,240），合计 ¥3,280 已跨 ¥3,000 审批档位，将按合并金额走高一级审批' }
    ]
  },
  {
    id:'BX2026100026', type:'expense', typeLabel:'费用报销',
    storeId:'S03', applicant:'赵磊', dept:'客房部', title:'客用品补充（洗发水等）',
    amount: 6240.00, taxAmount: 718.06, submitDate:'2026-10-18 11:30',
    budgetItem:'客房物料消耗', status:'pending', currentNode:1,
    invoices:[{ code:'032001900188', no:'88451206', amount:6240.00, seller:'贵州洁雅纺织品有限公司' }],
    lines:[{ item:'客房一次性客用品套装', qty:600, price:10.4, amount:6240, taxRate:.13 }],
    note:'',
    risk:[
      { level:'block', code:'T2', text:'发票查重命中：该发票（代码 032001900188 / 号码 88451206）已于 2026-10-16 在「秀漫店」报销，单据号 BX2026100012，经办人陈晓燕。同一张发票不得重复报销。' }
    ]
  },
  {
    id:'BX2026100009', type:'expense', typeLabel:'费用报销',
    storeId:'S13', applicant:'孙倩', dept:'市场部', title:'OTA 渠道推广费',
    amount: 15800.00, taxAmount: 894.34, submitDate:'2026-10-12 15:20',
    budgetItem:'市场推广费', status:'approved', currentNode:3,
    invoices:[{ code:'031002200077', no:'11200458', amount:15800.00, seller:'贵州云途网络科技有限公司' }],
    lines:[{ item:'9月 OTA 渠道推广服务费', qty:1, price:15800, amount:15800, taxRate:.06 }],
    note:'',
    risk:[]
  },
  {
    id:'FK2026100005', type:'payment', typeLabel:'付款申请',
    storeId:'S13', applicant:'孙倩', dept:'采购部', title:'温泉区水质处理药剂',
    amount: 9720.00, taxAmount: 1118.76, submitDate:'2026-10-11 09:05',
    budgetItem:'物料消耗', status:'approved', currentNode:3,
    payee:'贵阳碧水化工有限公司', payeeAccount:'2403 0088 0000 5566 002',
    invoices:[{ code:'032004100066', no:'22019034', amount:9720.00, seller:'贵阳碧水化工有限公司' }],
    lines:[{ item:'泳池消毒药剂', qty:1, price:9720, amount:9720, taxRate:.13 }],
    note:'',
    risk:[]
  },
  {
    id:'FK2026100014', type:'payment', typeLabel:'付款申请',
    storeId:'S07', applicant:'王建国', dept:'工程部', title:'电梯年度维保（预付）',
    amount: 36000.00, taxAmount: 2037.74, submitDate:'2026-10-18 16:02',
    budgetItem:'维修保养费', status:'pending', currentNode:1,
    payee:'贵州通力电梯服务有限公司', payeeAccount:'2402 0200 0000 7788 003',
    invoices:[{ code:'032002100301', no:'99004771', amount:36000.00, seller:'贵州通力电梯服务有限公司' }],
    lines:[{ item:'2026年11月-2027年10月电梯维保', qty:1, price:36000, amount:36000, taxRate:.06 }],
    note:'跨年度预付，需按月分摊至 6602.03',
    risk:[
      { level:'warn', code:'B2', text:'跨年度费用：本次付款覆盖 12 个月，应按受益期分摊，不得一次性计入当期费用' }
    ]
  },
  {
    id:'BX2026100028', type:'expense', typeLabel:'费用报销',
    storeId:'S02', applicant:'刘敏', dept:'前厅部', title:'10 月前台服务技能培训费',
    amount: 12800.00, taxAmount: 724.53, submitDate:'2026-10-19 10:15',
    budgetItem:'培训费', status:'pending', currentNode:3,
    invoices:[{ code:'032002100722', no:'77120094', amount:12800.00, seller:'贵阳博思酒店管理咨询有限公司' }],
    lines:[
      { item:'前台服务技能培训（16 课时）', qty:16, price:680, amount:10880, taxRate:.06 },
      { item:'培训教材印制', qty:40, price:48, amount:1920, taxRate:.06 }
    ],
    note:'店长已审批，门店财务已核发票，请总部复核培训费列支口径',
    risk:[]
  },
  {
    id:'FK2026100019', type:'payment', typeLabel:'付款申请',
    storeId:'S05', applicant:'张伟', dept:'采购部', title:'10 月客房易耗品货款（第三批）',
    amount: 68500.00, taxAmount: 7880.53, submitDate:'2026-10-19 15:42',
    budgetItem:'客房物料', status:'pending', currentNode:3,
    payee:'贵州洁雅纺织品有限公司', payeeAccount:'2402 0166 0000 2211 908',
    payBank:'中国银行贵阳观山湖支行', payType:'供应商货款',
    invoices:[{ code:'032002100311', no:'88459301', amount:68500.00, seller:'贵州洁雅纺织品有限公司' }],
    lines:[
      { item:'一次性拖鞋', qty:4000, price:6.2, amount:24800, taxRate:.13 },
      { item:'洗护套装', qty:3000, price:9.8, amount:29400, taxRate:.13 },
      { item:'纸巾卷', qty:1000, price:14.3, amount:14300, taxRate:.13 }
    ],
    note:'验收单 GRN-20261019-05 已上传，三单匹配通过',
    attach:[
      { name:'采购合同-GZJY-2026-018.pdf', size:'1.8 MB', kind:'pdf', by:'张伟', time:'2026-10-19 15:30' },
      { name:'验收单-GRN20261019-05.pdf', size:'412 KB', kind:'pdf', by:'张伟', time:'2026-10-19 15:31' },
      { name:'供应商账户变更函.pdf', size:'268 KB', kind:'pdf', by:'张伟', time:'2026-10-19 15:33' }
    ],
    risk:[
      { level:'warn', code:'S3', text:'收款账户与合同备案账户不一致，已触发供应商账户变更复核，需 T+1 冷静期后方可付款' }
    ]
  },
  {
    id:'FK2026100021', type:'payment', typeLabel:'付款申请',
    storeId:'S08', applicant:'周慧', dept:'销售部', title:'9 月携程 OTA 佣金结算',
    amount: 23400.00, taxAmount: 1409.43, submitDate:'2026-10-18 09:30',
    budgetItem:'市场推广', status:'pending', currentNode:4,
    payee:'携程旅行网（上海）商务有限公司', payeeAccount:'1001 2345 6789 0001 234',
    invoices:[{ code:'031002100955', no:'66001128', amount:23400.00, seller:'携程旅行网（上海）商务有限公司' }],
    lines:[{ item:'9 月平台佣金（含税 6%）', qty:1, price:23400, amount:23400, taxRate:.06 }],
    note:'按总额法核算：佣金计入 6601.03 销售费用，不冲减客房收入；本月已按净额回款',
    risk:[
      { level:'warn', code:'O2', text:'OTA 佣金适用总额法，不得冲减营业收入；请确认本笔未在收入科目挂账' }
    ]
  }
];

/* ---- 发票池 ---- */
const INVOICES = [
  { id:'I001', code:'032002100311', no:'88451206', date:'2026-10-14', seller:'贵州洁雅纺织品有限公司', amount:8640.00, tax:984.91, rate:.13, type:'增值税专用发票', status:'used', storeId:'S01', docId:'BX2026100012', category:'客房物料', deduct:'yes' },
  { id:'I002', code:'032002100412', no:'77319044', date:'2026-10-15', seller:'贵州恒信机电工程有限公司', amount:28600.00, tax:3269.03, rate:.13, type:'增值税专用发票', status:'used', storeId:'S07', docId:'BX2026100018', category:'维修保养', deduct:'yes' },
  { id:'I003', code:'032002100108', no:'66120438', date:'2026-10-08', seller:'贵阳老城置业有限公司', amount:186000.00, tax:15357.80, rate:.09, type:'增值税专用发票', status:'used', storeId:'S05', docId:'FK2026100007', category:'房屋租赁', deduct:'yes' },
  { id:'I004', code:'032001900233', no:'55208814', date:'2026-10-12', seller:'贵阳净美洗涤服务有限公司', amount:42300.00, tax:2394.34, rate:.06, type:'增值税专用发票', status:'used', storeId:'S09', docId:'FK2026100011', category:'洗涤服务', deduct:'yes' },
  { id:'I005', code:'032002000517', no:'33902271', date:'2026-10-17', seller:'贵阳悦膳餐饮管理有限公司', amount:4680.00, tax:264.91, rate:.06, type:'增值税普通发票', status:'used', storeId:'S12', docId:'BX2026100021', category:'业务招待', deduct:'no', deductReason:'外购餐饮服务，进项税额不得抵扣' },
  { id:'I006', code:'032001900188', no:'88451206', date:'2026-10-16', seller:'贵州洁雅纺织品有限公司', amount:6240.00, tax:718.06, rate:.13, type:'增值税专用发票', status:'dup', storeId:'S03', docId:'BX2026100026', category:'客房物料', deduct:'no', deductReason:'重复发票，已阻断' },
  { id:'I007', code:'032002100601', no:'44017728', date:'2026-10-16', seller:'贵阳晨光文具有限公司', amount:1180.00, tax:135.75, rate:.13, type:'增值税专用发票', status:'used', storeId:'S01', docId:'BX2026100024', category:'办公费', deduct:'yes' },
  { id:'I008', code:'031002200077', no:'11200458', date:'2026-10-10', seller:'贵州云途网络科技有限公司', amount:15800.00, tax:894.34, rate:.06, type:'增值税专用发票', status:'used', storeId:'S13', docId:'BX2026100009', category:'广告推广', deduct:'yes' },
  { id:'I009', code:'031001800341', no:'70233819', date:'2026-10-09', seller:'贵州苏宁易购商贸有限公司', amount:3280.00, tax:377.35, rate:.13, type:'增值税专用发票', status:'unused', storeId:'S10', docId:'', category:'办公设备', deduct:'yes' },
  { id:'I010', code:'031002000455', no:'88013472', date:'2026-10-17', seller:'贵阳千千惠食品有限公司', amount:9600.00, tax:1104.42, rate:.13, type:'增值税专用发票', status:'unused', storeId:'S12', docId:'', category:'餐饮原材料', deduct:'yes' },
  { id:'I011', code:'031002000466', no:'88013480', date:'2026-10-17', seller:'贵阳千千惠食品有限公司', amount:7450.00, tax:856.90, rate:.13, type:'增值税专用发票', status:'unused', storeId:'S12', docId:'', category:'餐饮原材料', deduct:'yes' },
  { id:'I012', code:'031000000099', no:'11223344', date:'2026-09-28', seller:'贵阳万家福商贸有限公司', amount:5200.00, tax:598.17, rate:.13, type:'增值税普通发票', status:'abnormal', storeId:'S13', docId:'', category:'物料消耗', deduct:'no', deductReason:'供应商已被认定为非正常户，发票列为异常凭证' },
  /* 演示主体（秀漫店 S01）补充两张未使用专票，便于走通「从发票池勾选」链路 */
  { id:'I013', code:'032002100733', no:'90114427', date:'2026-10-19', seller:'贵州洁雅纺织品有限公司', amount:4464.00, tax:513.56, rate:.13, type:'增值税专用发票', status:'unused', storeId:'S01', docId:'', category:'客房物料', deduct:'yes' },
  { id:'I014', code:'032002100744', no:'90114508', date:'2026-10-20', seller:'贵阳晨光文具有限公司', amount:1180.00, tax:135.75, rate:.13, type:'增值税专用发票', status:'unused', storeId:'S01', docId:'', category:'办公费', deduct:'yes' }
];

/* ---- 凭证（PMS 日结自动生成示例） ---- */
const VOUCHERS = [
  { id:'记-2026-09-0001', date:'2026-09-30', storeId:'S01', source:'PMS日结', summary:'9月30日营业收入结转',
    status:'posted', amount: 68320.45,
    lines:[
      { subj:'1001', name:'库存现金', debit: 8420.00, credit:0 },
      { subj:'1002.01', name:'银行存款-人民币户', debit: 45180.45, credit:0 },
      { subj:'1122.02', name:'应收账款-OTA平台', debit: 9870.00, credit:0 },
      { subj:'1122.01', name:'应收账款-协议单位挂账', debit: 4850.00, credit:0 },
      { subj:'5001.01.04', name:'客房收入-OTA', debit:0, credit: 32800.00 },
      { subj:'5001.01.01', name:'客房收入-散客', debit:0, credit: 21400.00 },
      { subj:'5001.02.01', name:'餐饮收入-中餐', debit:0, credit: 11860.00 },
      { subj:'5001.06', name:'停车收入', debit:0, credit: 1840.00 },
      { subj:'2221.01.02', name:'应交增值税-销项税额', debit:0, credit: 3867.20 },
      { subj:'5301.04', name:'营业外收入-尾差收入', debit:0, credit: 0.05 }
    ]},
  { id:'记-2026-09-0002', date:'2026-09-30', storeId:'S05', source:'PMS日结', summary:'9月30日营业收入结转',
    status:'posted', amount: 48920.10,
    lines:[
      { subj:'1002.01', name:'银行存款-人民币户', debit: 34200.10, credit:0 },
      { subj:'1122.01', name:'应收账款-协议单位挂账', debit: 14720.00, credit:0 },
      { subj:'5001.01.03', name:'客房收入-协议单位', debit:0, credit: 18900.00 },
      { subj:'5001.01.01', name:'客房收入-散客', debit:0, credit: 12840.00 },
      { subj:'5001.02.03', name:'餐饮收入-宴会', debit:0, credit: 14360.00 },
      { subj:'2221.01.02', name:'应交增值税-销项税额', debit:0, credit: 2770.10 }
    ]},
  { id:'记-2026-09-0421', date:'2026-09-30', storeId:'S01', source:'报销单', summary:'陈晓燕报销客房布草采购',
    status:'draft', amount: 8640.00,
    lines:[
      { subj:'6001.01.02', name:'主营业务成本-布草及洗涤', debit: 7655.09, credit:0 },
      { subj:'2221.01.01', name:'应交增值税-进项税额', debit: 984.91, credit:0 },
      { subj:'2241.04', name:'其他应付款-应付员工报销款', debit:0, credit: 8640.00 }
    ]}
];

/* ---- 结转检查清单（14 家并行结账） ---- */
const CLOSE_CHECKS = [
  { key:'pms',    label:'PMS 日结数据完整（30 天无缺失）', bad:[] },
  { key:'bank',   label:'银行流水已全部导入并认领', bad:['S11'] },
  { key:'vat',    label:'销项开票与申报销售额一致', bad:[] },
  { key:'in',     label:'进项发票已全部认证或标记不可抵扣', bad:['S04'] },
  { key:'ar',     label:'应收账款账龄已复核（超 90 天）', bad:['S06','S11'] },
  { key:'ap',     label:'应付账款暂估已清理', bad:[] },
  { key:'dep',    label:'固定资产折旧已计提', bad:[] },
  { key:'fee',    label:'总部管理费已确认并双边记账', bad:['S03'] },
  { key:'profit', label:'损益已结转，科目余额平衡', bad:[] }
];

/* ---- 预算（按费用项目） ---- */
const BUDGETS = [
  { item:'人工成本',   budget: 2860000, used: 2904000, inTrans: 0 },
  { item:'能源费',     budget:  920000, used:  864000, inTrans: 12000 },
  { item:'客房物料',   budget:  680000, used:  712000, inTrans: 8640 },
  { item:'餐饮成本',   budget:  980000, used:  942000, inTrans: 22000 },
  { item:'维修保养',   budget:  540000, used:  486000, inTrans: 64600 },
  { item:'市场推广',   budget:  420000, used:  398000, inTrans: 15800 },
  { item:'办公及其他', budget:  310000, used:  242000, inTrans: 1180 },
  { item:'业务招待',   budget:   96000, used:   79000, inTrans: 4680 },
  { item:'房屋租赁',   budget: 1240000, used: 1240000, inTrans: 186000 }
];

/* ---- 预警（按门店 + 规则） ---- */
const ALERTS = (() => {
  const out = [];
  STORES.forEach(s => {
    if (s.revYoY < -.05) out.push({ storeId:s.id, level:'P1', text:`RevPAR 同比下降 ${Math.abs(s.revYoY*100).toFixed(1)}%，持续 2 个月`, rule:'R07' });
    if (s.gopRate < .28) out.push({ storeId:s.id, level:'P1', text:`GOP 率 ${(s.gopRate*100).toFixed(1)}%，低于集团警戒线 28%`, rule:'R14' });
    if (s.energyRate > .095) out.push({ storeId:s.id, level:'P2', text:`能耗占比 ${(s.energyRate*100).toFixed(1)}%，高于同类门店均值`, rule:'R11' });
    if (s.budgetRate > .95) out.push({ storeId:s.id, level:'P2', text:`费用预算执行率 ${(s.budgetRate*100).toFixed(1)}%，接近超支`, rule:'R18' });
    if (s.arOver90 > 0) out.push({ storeId:s.id, level:'P2', text:`应收超 90 天余额 ¥${Math.round(s.arOver90).toLocaleString()}，请催收`, rule:'R21' });
  });
  return out;
})();

/* ---- 科目表（节选，与方案文档一致；正式定稿前需统一编码体系） ---- */
const SUBJECTS = [
  { code:'1002', name:'银行存款', lv:1 }, { code:'1002.01', name:'人民币户', lv:2 },
  { code:'1122', name:'应收账款', lv:1 }, { code:'1122.01', name:'协议单位挂账', lv:2 },
  { code:'1122.02', name:'OTA平台', lv:2 }, { code:'1123', name:'预付账款', lv:1 },
  { code:'1221', name:'其他应收款', lv:1 }, { code:'1601', name:'固定资产', lv:1 },
  { code:'1602', name:'累计折旧', lv:1 }, { code:'2202', name:'应付账款', lv:1 },
  { code:'2202.05', name:'暂估应付款', lv:2 }, { code:'2211', name:'应付职工薪酬', lv:1 },
  { code:'2221.01', name:'应交增值税', lv:2 }, { code:'2221.01.01', name:'进项税额', lv:3 },
  { code:'2221.01.02', name:'销项税额', lv:3 }, { code:'2221.03', name:'应交企业所得税', lv:2 },
  { code:'2241.04', name:'应付员工报销款', lv:2 }, { code:'5001', name:'主营业务收入', lv:1 },
  { code:'5001.01', name:'客房收入', lv:2 }, { code:'5001.02', name:'餐饮收入', lv:2 },
  { code:'5001.03', name:'会议收入', lv:2 }, { code:'5001.09', name:'管理费收入', lv:2 },
  { code:'6001', name:'主营业务成本', lv:1 }, { code:'6001.01', name:'客房成本', lv:2 },
  { code:'6001.02', name:'餐饮成本', lv:2 }, { code:'6401', name:'税金及附加', lv:1 },
  { code:'6601', name:'销售费用', lv:1 }, { code:'6602', name:'管理费用', lv:1 },
  { code:'6602.24', name:'总部费用分摊', lv:2 }, { code:'6603', name:'财务费用', lv:1 },
  { code:'5301.04', name:'营业外收入-尾差收入', lv:2 }
];

/* ================= 工作台：财务日历与通知 =================
   财务工作台的价值不在「好看」，而在于把「什么时候必须做什么」摆在人眼前。
   日历项按角色过滤：门店侧只看与本店相关的关账/付款节点，总部侧看申报与集团节点。 */

const WORKBENCH_DATE = '2026-10-21';   // 演示用「今天」

const CALENDAR = [
  { date:'2026-10-15', title:'9 月增值税及附加税申报（14 家）', type:'tax',      state:'done', roles:['hqfin','cfo'] },
  { date:'2026-10-22', title:'9 月企业所得税季度预缴（小型微利）', type:'tax',     state:'todo', roles:['hqfin','cfo'] },
  { date:'2026-10-24', title:'S07 星程公寓租赁合同到期，需续签评估', type:'contract', state:'todo', roles:['hqfin','cfo'] },
  { date:'2026-10-25', title:'供应商集中付款日（10 月第二批）', type:'pay',        state:'todo', roles:['cashier','hqfin','cfo'] },
  { date:'2026-10-28', title:'9 月社保、公积金缴纳（15 日前已申报）', type:'pay',  state:'todo', roles:['hqfin','cashier'] },
  { date:'2026-10-31', title:'10 月关账启动 · 14 家并行', type:'close',           state:'todo', roles:['hqfin','cfo','storefin'] },
  { date:'2026-11-05', title:'10 月管理报表出具（集团合并）', type:'close',        state:'todo', roles:['hqfin','cfo'] },
  { date:'2026-11-15', title:'10 月增值税申报截止', type:'tax',                   state:'todo', roles:['hqfin','cfo'] },
  { date:'2026-10-23', title:'S06 应收账款超 90 天催收跟进', type:'ar',           state:'todo', roles:['storefin','hqfin','cfo'] },
  { date:'2026-10-26', title:'S04 进项发票认证截止（税控盘）', type:'tax',         state:'todo', roles:['storefin','hqfin'] }
];

const NOTICES = [
  { id:'N01', tag:'政策', date:'2026-10-18', roles:['hqfin','cfo','storefin'],
    title:'小型微利企业所得税优惠延续至 2027 年 12 月 31 日',
    body:'14 家门店均按单一法人分别判定，年应纳税所得额 300 万以内、从业人数 300 人以内、资产总额 5000 万以内，实际税负 5%。系统已在申报取数环节内置判定，季度预缴自动套用。' },
  { id:'N02', tag:'口径', date:'2026-10-17', roles:['hqfin','cfo','storefin','manager'],
    title:'9 月起日报与月报差额单独立项，月末出具《营业收入调节表》',
    body:'日报走 PMS 含税经营口径，月报走总账不含税会计口径。两套口径差异（折扣、免费房、冲账、视同销售、税额）在三阶式调节表中逐项对齐，门店不再手工凑数。' },
  { id:'N03', tag:'内控', date:'2026-10-16', roles:['staff','manager','storefin','hqfin','cfo'],
    title:'同一发票代码+号码全局唯一，重复报销将被系统拦截',
    body:'发票在提交环节即做全集团查重，命中时直接展示首次使用的单据号、报销人与报销日期。请注意：发票查重是全局的，抵扣是分主体的，两者互不替代。' },
  { id:'N04', tag:'流程', date:'2026-10-14', roles:['manager','storefin','hqfin','cfo','cashier'],
    title:'门店零付款权限已生效，全部款项由总部集中支付',
    body:'门店不再持有付款权限，所有付款由总部出纳代各主体操作银行账户。严禁跨主体勾选付款——同一批付款只能属于同一个法人主体。' }
];

/* ================= 费用项目：一级大类 + 二级细分 =================
   设计口径：
   1）一级大类对应管理报表的费用归集口径（USALI 六层损益的中间层），二级细分对应日常报销时真正要选的那一项；
   2）二级明细直接绑定预算项，预算控制落在明细上，报表汇总按大类；
   3）门店只能选集团已发布的明细，不能自建——否则 14 家各写各的，汇总就废了。 */

const EXPENSE_TREE = [
  { group:'客房成本', budget:'客房物料', items:[
    { name:'客房物料消耗' }, { name:'布草洗涤费' }, { name:'客用品采购' }, { name:'迷你吧成本' }
  ]},
  { group:'餐饮成本', budget:'餐饮成本', items:[
    { name:'食材采购' }, { name:'酒水饮料' }, { name:'餐具器皿' }
  ]},
  { group:'人力成本', budget:'人工成本', items:[
    { name:'工资薪金' }, { name:'社保公积金' }, { name:'劳务外包' }, { name:'员工餐' }
  ]},
  { group:'能源费用', budget:'能源费', items:[
    { name:'电费' }, { name:'水费' }, { name:'燃气费' }
  ]},
  { group:'维修保养', budget:'维修保养', items:[
    { name:'维修保养费' }, { name:'电梯维保' }, { name:'空调维保' }, { name:'客房维修' }, { name:'消防维保' }
  ]},
  { group:'市场推广', budget:'市场推广', items:[
    { name:'市场推广费' }, { name:'OTA 平台佣金' }, { name:'广告投放' }, { name:'渠道佣金' }
  ]},
  { group:'管理费用', budget:'办公及其他', items:[
    { name:'办公费' }, { name:'差旅费' }, { name:'通讯费' }, { name:'培训费' },
    { name:'招聘费' }, { name:'业务招待费', budget:'业务招待' }
  ]},
  { group:'房屋租赁', budget:'房屋租赁', items:[
    { name:'房租' }, { name:'物业费' }, { name:'房产税' }
  ]},
  { group:'其他费用', budget:'办公及其他', items:[
    { name:'银行手续费' }, { name:'保险费' }, { name:'证照年检' }
  ]}
];

/* 费用项目反查：二级明细 → 预算项 */
function budgetItemOf(itemName){
  for (let i = 0; i < EXPENSE_TREE.length; i++){
    const g = EXPENSE_TREE[i];
    for (let j = 0; j < g.items.length; j++){
      if (g.items[j].name === itemName) return g.items[j].budget || g.budget;
    }
  }
  return null;
}

/* 付款类型（决定必填资料与审批附加节点） */
const PAY_TYPES = [
  { name:'供应商货款', needContract:true,  needGrn:true,  note:'需合同 + 验收单 + 发票，三单匹配' },
  { name:'房租及物业', needContract:true,  needGrn:false, note:'需租赁合同 + 房东发票，按期次核对' },
  { name:'OTA 平台佣金', needContract:true, needGrn:false, note:'需平台结算单，佣金走总额法不冲减收入' },
  { name:'工资及社保', needContract:false, needGrn:false, note:'需工资表 + 社保缴费清单，走代发' },
  { name:'税费缴纳',   needContract:false, needGrn:false, note:'需申报表，仅限本主体税种' },
  { name:'押金保证金', needContract:true,  needGrn:false, note:'需合同或投标文件，退押须原路退回' },
  { name:'其他付款',   needContract:false, needGrn:false, note:'需说明用途，按金额档位审批' }
];

/* ---- 供应商 / 收款方主数据（含开户行） ---- */
const PAYEE_ACCOUNTS = [
  { id:'PA01', payee:'贵州洁雅纺织品有限公司', bank:'中国银行贵阳观山湖支行', account:'2402 0166 0000 2211 908', taxNo:'91320594MA1XK7Q23B', last:'2026-10-19', times:8, verified:true },
  { id:'PA02', payee:'贵阳老城置业有限公司', bank:'中国建设银行贵阳金阳支行', account:'3200 1628 0000 5522 118', taxNo:'91320500MA1MT8Y41F', last:'2026-10-08', times:12, verified:true },
  { id:'PA03', payee:'携程旅行网（上海）商务有限公司', bank:'招商银行贵阳分行营业部', account:'1001 2345 6789 0001 234', taxNo:'91310000607322765P', last:'2026-10-18', times:9, verified:true },
  { id:'PA04', payee:'贵州通力电梯服务有限公司', bank:'中国工商银行贵阳高新支行', account:'2402 0200 0000 7788 003', taxNo:'91320505MA1P6R2T9K', last:'2026-10-18', times:3, verified:false },
  { id:'PA05', payee:'贵阳净美洗涤服务有限公司', bank:'交通银行贵阳云岩支行', account:'3210 8800 1100 2233 445', taxNo:'91320104MA1WQ3E77N', last:'2026-10-12', times:6, verified:true },
  { id:'PA06', payee:'贵州恒信机电工程有限公司', bank:'贵阳银行观山湖支行', account:'3208 6688 0000 1122 334', taxNo:'91320506MA1YH4C58D', last:'2026-10-15', times:4, verified:true },
  { id:'PA07', payee:'贵阳千千惠食品有限公司', bank:'中国农业银行贵阳云岩支行', account:'1030 5000 4000 8899 1', taxNo:'91320205MA1NQ8K21M', last:'2026-10-17', times:7, verified:true }
];

/* ---- 本人收款账户（报销打款用，可记住上次使用） ---- */
const MY_ACCOUNTS = [
  { id:'MA01', payee:'陈晓燕', bank:'招商银行贵阳分行营业部', account:'6225 8801 2345 6789', last:'2026-10-16', times:5 },
  { id:'MA02', payee:'陈晓燕', bank:'中国工商银行贵阳喷水池支行', account:'6222 0211 0000 8899 123', last:'2026-09-08', times:2 },
  { id:'MA03', payee:'王建国', bank:'中国银行贵阳云岩支行', account:'6217 8500 0011 2233 445', last:'2026-10-18', times:3 },
  { id:'MA04', payee:'刘敏',   bank:'建设银行贵阳火车站支行', account:'6217 0012 0000 5566 778', last:'2026-10-19', times:1 }
];

/* ---- 附件类型（原型按扩展名归类，正式版由文件服务返回） ---- */
const ATTACH_KIND = {
  img:  { label:'图片', cls:'tag-teal' },
  pdf:  { label:'PDF',  cls:'tag-red' },
  xls:  { label:'表格', cls:'tag-teal' },
  doc:  { label:'文档', cls:'tag-blue' },
  zip:  { label:'压缩包', cls:'tag-amber' },
  other:{ label:'文件', cls:'tag-gray' }
};
