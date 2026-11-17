// ==========================================
// VMOOD PAYMENT VERIFICATION + ORDER FINALIZATION
// Razorpay verification + paid order + stock handling
// ==========================================

function verifyVmoodPayment_(body) {

  const razorpayOrderId = String(
    body.razorpay_order_id || ""
  ).trim();

  const razorpayPaymentId = String(
    body.razorpay_payment_id || ""
  ).trim();

  const razorpaySignature = String(
    body.razorpay_signature || ""
  ).trim();

  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    throw new Error("Payment verification details missing");
  }

  const props = PropertiesService.getScriptProperties();

  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

  if (!keyId || !keySecret) {
    throw new Error("Razorpay configuration missing");
  }

  // --------------------------------------
  // 1. VERIFY RAZORPAY SIGNATURE
  // --------------------------------------

  const signatureMessage =
    razorpayOrderId + "|" + razorpayPaymentId;

  const expectedSignature = Utilities
    .computeHmacSha256Signature(
      signatureMessage,
      keySecret
    )
    .map(function(byte) {
      return ("0" + ((byte + 256) % 256).toString(16))
        .slice(-2);
    })
    .join("");

  if (
    !vmoodConstantTimeCompare_(
      expectedSignature,
      razorpaySignature.toLowerCase()
    )
  ) {
    throw new Error("Invalid Razorpay payment signature");
  }

  // --------------------------------------
  // 2. VERIFY PAYMENT DIRECTLY WITH RAZORPAY
  // --------------------------------------

  const paymentResponse = UrlFetchApp.fetch(
    "https://api.razorpay.com/v1/payments/" +
      encodeURIComponent(razorpayPaymentId),
    {
      method: "get",
      headers: {
        Authorization: "Basic " +
          Utilities.base64Encode(keyId + ":" + keySecret)
      },
      muteHttpExceptions: true
    }
  );

  if (paymentResponse.getResponseCode() !== 200) {
    throw new Error("Unable to verify payment with Razorpay");
  }

  const payment = JSON.parse(
    paymentResponse.getContentText()
  );

  if (payment.id !== razorpayPaymentId) {
    throw new Error("Payment ID mismatch");
  }

  if (payment.order_id !== razorpayOrderId) {
    throw new Error("Razorpay order ID mismatch");
  }

  if (payment.status !== "captured") {
    throw new Error(
      "Payment is not captured. Current status: " +
      payment.status
    );
  }

  if (payment.currency !== "INR") {
    throw new Error("Invalid payment currency");
  }

  // --------------------------------------
  // 3. LOCK PAYMENT PROCESSING
  // --------------------------------------

  const lock = LockService.getScriptLock();

  lock.waitLock(20000);

  try {

    const reservationsSheet =
      getVmoodReservationsSheet_();

    const reservationRow =
      findVmoodReservationRow_(
        reservationsSheet,
        razorpayOrderId
      );

    if (!reservationRow) {
      throw new Error("Reservation not found");
    }

    const reservation = reservationsSheet
      .getRange(
        reservationRow,
        1,
        1,
        VMOOD_RESERVATION_HEADERS.length
      )
      .getValues()[0];

    const sku = String(reservation[1] || "")
      .trim()
      .toUpperCase();

    const productName = String(reservation[2] || "");
    const size = String(reservation[3] || "").trim();
    const quantity = Number(reservation[4]);
    const unitPrice = Number(reservation[5]);
    const expectedAmount = Number(reservation[6]);

    const customerName = String(reservation[7] || "");
    const phone = String(reservation[8] || "");
    const email = String(reservation[9] || "");
    const fullAddress = String(reservation[10] || "");

    const reservationStatus = String(
      reservation[13] || ""
    ).trim().toUpperCase();

    const storedPaymentId = String(
      reservation[14] || ""
    ).trim();

    if (
      !/^(MP|WP)[A-Z0-9_-]+$/.test(sku) ||
      !size ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 20 ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
    ) {
      throw new Error("Invalid reservation details");
    }

    if (
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount <= 0 ||
      payment.amount !== expectedAmount
    ) {
      throw new Error("Payment amount does not match order");
    }

    if (
      Math.round(unitPrice * quantity * 100) !==
      expectedAmount
    ) {
      throw new Error("Reservation amount mismatch");
    }

    if (
      !customerName ||
      !phone ||
      !fullAddress
    ) {
      throw new Error("Customer details missing from reservation");
    }

    if (
      storedPaymentId &&
      storedPaymentId !== razorpayPaymentId
    ) {
      throw new Error(
        "A different payment is already linked to this reservation"
      );
    }

    // --------------------------------------
    // 4. OPEN ORDERS SHEET
    // --------------------------------------

    const ordersSpreadsheetId =
      props.getProperty("ORDERS_SPREADSHEET_ID");

    if (!ordersSpreadsheetId) {
      throw new Error("Orders spreadsheet ID missing");
    }

    const ordersSS = SpreadsheetApp.openById(
      ordersSpreadsheetId
    );

    const ordersSheet = ordersSS.getSheetByName("ORDERS");

    if (
      !ordersSheet ||
      ordersSheet.getLastColumn() < 16
    ) {
      throw new Error("ORDERS sheet is missing or incomplete");
    }

    let orderRow = findVmoodOrderRow_(
      ordersSheet,
      razorpayOrderId
    );

    let existingOrder = null;

    if (orderRow) {
      existingOrder = ordersSheet
        .getRange(orderRow, 1, 1, 16)
        .getValues()[0];

      const existingPaymentId = String(
        existingOrder[13] || ""
      );

      if (
        existingPaymentId &&
        existingPaymentId !== razorpayPaymentId
      ) {
        throw new Error(
          "A different payment is already linked to this order"
        );
      }
    }

    // --------------------------------------
    // 5. REPAIR ALREADY CONFIRMED ORDER
    // --------------------------------------

    if (
      existingOrder &&
      String(existingOrder[13]) === razorpayPaymentId &&
      String(existingOrder[15]).toUpperCase() === "TRUE"
    ) {

      // Repair reservation if the previous execution
      // stopped before updating its final status.

      reservationsSheet.getRange(reservationRow, 14)
        .setValue("PAID");

      reservationsSheet.getRange(reservationRow, 15)
        .setValue(razorpayPaymentId);

      SpreadsheetApp.flush();

      return {
        success: true,
        paymentVerified: true,
        orderId: existingOrder[1],
        orderStatus: "PAID",
        message: "Payment already verified and order confirmed"
      };
    }

    // --------------------------------------
    // 6. HANDLE CANCELLED / EXPIRED /
    //    MANUAL REVIEW RESERVATIONS
    // --------------------------------------

    const expiryTime = new Date(
      reservation[12]
    ).getTime();

    const reservationExpired =
      Number.isFinite(expiryTime) &&
      expiryTime <= Date.now();

    if (
      reservationStatus === "CANCELLED" ||
      reservationStatus === "EXPIRED" ||
      reservationStatus === "REVIEW_REQUIRED" ||
      (
        reservationStatus === "PENDING" &&
        reservationExpired
      )
    ) {

      const reviewOrderId = saveVmoodVerifiedOrder_({
        ordersSheet: ordersSheet,
        orderRow: orderRow,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        sku: sku,
        productName: productName,
        size: size,
        quantity: quantity,
        unitPrice: unitPrice,
        amount: expectedAmount,
        customerName: customerName,
        phone: phone,
        email: email,
        fullAddress: fullAddress,
        orderStatus: "PAID",
        stockDeducted: false
      });

      reservationsSheet.getRange(reservationRow, 14)
        .setValue("REVIEW_REQUIRED");

      reservationsSheet.getRange(reservationRow, 15)
        .setValue(razorpayPaymentId);

      SpreadsheetApp.flush();

      return {
        success: true,
        paymentVerified: true,
        orderId: reviewOrderId,
        orderStatus: "PAID",
        message:
          "Payment received. This order requires manual review. Do not pay again."
      };
    }

    // --------------------------------------
    // 7. SELECT PRODUCT DATABASE
    // --------------------------------------

    const databaseId = sku.startsWith("MP")
      ? VMOOD_DATABASES.MEN
      : VMOOD_DATABASES.WOMEN;

    const product = getProduct(databaseId, sku);

    if (!product) {
      throw new Error("Product no longer exists");
    }

    const currentOption = Object.keys(
      product.variants || {}
    ).find(function(option) {
      return option.toUpperCase() === size.toUpperCase();
    });

    if (!currentOption) {
      throw new Error("Product option no longer exists");
    }

    // --------------------------------------
    // 8. CHECK STOCK DEDUCTION RECOVERY MARKER
    // --------------------------------------

    const stockState = getVmoodVariantStockState_(
      databaseId,
      sku,
      currentOption
    );

    const markerAlreadyMatches =
      stockState.lastPaymentId === razorpayPaymentId;

    const orderAlreadyMarkedDeducted =
      existingOrder &&
      String(existingOrder[15]).toUpperCase() === "TRUE";

    // If the marker or saved order confirms that stock
    // was already deducted, never deduct it again.

    const stockAlreadyDeducted =
      markerAlreadyMatches || orderAlreadyMarkedDeducted;

    // --------------------------------------
    // 9. PREVENT ANOTHER UNFINISHED
    //    DEDUCTION FOR SAME VARIANT
    // --------------------------------------

    const lastReservationRow =
      reservationsSheet.getLastRow();

    const allReservations = lastReservationRow >= 2
      ? reservationsSheet.getRange(
          2,
          1,
          lastReservationRow - 1,
          VMOOD_RESERVATION_HEADERS.length
        ).getValues()
      : [];

    for (let i = 0; i < allReservations.length; i++) {

      const other = allReservations[i];

      const otherOrderId = String(other[0] || "");
      const otherSku = String(other[1] || "")
        .trim()
        .toUpperCase();
      const otherOption = String(other[3] || "")
        .trim()
        .toUpperCase();
      const otherStatus = String(other[13] || "")
        .trim()
        .toUpperCase();

      if (
        otherOrderId !== razorpayOrderId &&
        otherSku === sku &&
        otherOption === currentOption.toUpperCase &&
        otherStatus === "PROCESSING"
      ) {
        throw new Error(
          "Another payment is being processed for this size. Retry shortly."
        );
      }
    }

    // --------------------------------------
    // 10. CHECK OTHER ACTIVE RESERVATIONS
    // --------------------------------------

    let otherReserved = 0;

    const now = Date.now();

    for (let i = 0; i < allReservations.length; i++) {

      const other = allReservations[i];

      if (
        String(other[0]) === razorpayOrderId ||
        String(other[1] || "").trim().toUpperCase() !== sku ||
        String(other[3] || "").trim().toUpperCase() !==
          currentOption.toUpperCase() ||
        String(other[13] || "").trim().toUpperCase() !== "PENDING"
      ) {
        continue;
      }

      const otherExpiry = new Date(other[12]).getTime();

      if (
        Number.isFinite(otherExpiry) &&
        otherExpiry > now
      ) {
        otherReserved += Number(other[4]) || 0;
      } else {
        // Expired pending reservations no longer reserve stock.
        const sheetRow = i + 2;

        reservationsSheet.getRange(sheetRow, 14)
          .setValue("EXPIRED");
      }
    }

    // --------------------------------------
    // 11. CHECK STOCK ONLY IF NOT ALREADY
    //     DEDUCTED
    // --------------------------------------

    if (!stockAlreadyDeducted) {

      if (
        stockState.stock - otherReserved < quantity
      ) {

        const reviewOrderId = saveVmoodVerifiedOrder_({
          ordersSheet: ordersSheet,
          orderRow: orderRow,
          razorpayOrderId: razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId,
          sku: sku,
          productName: productName,
          size: size,
          quantity: quantity,
          unitPrice: unitPrice,
          amount: expectedAmount,
          customerName: customerName,
          phone: phone,
          email: email,
          fullAddress: fullAddress,
          orderStatus: "PAID",
          stockDeducted: false
        });

        reservationsSheet.getRange(reservationRow, 14)
          .setValue("REVIEW_REQUIRED");

        reservationsSheet.getRange(reservationRow, 15)
          .setValue(razorpayPaymentId);

        SpreadsheetApp.flush();

        return {
          success: true,
          paymentVerified: true,
          orderId: reviewOrderId,
          orderStatus: "PAID",
          message:
            "Payment received. Stock requires manual review. Do not pay again."
        };
      }
    }

    // --------------------------------------
    // 12. MARK RESERVATION PROCESSING
    // --------------------------------------

    reservationsSheet.getRange(reservationRow, 14)
      .setValue("PROCESSING");

    reservationsSheet.getRange(reservationRow, 15)
      .setValue(razorpayPaymentId);

    SpreadsheetApp.flush();

    // --------------------------------------
    // 13. SAVE PAID ORDER BEFORE STOCK UPDATE
    // --------------------------------------

    const orderId = saveVmoodVerifiedOrder_({
      ordersSheet: ordersSheet,
      orderRow: orderRow,
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
      sku: sku,
      productName: productName,
      size: currentOption,
      quantity: quantity,
      unitPrice: unitPrice,
      amount: expectedAmount,
      customerName: customerName,
      phone: phone,
      email: email,
      fullAddress: fullAddress,
      orderStatus: "PAID",
      stockDeducted: stockAlreadyDeducted
    });

    // --------------------------------------
    // 14. DEDUCT STOCK ONLY IF NEEDED
    // --------------------------------------

    if (!stockAlreadyDeducted) {

      deductVmoodStockOnce_(
        databaseId,
        sku,
        currentOption,
        quantity,
        razorpayPaymentId
      );
    }

    // --------------------------------------
    // 15. CONFIRM ORDER
    // --------------------------------------

    orderRow = findVmoodOrderRow_(
      ordersSheet,
      razorpayOrderId
    );

    if (!orderRow) {
      throw new Error("Saved order could not be found");
    }

    ordersSheet.getRange(orderRow, 16)
      .setValue(true);

    SpreadsheetApp.flush();

    // --------------------------------------
    // 16. FINALIZE RESERVATION
    // --------------------------------------

    reservationsSheet.getRange(reservationRow, 14)
      .setValue("PAID");

    reservationsSheet.getRange(reservationRow, 15)
      .setValue(razorpayPaymentId);

    SpreadsheetApp.flush();

    return {
      success: true,
      paymentVerified: true,
      orderId: orderId,
      orderStatus: "PAID",
      message: "Payment successful. VMOOD order confirmed."
    };

  } finally {

    lock.releaseLock();

  }
}

