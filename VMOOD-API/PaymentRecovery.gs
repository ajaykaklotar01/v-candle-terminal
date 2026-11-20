// ==========================================
// VMOOD PAYMENT RECONCILIATION
// No reservations, stock holds, or expiry logic
// ==========================================

function recoverVmoodPayments() {
  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay configuration missing");

  const lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) {
    return { success: true, skipped: true, message: "Another reconciliation task is running." };
  }

  const summary = { checked: 0, recovered: 0, errors: 0 };
  try {
    const sheet = getVmoodOrdersSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, ...summary };
    const rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
    let checkedThisRun = 0;

    // Check unresolved orders, newest first. No reservation expiry or stock hold is used.
    for (let i = rows.length - 1; i >= 0 && checkedThisRun < 20; i--) {
      const row = rows[i];
      const orderRzpId = String(row[12] || "").trim();
      const paymentStatus = String(row[14] || "").trim().toUpperCase();
      const stockStatus = String(row[15] || "").trim().toUpperCase();
      const needsCheck = orderRzpId &&
        (paymentStatus === "PENDING" || (paymentStatus === "PAID" && stockStatus !== "TRUE"));
      if (!needsCheck) continue;

      checkedThisRun++;
      summary.checked++;
      try {
        const response = UrlFetchApp.fetch(
          "https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderRzpId) + "/payments",
          {
            method: "get",
            headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
            muteHttpExceptions: true
          }
        );
        if (response.getResponseCode() !== 200) {
          throw new Error("Razorpay lookup returned HTTP " + response.getResponseCode());
        }

        const result = JSON.parse(response.getContentText());
        const payments = Array.isArray(result.items) ? result.items : [];
        const captured = payments.find(function(payment) {
          return payment.status === "captured" && payment.order_id === orderRzpId && payment.id;
        });
        if (!captured) continue;

        const signature = Utilities.computeHmacSha256Signature(
          orderRzpId + "|" + captured.id, keySecret
        ).map(function(byte) {
          return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
        }).join("");

        const outcome = verifyVmoodPayment_({
          razorpay_order_id: orderRzpId,
          razorpay_payment_id: captured.id,
          razorpay_signature: signature
        });
        if (outcome && outcome.paymentVerified) summary.recovered++;
      } catch (error) {
        summary.errors++;
        Logger.log("VMOOD reconciliation error for " + orderRzpId + ": " + error.message);
      }
    }

    SpreadsheetApp.flush();
    Logger.log("VMOOD PAYMENT RECONCILIATION: " + JSON.stringify(summary));
    return { success: true, ...summary };
  } finally {
    lock.releaseLock();
  }
}

function installVmoodPaymentRecoveryTrigger() {
  const handler = "recoverVmoodPayments";
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  Logger.log("VMOOD payment reconciliation trigger installed (every 5 minutes).");
}
