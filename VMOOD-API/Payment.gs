// ==========================================
// VMOOD PAYMENT SYSTEM
// Razorpay + reservations + stock
// ==========================================

const VMOOD_RESERVATION_HEADERS = [
  "Razorpay Order ID",
  "SKU",
  "Product Name",
  "Option",
  "Quantity",
  "Unit Price",
  "Amount Paise",
  "Customer Name",
  "Phone",
  "Email",
  "Full Address",
  "Created At",
  "Expires At",
  "Reservation Status",
  "Razorpay Payment ID"
];

function testVmoodRazorpayConnection() {
  const props = PropertiesService.getScriptProperties();

  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are missing.");
  }

  const url = "https://api.razorpay.com/v1/orders";

  const payload = {
    amount: 100,
    currency: "INR",
    receipt: "VMOOD_TEST_" + Date.now(),
    notes: {
      purpose: "VMOOD backend connection test"
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Basic " +
        Utilities.base64Encode(keyId + ":" + keySecret)
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(
      "Razorpay test failed: " +
      (result.error ? result.error.description : response.getContentText())
    );
  }

  Logger.log("RAZORPAY CONNECTION SUCCESSFUL");
  Logger.log("Test Order ID: " + result.id);
  Logger.log("Currency: " + result.currency);
  Logger.log("Amount: " + result.amount);
  Logger.log("Status: " + result.status);
}

function getVmoodReservationsSheet_() {

  const props = PropertiesService.getScriptProperties();

  const spreadsheetId = props.getProperty(
    "ORDERS_SPREADSHEET_ID"
  );

  if (!spreadsheetId) {
    throw new Error("Orders spreadsheet ID missing");
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);

  let sheet = ss.getSheetByName("RESERVATIONS");

  if (!sheet) {
    sheet = ss.insertSheet("RESERVATIONS");
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(
      1,
      1,
      1,
      VMOOD_RESERVATION_HEADERS.length
    ).setValues([VMOOD_RESERVATION_HEADERS]);

    sheet.setFrozenRows(1);

  } else {

    const existingHeaders = sheet.getRange(
      1,
      1,
      1,
      VMOOD_RESERVATION_HEADERS.length
    ).getValues()[0];

    for (let i = 0; i < VMOOD_RESERVATION_HEADERS.length; i++) {
      if (
        String(existingHeaders[i]).trim() !==
        VMOOD_RESERVATION_HEADERS[i]
      ) {
        throw new Error(
          "RESERVATIONS sheet header mismatch at column " +
          (i + 1)
        );
      }
    }
  }

  return sheet;
}