function vmoodConstantTimeCompare_(a, b) {

  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    a.length !== b.length
  ) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}

function findVmoodOrderRow_(sheet, razorpayOrderId) {

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const ids = sheet.getRange(2, 13, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === razorpayOrderId) {
      return i + 2;
    }
  }

  return null;
}

function saveVmoodVerifiedOrder_(data) {
  const existingRow = findVmoodOrderRow_(
    data.ordersSheet,
    data.razorpayOrderId
  );

  let orderId;
  let createdAt;
  let deliveryStatus = "PROCESSING";

  if (existingRow) {
    const existing = data.ordersSheet
      .getRange(existingRow, 1, 1, 16)
      .getValues()[0];

    orderId = existing[1] || "VMOOD-" + Date.now();
    createdAt = existing[0] || new Date();

    const previousStatus = String(
      existing[11] || ""
    ).trim().toUpperCase();

    if (["PROCESSING", "SHIPPED", "DELIVERED"].includes(previousStatus)) {
      deliveryStatus = previousStatus;
    }
  } else {
    orderId = "VMOOD-" + Date.now();
    createdAt = new Date();
  }

  const rowData = [
    createdAt,
    orderId,
    data.sku,
    data.productName,
    data.size,
    data.quantity,
    data.unitPrice,
    data.amount / 100,
    data.customerName,
    data.phone,
    data.fullAddress,
    deliveryStatus,
    data.razorpayOrderId,
    data.razorpayPaymentId,
    "PAID",
    data.stockDeducted
  ];

  if (existingRow) {
    data.ordersSheet
      .getRange(existingRow, 1, 1, 16)
      .setValues([rowData]);
  } else {
    data.ordersSheet.appendRow(rowData);
  }

  SpreadsheetApp.flush();

  return orderId;
}

