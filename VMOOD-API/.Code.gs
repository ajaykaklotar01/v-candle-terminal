
// ==========================================
// VMOOD PRODUCT DATABASE API
// MEN + WOMEN GOOGLE SHEETS
// ==========================================

const VMOOD_DATABASES = {
  MEN: "1jae-sXyqQWio36wEb7GYuf6qgtaE0lQUmSddqaH8MUM",
  WOMEN: "1v2SoP_F3GBtH5QUdOsrMstU6PE3fjBZOZh3LnXF_T1k"
};


// MAIN API
function doGet(e) {
  try {
    const sku = String(e.parameter.sku || "").trim();

    if (!sku) {
      return sendResponse({
        success: false,
        message: "SKU is required"
      }, e);
    }

    let result = null;

    if (sku.toUpperCase().startsWith("MP")) {
      result = getProduct(VMOOD_DATABASES.MEN, sku);
    } else if (sku.toUpperCase().startsWith("WP")) {
      result = getProduct(VMOOD_DATABASES.WOMEN, sku);
    } else {
      return sendResponse({
        success: false,
        message: "Invalid SKU"
      }, e);
    }

    if (!result) {
      return sendResponse({
        success: false,
        message: "Product not found"
      }, e);
    }

    return sendResponse({
      success: true,
      product: result
    }, e);

  } catch (error) {
    return sendResponse({
      success: false,
      message: error.message
    }, e);
  }
}


// FETCH PRODUCT AND VARIANTS
function getProduct(spreadsheetId, sku) {

  const ss = SpreadsheetApp.openById(spreadsheetId);

  const productSheet = ss.getSheetByName("PRODUCTS");
  const variantSheet = ss.getSheetByName("VARIANTS");

  if (!productSheet || !variantSheet) {
    throw new Error("PRODUCTS or VARIANTS sheet missing");
  }

  const productRows = productSheet.getDataRange().getDisplayValues();
  const variantRows = variantSheet.getDataRange().getDisplayValues();

  const productHeaders = productRows[0].map(h => h.trim());

  const productIndex = productHeaders.indexOf("SKU");

  if (productIndex === -1) {
    throw new Error("SKU column missing in PRODUCTS");
  }

  const productRow = productRows.slice(1).find(row =>
    row[productIndex].trim().toUpperCase() === sku.toUpperCase()
  );

  if (!productRow) return null;

  const product = {};

  productHeaders.forEach((header, index) => {
    product[header] = productRow[index];
  });

  const variantHeaders = variantRows[0].map(h => h.trim());

  const variantSkuIndex = variantHeaders.indexOf("SKU");

  if (variantSkuIndex === -1) {
    throw new Error("SKU column missing in VARIANTS");
  }

  const variants = {};

  variantRows.slice(1).forEach(row => {

    if (row[variantSkuIndex].trim().toUpperCase() !== sku.toUpperCase()) {
      return;
    }

    const data = {};

    variantHeaders.forEach((header, index) => {
      data[header] = row[index];
    });

    const option = data["Option"];

    if (!option) return;

    variants[option] = {
      oldPrice: Number(data["Old Price"]),
      newPrice: Number(data["New Price"]),
      stock: Number(data["Stock"])
    };

  });

  product.variants = variants;

  return product;
}