function createVmoodRazorpayOrder_(body) {

  const sku = String(body.sku || "")
    .trim()
    .toUpperCase();

  const size = String(body.option || body.size || "").trim();

  const quantity = Number(body.quantity);

  // --------------------------------------
  // 1. BASIC VALIDATION
  // --------------------------------------

  if (!/^(MP|WP)[A-Z0-9_-]+$/.test(sku)) {
    throw new Error("Invalid product SKU");
  }

  if (!size || size.length > 20) {
    throw new Error("Invalid product option");
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  ) {
    throw new Error("Quantity must be between 1 and 20");
  }

  // --------------------------------------
  // 2. CUSTOMER DETAILS VALIDATION
  // --------------------------------------

  const customerName = String(
    body.customerName || body.name || ""
  ).trim();

  const phone = String(body.phone || "")
    .replace(/\s+/g, "");

  const email = String(body.email || "")
    .trim();

  const street = String(
    body.street || body.address || ""
  ).trim();

  const city = String(body.city || "").trim();

  const state = String(body.state || "").trim();

  const pincode = String(body.pincode || "")
    .trim();

  if (customerName.length < 3 || customerName.length > 100) {
    throw new Error("Please enter a valid customer name");
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new Error("Please enter a valid Indian mobile number");
  }

  if (
    email &&
    (
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
  ) {
    throw new Error("Please enter a valid email address");
  }

  if (street.length < 10 || street.length > 300) {
    throw new Error("Please enter a valid delivery address");
  }

  if (city.length < 2 || city.length > 80) {
    throw new Error("Please enter a valid city");
  }

  if (state.length < 2 || state.length > 80) {
    throw new Error("Please enter a valid state");
  }

  if (!/^\d{6}$/.test(pincode)) {
    throw new Error("Please enter a valid 6-digit pincode");
  }

  const fullAddress = [
    street,
    city,
    state,
    pincode
  ].join(", ");

  // --------------------------------------
  // 3. DATABASE SELECTION
  // --------------------------------------

  const databaseId = sku.startsWith("MP")
    ? VMOOD_DATABASES.MEN
    : VMOOD_DATABASES.WOMEN;

  // --------------------------------------
  // 4. RAZORPAY CONFIGURATION
  // --------------------------------------

  const props = PropertiesService.getScriptProperties();

  const keyId = props.getProperty("RAZORPAY_KEY_ID");

  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

  if (!keyId || !keySecret) {
    throw new Error("Razorpay configuration missing");
  }

  // --------------------------------------
  // 5. LOCK TO PREVENT SIMULTANEOUS
  //    RESERVATION CONFLICTS
  // --------------------------------------

  const lock = LockService.getScriptLock();

  lock.waitLock(20000);

  try {

    // Fetch fresh product data while holding lock
    const product = getProduct(databaseId, sku);

    if (!product) {
      throw new Error("Product not found");
    }

    const option = Object.keys(
      product.variants || {}
    ).find(
      key =>
        key.trim().toUpperCase() === size.toUpperCase()
    );

    if (!option) {
      throw new Error("Selected size is unavailable");
    }

    const variant = product.variants[option];

    const stock = Number(variant.stock);

    const unitPrice = Number(variant.newPrice);

    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new Error("Invalid product stock");
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error("Invalid product price");
    }

    if (stock < 1) {
      throw new Error("This size is out of stock");
    }

    const amount = Math.round(
      unitPrice * quantity * 100
    );

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new Error("Invalid order amount");
    }

    // --------------------------------------
    // 6. CHECK ACTIVE RESERVATIONS
    // --------------------------------------

    const sheet = getVmoodReservationsSheet_();

    const lastRow = sheet.getLastRow();

    const now = Date.now();

    let reservedQuantity = 0;

    if (lastRow >= 2) {

      const rows = sheet.getRange(
        2,
        1,
        lastRow - 1,
        VMOOD_RESERVATION_HEADERS.length
      ).getValues();

      rows.forEach((row, index) => {

        const rowSku = String(row[1] || "").trim();

        const rowOption = String(row[3] || "").trim();

        const rowQuantity = Number(row[4]);

        const expiresAt = new Date(row[12]).getTime();

        const reservationStatus = String(
          row[13] || ""
        ).trim().toUpperCase();

        if (
          reservationStatus === "PROCESSING" &&
          rowSku === sku &&
          rowOption.toUpperCase() === option.toUpperCase()
        ) {

          // Keep stock reserved while a captured payment is being finalized.
          reservedQuantity += rowQuantity;

        } else if (
          reservationStatus === "PENDING" &&
          Number.isFinite(expiresAt) &&
          expiresAt <= now
        ) {

          // Mark expired reservation
          sheet.getRange(index + 2, 14)
            .setValue("EXPIRED");

        } else if (
          reservationStatus === "PENDING" &&
          Number.isFinite(expiresAt) &&
          expiresAt > now &&
          rowSku === sku &&
          rowOption.toUpperCase() === option.toUpperCase()
        ) {

          reservedQuantity += rowQuantity;
        }
      });
    }

    const availableStock = stock - reservedQuantity;

    if (quantity > availableStock) {
      throw new Error(
        "Insufficient available stock. Available: " +
        Math.max(0, availableStock)
      );
    }

    // --------------------------------------
    // 7. CREATE RAZORPAY ORDER
    // --------------------------------------

    const createdAt = new Date();

    const expiresAt = new Date(
      now + (15 * 60 * 1000)
    );

    const receipt = "VM" + now;

    const payload = {
      amount: amount,
      currency: "INR",
      receipt: receipt,
      expire_by: Math.floor(
        expiresAt.getTime() / 1000
      ),
      notes: {
        sku: sku,
        size: option,
        quantity: String(quantity)
      }
    };

    const response = UrlFetchApp.fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "post",
        contentType: "application/json",
        headers: {
          Authorization: "Basic " +
            Utilities.base64Encode(
              keyId + ":" + keySecret
            )
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    const httpStatus = response.getResponseCode();

    let result;

    try {
      result = JSON.parse(response.getContentText());
    } catch (parseError) {
      throw new Error("Invalid response from Razorpay");
    }

    if (
      httpStatus !== 200 &&
      httpStatus !== 201
    ) {
      throw new Error(
        result.error &&
        result.error.description
          ? result.error.description
          : "Razorpay order creation failed"
      );
    }

    if (!result.id || result.amount !== amount) {
      throw new Error("Invalid Razorpay order response");
    }

    // --------------------------------------
    // 8. SAVE RESERVATION + CUSTOMER DETAILS
    // --------------------------------------

    sheet.appendRow([
      result.id,
      sku,
      product["Product Name"],
      option,
      quantity,
      unitPrice,
      amount,
      customerName,
      phone,
      email,
      fullAddress,
      createdAt,
      expiresAt,
      "PENDING",
      ""
    ]);

    SpreadsheetApp.flush();

    // --------------------------------------
    // 9. SEND ORDER DETAILS TO WEBSITE
    // --------------------------------------

    return {
      success: true,
      message: "Razorpay order created",

      keyId: keyId,

      razorpayOrderId: result.id,

      amount: result.amount,

      currency: result.currency,

      sku: sku,

      size: option,

      quantity: quantity,

      unitPrice: unitPrice,

      productName: product["Product Name"],

      reservationMinutes: 15
    };

  } finally {

    lock.releaseLock();

  }
}

