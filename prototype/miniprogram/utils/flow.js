/* ================= 审批链（与 PC 端 assets/core.js 完全一致） =================
   节点口径：
     <3000   4 节点：提交申请 → 店长审批 → 门店财务审核 → 出纳付款
     <20000  5 节点：+ 总部财务审核
     <50000  6 节点：+ 财务总监审批
     ≥50000  7 节点：+ 总经理审批 → 出纳付款
   注意：门店财务审核在全部档位均存在，分档差异只体现在总部节点上。 */

function getFlow(doc){
  const nodes = [
    { name:'提交申请', role:'applicant', who:doc.applicant },
    { name:'店长审批', role:'manager', who:'门店店长' }
  ];
  if (doc.amount < 3000){
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
  } else if (doc.amount < 20000){
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
    nodes.push({ name:'总部财务审核', role:'hqfin', who:'总部财务经理' });
  } else if (doc.amount < 50000){
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
    nodes.push({ name:'总部财务审核', role:'hqfin', who:'总部财务经理' });
    nodes.push({ name:'财务总监审批', role:'cfo', who:'财务总监' });
  } else {
    nodes.push({ name:'门店财务审核', role:'storefin', who:'门店财务' });
    nodes.push({ name:'总部财务审核', role:'hqfin', who:'总部财务经理' });
    nodes.push({ name:'财务总监审批', role:'cfo', who:'财务总监' });
    nodes.push({ name:'总经理审批', role:'gm', who:'总经理' });
  }
  nodes.push({ name:'出纳付款', role:'cashier', who:'总部出纳' });
  return nodes;
}

/* 当前节点是否属于该角色；财务总监具备全链路审批权
   与 core.js 保持一致：只看节点角色，不看单据状态。
   调用方需自行限定 doc.status === 'pending'。 */
function canApprove(doc, role){
  const flow = getFlow(doc);
  const node = flow[doc.currentNode];
  if (!node) return false;
  if (role === 'cfo') return true;
  return node.role === role;
}

/* 审批人姓名文案（提交节点显示真实申请人） */
function nodeWho(doc){
  return getFlow(doc).map(n => n.name + '·' + n.who);
}

module.exports = { getFlow, canApprove, nodeWho };
