// ==========================================
// VMOOD ORDER TRACKING MODULE
// Read-only customer order lookup
// Part of the same VMOOD API – Production Apps Script project
// ==========================================

function trackVmoodOrder_(body) {

  const orderId = String(body.orderId || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "");

  if (!orderId || orderId.length > 50) {
    throw new Error("Please enter a valid order ID");
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new Error("Please enter a valid 10-digit mobile number");
  }

  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("ORDERS_SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("Orders spreadsheet ID missing");
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName("ORDERS");

  if (!sheet || sheet.getLastColumn() < 17) {
    throw new Error("ORDERS sheet is missing or incomplete");
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      success: false,
      message: "No matching order found. Check your order ID and mobile number."
    };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  let matchedOrder = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const savedOrderId = String(row[1] || "").trim();
    const savedPhone = String(row[9] || "").replace(/\D/g, "");

    if (savedOrderId === orderId && savedPhone === phone) {
      matchedOrder = row;
      break;
    }
  }

  if (!matchedOrder || String(matchedOrder[14] || "").trim().toUpperCase() !== "PAID") {
    return {
      success: false,
      message: "No matching order found. Check your order ID and mobile number."
    };
  }

  const deliveryStatus = String(matchedOrder[16] || "PROCESSING")
    .trim()
    .toUpperCase();

  const allowedDeliveryStatuses = ["PROCESSING", "SHIPPED", "DELIVERED"];
  const razorpayOrderId = String(matchedOrder[12] || "").trim();
  const stockDeducted = matchedOrder[15] === true ||
    String(matchedOrder[15]).trim().toUpperCase() === "TRUE";

  let paymentMessage = "Payment verified successfully.";
  if (!stockDeducted && razorpayOrderId) {
    const reservationsSheet = getVmoodReservationsSheet_();
    const reservationRow = findVmoodReservationRow_(
      reservationsSheet,
      razorpayOrderId
    );

    if (reservationRow) {
      const reservationStatus = String(
        reservationsSheet.getRange(reservationRow, 14).getDisplayValue()
      ).trim().toUpperCase();

      if (reservationStatus === "REVIEW_REQUIRED") {
        paymentMessage =
          "Payment received. This order requires manual review. Do not pay again.";
      } else if (reservationStatus === "PROCESSING") {
        paymentMessage =
          "Payment received. Your order confirmation is being completed. Do not pay again.";
      }
    }
  }

  return {
    success: true,
    order: {
      orderId: String(matchedOrder[1]),
      productName: String(matchedOrder[3] || ""),
      size: String(matchedOrder[4] || ""),
      paymentStatus: "PAID",
      orderStatus: "PAID",
      deliveryStatus: allowedDeliveryStatuses.includes(deliveryStatus)
        ? deliveryStatus
        : "PROCESSING",
      paymentMessage: paymentMessage
    }
  };
}
