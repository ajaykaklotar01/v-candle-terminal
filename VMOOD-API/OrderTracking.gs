// ==========================================
// VMOOD ORDER TRACKING
// Reads the ORDERS sheet only
// ==========================================

function trackVmoodOrder_(body) {
  const orderId = String(body.orderId || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "");
  if (!orderId || orderId.length > 60) throw new Error("Please enter a valid order ID");
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Please enter a valid 10-digit mobile number");

  const sheet = getVmoodOrdersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { success: false, message: "No matching order found. Check your order ID and mobile number." };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  let matched = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[1] || "").trim() === orderId &&
        String(row[9] || "").replace(/\D/g, "") === phone) {
      matched = row;
      break;
    }
  }

  if (!matched || String(matched[14] || "").trim().toUpperCase() !== "PAID") {
    return {
      success: false,
      message: "No paid order found. If money was deducted, contact VMOOD before trying payment again."
    };
  }

  const delivery = String(matched[11] || "PROCESSING").trim().toUpperCase();
  const allowed = ["PROCESSING", "SHIPPED", "DELIVERED"];
  const stockStatus = String(matched[15] || "").trim().toUpperCase();
  let paymentMessage = "Payment verified and stock updated successfully.";

  if (stockStatus !== "TRUE") {
    paymentMessage = stockStatus === "PROCESSING"
      ? "Payment received. Your stock update is being completed. Do not pay again."
      : "Payment received. Your order is being reconciled by VMOOD. Do not pay again.";
  }

  return {
    success: true,
    order: {
      orderId: String(matched[1]),
      productName: String(matched[3] || ""),
      option: String(matched[4] || ""),
      size: String(matched[4] || ""),
      paymentStatus: "PAID",
      orderStatus: "PAID",
      deliveryStatus: allowed.indexOf(delivery) !== -1 ? delivery : "PROCESSING",
      paymentMessage: paymentMessage
    }
  };
}