function findVmoodReservationRow_(sheet, orderId) {

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === orderId) {
      return i + 2;
    }
  }

  return null;
}

function cancelVmoodReservation_(body) {

  const razorpayOrderId = String(
    body.razorpay_order_id || ""
  ).trim();

  if (!razorpayOrderId) {
    throw new Error("Razorpay order ID missing");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {

    const props = PropertiesService.getScriptProperties();
    const keyId = props.getProperty("RAZORPAY_KEY_ID");
    const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

    if (!keyId || !keySecret) {
      throw new Error("Razorpay configuration missing");
    }

    const sheet = getVmoodReservationsSheet_();

    const row = findVmoodReservationRow_(
      sheet,
      razorpayOrderId
    );

    if (!row) {
      throw new Error("Reservation not found");
    }

    const reservation = sheet
      .getRange(row, 1, 1, 15)
      .getValues()[0];

    const status = String(reservation[13] || "")
      .trim()
      .toUpperCase();

    if (status === "CANCELLED" || status === "EXPIRED") {
      return {
        success: true,
        message: "Reservation already released"
      };
    }

    if (status === "PAID") {
      return {
        success: true,
        message: "Order already paid"
      };
    }

    if (status !== "PENDING") {
      return {
        success: false,
        message: "Reservation cannot be cancelled in its current state"
      };
    }

    // Check Razorpay payment records before releasing stock.

    const response = UrlFetchApp.fetch(
      "https://api.razorpay.com/v1/orders/" +
        encodeURIComponent(razorpayOrderId) +
        "/payments",
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
      throw new Error(
        "Unable to check Razorpay payment status. Reservation not released."
      );
    }

    const result = JSON.parse(response.getContentText());
    const payments = result.items || [];

    const activePayment = payments.find(function(payment) {
      return (
        payment.status === "captured" ||
        payment.status === "authorized"
      );
    });

    if (activePayment) {

      sheet.getRange(row, 14)
        .setValue("REVIEW_REQUIRED");

      sheet.getRange(row, 15)
        .setValue(activePayment.id || "");

      SpreadsheetApp.flush();

      return {
        success: false,
        paymentDetected: true,
        message:
          "Payment detected. Reservation held for payment review."
      };
    }

    // No captured or authorized payment.
    // Release the pending reservation.

    sheet.getRange(row, 14)
      .setValue("CANCELLED");

    SpreadsheetApp.flush();

    return {
      success: true,
      reservationStatus: "CANCELLED",
      message: "Reservation cancelled successfully"
    };

  } finally {
    lock.releaseLock();
  }
}