// RESPONSE FORMAT
function sendResponse(data, e) {

  const callback = e.parameter.callback;

  const json = JSON.stringify(data);

  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


function testVmoodOrderSetup() {
  const props = PropertiesService.getScriptProperties();

  const ordersId = props.getProperty("ORDERS_SPREADSHEET_ID");
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

  if (!ordersId || !keyId || !keySecret) {
    throw new Error(
      "Missing Script Properties: ORDERS_SPREADSHEET_ID, RAZORPAY_KEY_ID, or RAZORPAY_KEY_SECRET."
    );
  }

  const ordersSS = SpreadsheetApp.openById(ordersId);
  const ordersSheet = ordersSS.getSheetByName("ORDERS");

  if (!ordersSheet) {
    throw new Error('ORDERS tab not found. Check the tab name.');
  }

  const expectedOrderHeaders = [
    "Created At",
    "Order ID",
    "SKU",
    "Product Name",
    "Size",
    "Quantity",
    "Unit Price",
    "Total Amount",
    "Customer Name",
    "Phone",
    "Email",
    "Full Address",
    "Razorpay Order ID",
    "Razorpay Payment ID",
    "Payment Status",
    "Stock Deducted",
    "Delivery Status"
  ];

  if (ordersSheet.getLastColumn() < expectedOrderHeaders.length) {
    throw new Error("ORDERS sheet must contain columns A:Q (17 columns).");
  }

  const actualOrderHeaders = ordersSheet.getRange(
    1, 1, 1, expectedOrderHeaders.length
  ).getDisplayValues()[0];

  expectedOrderHeaders.forEach(function(header, index) {
    if (String(actualOrderHeaders[index]).trim() !== header) {
      throw new Error(
        "ORDERS sheet header mismatch at column " + (index + 1) +
        ". Expected: " + header
      );
    }
  });

  const databaseChecks = [
    { name: "MEN", id: VMOOD_DATABASES.MEN },
    { name: "WOMEN", id: VMOOD_DATABASES.WOMEN }
  ];

  databaseChecks.forEach(function(database) {
    const databaseSS = SpreadsheetApp.openById(database.id);
    const products = databaseSS.getSheetByName("PRODUCTS");
    const variants = databaseSS.getSheetByName("VARIANTS");

    if (!products || !variants) {
      throw new Error(database.name + " database must contain PRODUCTS and VARIANTS tabs.");
    }

    const productHeaders = products.getRange(
      1, 1, 1, products.getLastColumn()
    ).getDisplayValues()[0].map(function(value) {
      return String(value).trim();
    });

    ["SKU", "Product Name"].forEach(function(header) {
      if (productHeaders.indexOf(header) === -1) {
        throw new Error(database.name + " PRODUCTS is missing header: " + header);
      }
    });

    const variantHeaders = variants.getRange(1, 1, 1, 5)
      .getDisplayValues()[0].map(function(value) {
        return String(value).trim();
      });

    ["SKU", "Option", "Old Price", "New Price", "Stock"].forEach(function(header, index) {
      if (variantHeaders[index] !== header) {
        throw new Error(
          database.name + " VARIANTS column " + (index + 1) +
          " must be: " + header
        );
      }
    });

    const markerHeader = String(
      variants.getRange(1, 6).getDisplayValue()
    ).trim();

    if (
      markerHeader !== "" &&
      markerHeader !== "Last Deduction Payment ID"
    ) {
      throw new Error(
        database.name + " VARIANTS column F must be blank or titled 'Last Deduction Payment ID'."
      );
    }

    if (markerHeader === "" && variants.getLastRow() >= 2) {
      const columnFValues = variants.getRange(
        2, 6, variants.getLastRow() - 1, 1
      ).getDisplayValues();

      const columnFHasData = columnFValues.some(function(row) {
        return String(row[0]).trim() !== "";
      });

      if (columnFHasData) {
        throw new Error(
          database.name + " VARIANTS column F contains data but has no marker header. Check this column before using stock deduction."
        );
      }
    }

    Logger.log(database.name + " database tabs and headers verified.");
    Logger.log(database.name + " VARIANTS column F: " +
      (markerHeader || "blank; code can add marker header later"));
  });

  const reservations = ordersSS.getSheetByName("RESERVATIONS");

  if (reservations && reservations.getLastRow() > 0) {
    const expectedHeaders = VMOOD_RESERVATION_HEADERS;
    const actualHeaders = reservations.getRange(
      1, 1, 1, expectedHeaders.length
    ).getDisplayValues()[0];

    expectedHeaders.forEach(function(header, index) {
      if (String(actualHeaders[index]).trim() !== header) {
        throw new Error(
          "RESERVATIONS sheet header mismatch at column " + (index + 1)
        );
      }
    });
    Logger.log("RESERVATIONS headers verified.");
  } else {
    Logger.log("RESERVATIONS tab is not present yet; API will create it automatically.");
  }

  Logger.log("VMOOD ORDER DATABASE SETUP CHECK PASSED.");
  Logger.log("Required Script Properties: ORDERS_SPREADSHEET_ID, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.");
  Logger.log("ORDERS columns checked: A:Q (" + ordersSheet.getLastColumn() + " used columns).");
}


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




 // ==========================================
 // VMOOD PART 10 - UPDATED POST API ROUTER
 // ==========================================

function doPost(e) {

  try {

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Request body is missing");
    }

    const body = JSON.parse(e.postData.contents || "{}");

    const action = String(body.action || "")
      .trim()
      .toUpperCase();


    // --------------------------------------
    // 1. CONNECTION TEST
    // --------------------------------------

    if (action === "PING") {

      return vmoodPostResponse_({
        success: true,
        message: "VMOOD POST API CONNECTED"
      });

    }


    // --------------------------------------
    // 2. CREATE RAZORPAY ORDER
    // --------------------------------------

    if (action === "CREATE_ORDER") {

      return vmoodPostResponse_(
        createVmoodRazorpayOrder_(body)
      );

    }


    // --------------------------------------
    // 3. VERIFY RAZORPAY PAYMENT
    // --------------------------------------

    if (action === "VERIFY_PAYMENT") {

      return vmoodPostResponse_(
        verifyVmoodPayment_(body)
      );

    }

if (action === "CANCEL_ORDER") {
  return vmoodPostResponse_(
    cancelVmoodReservation_(body)
  );
}

    // --------------------------------------
    // 5. TRACK CUSTOMER ORDER
    // --------------------------------------

    if (action === "TRACK_ORDER") {

      return vmoodPostResponse_(
        trackVmoodOrder_(body)
      );

    }

    // --------------------------------------
    // 6. UNKNOWN ACTION.
    // --------------------------------------
    return vmoodPostResponse_({
      success: false,
      message: "Unknown API action"
    });


  } catch (error) {

    return vmoodPostResponse_({
      success: false,
      message: error.message || "VMOOD API error"
    });

  }

}

