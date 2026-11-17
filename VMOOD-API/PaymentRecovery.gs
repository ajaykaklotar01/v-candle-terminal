// ==========================================
// VMOOD PAYMENT RECOVERY
// Automatic payment reconciliation + reservation expiry
// ==========================================

function recoverVmoodPayments() {
  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

  if (!keyId || !keySecret) {
    throw new Error("Razorpay configuration missing");
  }

  const lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) {
    return { success: true, skipped: true, message: "Another VMOOD recovery task is running." };
  }

  const summary = {
    checked: 0,
    recovered: 0,
    expired: 0,
    reviewRequired: 0,
    errors: 0
  };

  try {
    const sheet = getVmoodReservationsSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, ...summary };

    const rows = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    const now = Date.now();
    const lookbackMs = 24 * 60 * 60 * 1000;
    const maxChecksPerRun = 20;
    let checkedThisRun = 0;

    // Oldest unresolved reservations are checked first so a busy store
    // cannot permanently starve earlier payments.
    for (let i = 0; i < rows.length; i++) {
      if (checkedThisRun >= maxChecksPerRun) break;

      const row = rows[i];
      const orderId = String(row[0] || "").trim();
      const status = String(row[13] || "").trim().toUpperCase();
      const createdAt = new Date(row[11]).getTime();
      const expiresAt = new Date(row[12]).getTime();

      const eligibleStatus = [
        "PENDING", "PROCESSING", "EXPIRED", "CANCELLED", "REVIEW_REQUIRED"
      ].includes(status);

      if (
        !orderId ||
        !eligibleStatus ||
        !Number.isFinite(createdAt) ||
        now - createdAt > lookbackMs
      ) {
        continue;
      }

      checkedThisRun++;
      summary.checked++;

      try {
        const response = UrlFetchApp.fetch(
          "https://api.razorpay.com/v1/orders/" +
            encodeURIComponent(orderId) + "/payments",
          {
            method: "get",
            headers: {
              Authorization: "Basic " +
                Utilities.base64Encode(keyId + ":" + keySecret)
            },
            muteHttpExceptions: true
          }
        );

        if (response.getResponseCode() !== 200) {
          throw new Error("Razorpay payment lookup returned HTTP " +
            response.getResponseCode());
        }

        const result = JSON.parse(response.getContentText());
        const payments = Array.isArray(result.items) ? result.items : [];

        const capturedPayment = payments.find(function(payment) {
          return payment.status === "captured" &&
            payment.order_id === orderId &&
            payment.id;
        });

        if (capturedPayment) {
          // This HMAC is generated internally only after an authenticated
          // Razorpay API lookup confirms the captured payment. The normal
          // verifier then independently fetches and validates the payment.
          const signatureBytes = Utilities.computeHmacSha256Signature(
            orderId + "|" + capturedPayment.id,
            keySecret
          );

          const internalSignature = signatureBytes.map(function(byte) {
            return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
          }).join("");

          const recovered = verifyVmoodPayment_({
            razorpay_order_id: orderId,
            razorpay_payment_id: capturedPayment.id,
            razorpay_signature: internalSignature
          });

          if (recovered && recovered.paymentVerified) {
            summary.recovered++;
            if (String(recovered.message || "").toLowerCase().indexOf("manual review") !== -1) {
              summary.reviewRequired++;
            }
          }
          continue;
        }

        const authorizedPayment = payments.find(function(payment) {
          return payment.status === "authorized" &&
            payment.order_id === orderId &&
            payment.id;
        });

        if (authorizedPayment) {
          // Authorization is not treated as a completed payment.
          // Keep it for review rather than releasing stock blindly.
          if (status === "PENDING" || status === "EXPIRED" || status === "CANCELLED") {
            sheet.getRange(i + 2, 14).setValue("REVIEW_REQUIRED");
            sheet.getRange(i + 2, 15).setValue(authorizedPayment.id);
            summary.reviewRequired++;
          }
          continue;
        }

        // Only release an expired PENDING reservation after checking
        // Razorpay and finding no captured or authorized payment.
        if (
          status === "PENDING" &&
          Number.isFinite(expiresAt) &&
          expiresAt <= now
        ) {
          sheet.getRange(i + 2, 14).setValue("EXPIRED");
          summary.expired++;
        }

      } catch (error) {
        summary.errors++;
        Logger.log("VMOOD recovery error for " + orderId + ": " + error.message);
      }
    }

    SpreadsheetApp.flush();
    Logger.log("VMOOD PAYMENT RECOVERY: " + JSON.stringify(summary));
    return { success: true, ...summary };

  } finally {
    lock.releaseLock();
  }
}

function installVmoodPaymentRecoveryTrigger() {
  const handler = "recoverVmoodPayments";
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("VMOOD automatic payment recovery trigger installed (every 5 minutes).");
}

function expireVmoodReservations_() {

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {

    const sheet = getVmoodReservationsSheet_();

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return {
        success: true,
        expiredCount: 0
      };
    }

    const rows = sheet.getRange(
      2,
      1,
      lastRow - 1,
      15
    ).getValues();

    const now = Date.now();
    let expiredCount = 0;

    for (let i = 0; i < rows.length; i++) {

      const status = String(rows[i][13] || "")
        .trim()
        .toUpperCase();

      if (status !== "PENDING") {
        continue;
      }

      const expiry = new Date(rows[i][12]).getTime();

      if (
        Number.isFinite(expiry) &&
        expiry <= now
      ) {

        sheet.getRange(i + 2, 14)
          .setValue("EXPIRED");

        expiredCount++;
      }
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      expiredCount: expiredCount,
      message: "Expired reservations cleaned successfully"
    };

  } finally {
    lock.releaseLock();
  }
}
