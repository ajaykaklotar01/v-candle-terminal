// ==========================================
// VMOOD PAYMENT VERIFICATION + STOCK UPDATE
// Create the Google Sheets order only after captured payment.
// ==========================================

function vmoodRazorpayGet_(path, keyId, keySecret) {
  const response = UrlFetchApp.fetch("https://api.razorpay.com/v1/" + path, {
    method: "get",
    headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error("Unable to verify payment with Razorpay. Please do not pay again.");
  }
  return JSON.parse(response.getContentText());
}

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

  const payment = vmoodRazorpayGet_("payments/" + encodeURIComponent(razorpayPaymentId), keyId, keySecret);
  const razorpayOrder = vmoodRazorpayGet_("orders/" + encodeURIComponent(razorpayOrderId), keyId, keySecret);

  if (payment.id !== razorpayPaymentId || payment.order_id !== razorpayOrderId) {
    throw new Error("Razorpay payment details do not match this order");
  }
  if (payment.status !== "captured") {
    throw new Error("Payment is not captured yet. Do not pay again; contact VMOOD if money was deducted.");
  }
  if (payment.currency !== "INR" || razorpayOrder.currency !== "INR" ||
      Number(payment.amount) !== Number(razorpayOrder.amount)) {
    throw new Error("Payment amount or currency does not match the Razorpay order");
  }

  const notes = razorpayOrder.notes || {};
  const sku = String(notes.sku || "").trim().toUpperCase();
  const option = String(notes.option || "").trim();
  const quantity = Number(notes.quantity);
  const unitPrice = Number(notes.unit_price);
  const totalAmount = Number(razorpayOrder.amount) / 100;
  const customerName = String(notes.customer_name || "").trim();
  const phone = String(notes.phone || "").trim();
  const fullAddress = [
    String(notes.street_1 || "").trim(),
    String(notes.street_2 || "").trim(),
    String(notes.city || "").trim(),
    String(notes.state || "").trim(),
    String(notes.pincode || "").trim()
  ].filter(Boolean).join(", ");
  const productName = String(notes.product_name || "").trim();

  if (!/^(MP|WP)[A-Z0-9_-]+$/.test(sku) || !option ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 ||
      !Number.isFinite(unitPrice) || unitPrice <= 0 ||
      Math.round(unitPrice * quantity * 100) !== Number(razorpayOrder.amount) ||
      customerName.length < 3 || !/^[6-9]\d{9}$/.test(phone) ||
      !fullAddress || !productName) {
    throw new Error("The verified Razorpay order is missing valid VMOOD order details. Contact VMOOD; do not pay again.");
  }

  const databaseId = sku.startsWith("MP") ? VMOOD_DATABASES.MEN : VMOOD_DATABASES.WOMEN;
  const product = getProduct(databaseId, sku);
  if (!product) throw new Error("Product details could not be found. Contact VMOOD; do not pay again.");
  const currentOption = Object.keys(product.variants || {}).find(function(key) {
    return key.trim().toUpperCase() === option.toUpperCase();
  });
  if (!currentOption) throw new Error("Selected product option could not be found. Contact VMOOD; do not pay again.");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getVmoodOrdersSheet_();
    let orderRow = findVmoodOrderRow_(sheet, razorpayOrderId);
    let orderId;

    if (orderRow) {
      const saved = sheet.getRange(orderRow, 1, 1, 16).getValues()[0];
      if (String(saved[13] || "").trim() !== razorpayPaymentId) {
        throw new Error("A different payment is already linked to this Razorpay order.");
      }
      orderId = String(saved[1] || "");
      if (String(saved[15]).trim().toUpperCase() === "TRUE") {
        return {
          success: true, paymentVerified: true, stockDeducted: true,
          orderId: orderId, orderStatus: "PAID",
          message: "Payment successful. Your VMOOD order is confirmed."
        };
      }
    } else {
      orderId = "VMOOD-" + Date.now() + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();
      sheet.appendRow([
        new Date(), orderId, sku, productName, currentOption, quantity,
        unitPrice, totalAmount, customerName, phone, fullAddress,
        "PROCESSING", razorpayOrderId, razorpayPaymentId, "PAID", "PROCESSING"
      ]);
      SpreadsheetApp.flush();
      orderRow = sheet.getLastRow();
    }

    // The permanent ledger makes each Razorpay payment idempotent.
    // An unresolved payment blocks later deductions for the same SKU + option.
    const ledgerResult = processVmoodStockLedger_(
      databaseId, sku, currentOption, quantity, razorpayPaymentId, razorpayOrderId
    );

    if (!ledgerResult.success || ledgerResult.reviewRequired) {
      sheet.getRange(orderRow, 16).setValue("REVIEW_REQUIRED");
      SpreadsheetApp.flush();
      return vmoodStockReviewResponse_(orderId,
        "Payment was received, but the stock update needs reconciliation. VMOOD will resolve it. Do not pay again.");
    }

    sheet.getRange(orderRow, 16).setValue(true);
    SpreadsheetApp.flush();

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
    message: detail + " VMOOD will resolve the order. Do not pay again."
  };
}

function vmoodConstantTimeCompare_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