function testVmoodPostDeployment() {
  const url = ScriptApp.getService().getUrl();

  if (!url) {
    throw new Error("Web App URL not found. Check deployment.");
  }

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify({
      action: "PING"
    }),
    followRedirects: true,
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (status !== 200 || !result.success) {
    throw new Error(
      "POST test failed: " + response.getContentText()
    );
  }

  Logger.log("VMOOD DEPLOYED POST API SUCCESSFUL");
  Logger.log("Response: " + result.message);
}


function diagnoseVmoodPost() {
  const url = ScriptApp.getService().getUrl();

  Logger.log("WEB APP URL: " + url);

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify({
      action: "PING"
    }),
    followRedirects: false,
    muteHttpExceptions: true
  });

  Logger.log("HTTP STATUS: " + response.getResponseCode());
  Logger.log("RESPONSE HEADERS: " +
    JSON.stringify(response.getAllHeaders()));

  Logger.log("RESPONSE BODY: " +
    response.getContentText().substring(0, 1000));
}


function testVmoodProductionPost() {
  const url = ScriptApp.getService().getUrl();

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify({
      action: "PING"
    }),
    followRedirects: true,
    muteHttpExceptions: true
  });

  Logger.log("HTTP STATUS: " + response.getResponseCode());
  Logger.log("RESPONSE: " + response.getContentText());
}


// ==========================================
// VMOOD SECURE RAZORPAY ORDER CREATION
// PART 8 - CUSTOMER DETAILS + STOCK RESERVATION
// ==========================================


