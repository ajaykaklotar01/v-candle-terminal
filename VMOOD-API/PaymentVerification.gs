// ==========================================
// VMOOD PAYMENT VERIFICATION + STOCK UPDATE
// Uses ORDERS as the single order record
// ==========================================

function verifyVmoodPayment_(body) {
  const razorpayOrderId = String(body.razorpay_order_id || "").trim();
  const razorpayPaymentId = String(body.razorpay_payment_id || "").trim();
  const razorpaySignature = String(body.razorpay_signature || "").trim();
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Payment verification details missing");
  }

  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay configuration missing");

  const expectedSignature = Utilities.computeHmacSha256Signature(
    razorpayOrderId + "|" + razorpayPaymentId, keySecret
  ).map(function(byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
  if (!vmoodConstantTimeCompare_(expectedSignature, razorpaySignature.toLowerCase())) {
    throw new Error("Invalid Razorpay payment signature");
  }

  const paymentResponse = UrlFetchApp.fetch(
    "https://api.razorpay.com/v1/payments/" + encodeURIComponent(razorpayPaymentId),
    {
      method: "get",
      headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
      muteHttpExceptions: true
    }
  );
  if (paymentResponse.getResponseCode() !== 200) {
    throw new Error("Unable to verify payment with Razorpay. Please do not pay again.");
  }

  const payment = JSON.parse(paymentResponse.getContentText());
  if (payment.id !== razorpayPaymentId || payment.order_id !== razorpayOrderId) {
    throw new Error("Razorpay payment details do not match this order");
  }
  if (payment.status !== "captured") {
    throw new Error("Payment is not captured. Current status: " + payment.status);
  }
  if (payment.currency !== "INR") throw new Error("Invalid payment currency");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getVmoodOrdersSheet_();
    const orderRow = findVmoodOrderRow_(sheet, razorpayOrderId);
    if (!orderRow) throw new Error("Order record not found. Contact VMOOD and do not pay again.");

    const row = sheet.getRange(orderRow, 1, 1, 16).getValues()[0];
    const orderId = String(row[1] || "");
    const sku = String(row[2] || "").trim().toUpperCase();
    const option = String(row[4] || "").trim();
    const quantity = Number(row[5]);
    const unitPrice = Number(row[6]);
    const totalAmount = Number(row[7]);
    const savedPaymentId = String(row[13] || "").trim();
    const stockStatus = String(row[15]).trim().toUpperCase();

    if (savedPaymentId && savedPaymentId !== razorpayPaymentId) {
      throw new Error("A different payment is already linked to this order");
    }
    if (!/^(MP|WP)[A-Z0-9_-]+$/.test(sku) || !option ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 ||
        !Number.isFinite(unitPrice) || unitPrice <= 0 ||
        !Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new Error("Saved order details are invalid");
    }
    if (Math.round(totalAmount * 100) !== Number(payment.amount) ||
        Math.round(unitPrice * quantity * 100) !== Math.round(totalAmount * 100)) {
      throw new Error("Payment amount does not match the saved order");
    }

    // Persist payment success before attempting stock work.
    sheet.getRange(orderRow, 14, 1, 2).setValues([[razorpayPaymentId, "PAID"]]);
    SpreadsheetApp.flush();

    if (stockStatus === "TRUE") {
      return {
        success: true, paymentVerified: true, stockDeducted: true,
        orderId: orderId, orderStatus: "PAID",
        message: "Payment successful. Your VMOOD order is confirmed."
      };
    }

    const databaseId = sku.startsWith("MP") ? VMOOD_DATABASES.MEN : VMOOD_DATABASES.WOMEN;
    const product = getProduct(databaseId, sku);
    if (!product) {
      sheet.getRange(orderRow, 16).setValue("REVIEW_REQUIRED");
      SpreadsheetApp.flush();
      return vmoodStockReviewResponse_(orderId, "Product details need a manual stock check.");
    }

    const currentOption = Object.keys(product.variants || {}).find(function(key) {
      return key.trim().toUpperCase() === option.toUpperCase();
    });
    if (!currentOption) {
      sheet.getRange(orderRow, 16).setValue("REVIEW_REQUIRED");
      SpreadsheetApp.flush();
      return vmoodStockReviewResponse_(orderId, "The selected option needs a manual stock check.");
    }

    const stockState = getVmoodVariantStockState_(databaseId, sku, currentOption);

    // A matching marker proves that this payment's stock change already happened.
    if (stockState.lastPaymentId === razorpayPaymentId) {
      sheet.getRange(orderRow, 16).setValue(true);
      SpreadsheetApp.flush();
      return {
        success: true, paymentVerified: true, stockDeducted: true,
        orderId: orderId, orderStatus: "PAID",
        message: "Payment verified. Stock update was already completed."
      };
    }

    // Do not let a second payment alter this variant while an earlier deduction is unresolved.
    const lastRow = sheet.getLastRow();
    const allRows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 16).getValues() : [];
    for (let i = 0; i < allRows.length; i++) {
      const other = allRows[i];
      if (i + 2 === orderRow) continue;
      if (String(other[2] || "").trim().toUpperCase() === sku &&
          String(other[4] || "").trim().toUpperCase() === currentOption.toUpperCase() &&
          String(other[15] || "").trim().toUpperCase() === "PROCESSING") {
        sheet.getRange(orderRow, 16).setValue("REVIEW_REQUIRED");
        SpreadsheetApp.flush();
        return vmoodStockReviewResponse_(orderId, "Another stock update for this option is being reconciled.");
      }
    }

    if (stockState.stock < quantity) {
      sheet.getRange(orderRow, 16).setValue("REVIEW_REQUIRED");
      SpreadsheetApp.flush();
      return vmoodStockReviewResponse_(orderId, "Payment received, but available stock needs a manual check.");
    }

    // Mark PROCESSING before stock is changed. A retry checks the payment marker first.
    sheet.getRange(orderRow, 16).setValue("PROCESSING");
    SpreadsheetApp.flush();
    try {
      deductVmoodStockOnce_(databaseId, sku, currentOption, quantity, razorpayPaymentId);
      sheet.getRange(orderRow, 16).setValue(true);
      SpreadsheetApp.flush();
    } catch (stockError) {
      sheet.getRange(orderRow, 16).setValue("REVIEW_REQUIRED");
      SpreadsheetApp.flush();
      return vmoodStockReviewResponse_(orderId, "Payment received. Stock update needs reconciliation.");
    }

    return {
      success: true, paymentVerified: true, stockDeducted: true,
      orderId: orderId, orderStatus: "PAID",
      message: "Payment successful. Your VMOOD order is confirmed."
    };
  } finally {
    lock.releaseLock();
  }
}

function vmoodStockReviewResponse_(orderId, detail) {
  return {
    success: true,
    paymentVerified: true,
    stockDeducted: false,
    orderId: orderId,
    orderStatus: "PAID",
    message: "Payment received. " + detail + " VMOOD will resolve the order. Do not pay again."
  };
}

function vmoodConstantTimeCompare_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