function getVmoodVariantStockState_(
  databaseId,
  sku,
  option
) {

  const ss = SpreadsheetApp.openById(databaseId);
  const sheet = ss.getSheetByName("VARIANTS");

  if (!sheet) {
    throw new Error("VARIANTS sheet not found");
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error("No product variants found");
  }

  // Column F stores the last deduction payment ID.
  const markerHeader = String(
    sheet.getRange(1, 6).getValue()
  ).trim();

  if (markerHeader === "") {

    sheet.getRange(1, 6)
      .setValue("Last Deduction Payment ID");

  } else if (
    markerHeader !== "Last Deduction Payment ID"
  ) {

    throw new Error(
      "VARIANTS column F is already used"
    );

  }

  const headers = sheet.getRange(1, 1, 1, 5)
    .getValues()[0]
    .map(value => String(value).trim().toUpperCase());

  const skuColumn = headers.indexOf("SKU");
  const optionColumn = headers.indexOf("OPTION");
  const stockColumn = headers.indexOf("STOCK");

  if (
    skuColumn < 0 ||
    optionColumn < 0 ||
    stockColumn !== 4
  ) {
    throw new Error(
      "VARIANTS headers are incorrect. STOCK must be column E."
    );
  }

  const rows = sheet.getRange(
    2,
    1,
    lastRow - 1,
    6
  ).getValues();

  let variantRow = null;
  let stock = 0;
  let lastPaymentId = "";

  for (let i = 0; i < rows.length; i++) {

    const rowSku = String(
      rows[i][skuColumn] || ""
    ).trim().toUpperCase();

    const rowOption = String(
      rows[i][optionColumn] || ""
    ).trim().toUpperCase();

    if (
      rowSku === sku.toUpperCase() &&
      rowOption === option.toUpperCase()
    ) {

      if (variantRow !== null) {
        throw new Error(
          "Duplicate product variant found"
        );
      }

      variantRow = i + 2;
      stock = Number(rows[i][stockColumn]);

      lastPaymentId = String(
        rows[i][5] || ""
      ).trim();

    }

  }

  if (variantRow === null) {
    throw new Error("Product variant not found");
  }

  if (
    !Number.isSafeInteger(stock) ||
    stock < 0
  ) {
    throw new Error("Invalid variant stock");
  }

  return {
    sheet: sheet,
    row: variantRow,
    stock: stock,
    lastPaymentId: lastPaymentId
  };

}

function deductVmoodStockOnce_(
  databaseId,
  sku,
  option,
  quantity,
  paymentId
) {

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error("Invalid stock deduction quantity");
  }

  if (!paymentId) {
    throw new Error("Payment ID missing");
  }

  const state = getVmoodVariantStockState_(
    databaseId,
    sku,
    option
  );

  // Prevent the same payment from deducting twice.
  if (state.lastPaymentId === paymentId) {
    return {
      success: true,
      alreadyDeducted: true
    };
  }

  if (state.stock < quantity) {
    throw new Error("Insufficient stock for deduction");
  }

  // Update stock and payment marker together.
  state.sheet.getRange(
    state.row,
    5,
    1,
    2
  ).setValues([[
    state.stock - quantity,
    paymentId
  ]]);

  SpreadsheetApp.flush();

  return {
    success: true,
    alreadyDeducted: false
  };

}