// JSON RESPONSE HELPER
function vmoodPostResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// RESERVATIONS SHEET HEADERS
const VMOOD_RESERVATION_HEADERS = [
  "Razorpay Order ID",
  "SKU",
  "Product Name",
  "Size",
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


// GET OR CREATE RESERVATIONS SHEET
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


// CREATE RAZORPAY ORDER
function createVmoodRazorpayOrder_(body) {

  const sku = String(body.sku || "")
    .trim()
    .toUpperCase();

  const size = String(body.size || "").trim();

  const quantity = Number(body.quantity);

  // --------------------------------------
  // 1. BASIC VALIDATION
  // --------------------------------------

  if (!/^(MP|WP)[A-Z0-9_-]+$/.test(sku)) {
    throw new Error("Invalid product SKU");
  }

  if (!size || size.length > 20) {
    throw new Error("Invalid product size");
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

        const rowSize = String(row[3] || "").trim();

        const rowQuantity = Number(row[4]);

        const expiresAt = new Date(row[12]).getTime();

        const reservationStatus = String(
          row[13] || ""
        ).trim().toUpperCase();

        if (
          reservationStatus === "PROCESSING" &&
          rowSku === sku &&
          rowSize.toUpperCase() === option.toUpperCase()
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
          rowSize.toUpperCase() === option.toUpperCase()
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

// ==========================================
// VMOOD PART 9
// RAZORPAY PAYMENT VERIFICATION
// + IDEMPOTENT STOCK DEDUCTION
// + PAYMENT RECOVERY
// ==========================================

// ==========================================
// MAIN PAYMENT VERIFICATION
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
      ordersSheet.getLastColumn() < 17
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
        .getRange(orderRow, 1, 1, 17)
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
      throw new Error("Product size no longer exists");
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
      const otherSize = String(other[3] || "")
        .trim()
        .toUpperCase();
      const otherStatus = String(other[13] || "")
        .trim()
        .toUpperCase();

      if (
        otherOrderId !== razorpayOrderId &&
        otherSku === sku &&
        otherSize === currentOption.toUpperCase() &&
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


// ==========================================
// HELPER: CONSTANT-TIME SIGNATURE COMPARISON
// ==========================================

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


// ==========================================
// HELPER: FIND RESERVATION ROW
// ==========================================

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


// ==========================================
// HELPER: FIND ORDER ROW
// ==========================================

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

// ==========================================
// TRACK CUSTOMER ORDER
// ORDERS COLUMNS A-Q
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
        : "PROCESSING"
    }
  };
}



// ==========================================
// HELPER: SAVE VERIFIED ORDER
// ORDERS COLUMNS A-Q
// ==========================================


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
      .getRange(existingRow, 1, 1, 17)
      .getValues()[0];

    orderId = existing[1] || "VMOOD-" + Date.now();
    createdAt = existing[0] || new Date();

    const previousStatus = String(
      existing[16] || ""
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
    data.email,
    data.fullAddress,
    data.razorpayOrderId,
    data.razorpayPaymentId,
    "PAID",
    data.stockDeducted,
    deliveryStatus
  ];

  if (existingRow) {
    data.ordersSheet
      .getRange(existingRow, 1, 1, 17)
      .setValues([rowData]);
  } else {
    data.ordersSheet.appendRow(rowData);
  }

  SpreadsheetApp.flush();

  return orderId;
}



// ==========================================
// HELPER: GET VARIANT STOCK + PAYMENT MARKER
// VARIANTS COLUMN F IS RESERVED FOR MARKER
// ==========================================


// ==========================================
// HELPER: GET VARIANT STOCK + PAYMENT MARKER
// ==========================================

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


// ==========================================
// HELPER: DEDUCT STOCK ONLY ONCE
// ==========================================

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

// ==========================================
// VMOOD PART 11
// RESERVATION CANCELLATION + EXPIRY
// ==========================================


// ==========================================
// 1. CANCEL CUSTOMER RESERVATION
// ==========================================

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

// ==========================================
// VMOOD AUTOMATIC PAYMENT RECOVERY
// CHECKS RAZORPAY DIRECTLY - NO CUSTOMER BROWSER NEEDED
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


// Run once manually after deployment to install the automatic 5-minute check.
// Running it again replaces the old trigger instead of creating duplicates.
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

// ==========================================
// 2. EXPIRE OLD PENDING RESERVATIONS
// ==========================================

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

    
