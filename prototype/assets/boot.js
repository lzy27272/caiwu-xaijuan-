/* ================= 启动 ================= */

window.App = {
  go, setRole, setStore, closeModal,
  openDoc, approveDoc, rejectDoc,
  openInv, openVoucher, pmsPreview, confirmPms,
  newExpense, simulateCheck, simulateDup, submitExpense,
  newPayment, submitPayment, simulatePayCheck,
  onGroupChange, useAcct,
  addLine, delLine, editLine, pickInvoice,
  pickAttach, mockAttach, removeAttach,
  pickReceipt, mockReceipt, confirmReceipt, skipReceipt, openReceipt,
  recalcPay, doPay, payOne, finishClose,
  wbTab(key){ State.wbTab = key; render(); },
  wbNotice,
  openStore(id){ State.storeId = id; State.page = 'dashboard-store'; render(); },
  invkAdd, invkRun, invkDrop, invkOpen, invkManual, invkSet, invkSave,
  exportDialog, doExportCsv, doExportPdf,
  openAttach, attStep, backToDoc, attDownload, openReceiptView
};

/* Esc：预览弹窗先退回单据，再按一次才关闭。
   审批人经常开预览核对完就想回正文，一步关掉整个弹窗会丢上下文。 */
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (ATT_CTX){ backToDoc(); ev.stopPropagation(); return; }
  const mask = document.getElementById('modalMask');
  if (mask && mask.classList.contains('show')) closeModal();
});

(function init(){
  State.docs = JSON.parse(JSON.stringify(DOCS));
  State.docs.forEach(d => { d.log = d.log || []; });
  loadState();
  renderRoleSwitch();
  render();
})();
