// ==========================================
// VMOOD SHARED CONFIGURATION + HELPERS
// ==========================================

const VMOOD_DATABASES = {
  MEN: "1cqbWLwhw-eHKqiJf24hG8k0A_Mw-aVIT8mPMP4RAivk",
  WOMEN: "1BAPAgcOwMrVbVBYurqKdrl0kZ0Pqn6EBspCmo0htXaU"
};

function sendResponse(data, e) {
  const callback = e && e.parameter ? e.parameter.callback : "";
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function testVmoodOrderSetup() {
  const props = PropertiesService.getScriptProperties();
  const ordersId = props.getProperty("ORDERS_SPREADSHEET_ID");
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");
  if (!ordersId || !keyId || !keySecret) {
    throw new Error("Missing Script Properties: ORDERS_SPREADSHEET_ID, RAZORPAY_KEY_ID, or RAZORPAY_KEY_SECRET.");
  }

  const ordersSheet = SpreadsheetApp.openById(ordersId).getSheetByName("ORDERS");
  if (!ordersSheet) throw new Error("ORDERS tab not found. Check the tab name.");

  const expected = [
    "Created At", "Order ID", "SKU", "Product Name", "Option", "Quantity",
    "Unit Price", "Total Amount", "Customer Name", "Phone", "Full Address",
    "Delivery Status", "Razorpay Order ID", "Razorpay Payment ID",
    "Payment Status", "Stock Deducted"
  ];
  if (ordersSheet.getLastColumn() < 16) throw new Error("ORDERS sheet must contain columns A:P (16 columns).");
  const actual = ordersSheet.getRange(1, 1, 1, 16).getDisplayValues()[0];
  expected.forEach(function(header, index) {
    if (String(actual[index]).trim() !== header) {
      throw new Error("ORDERS sheet header mismatch at column " + (index + 1) + ". Expected: " + header);
    }
  });

  [
    { name: "MEN", id: VMOOD_DATABASES.MEN },
    { name: "WOMEN", id: VMOOD_DATABASES.WOMEN }
  ].forEach(function(database) {
    const ss = SpreadsheetApp.openById(database.id);
    const products = ss.getSheetByName("PRODUCTS");
    const variants = ss.getSheetByName("VARIANTS");
    if (!products || !variants) throw new Error(database.name + " database must contain PRODUCTS and VARIANTS tabs.");

    const productHeaders = products.getRange(1, 1, 1, products.getLastColumn())
      .getDisplayValues()[0].map(function(value) { return String(value).trim(); });
    ["SKU", "Product Name"].forEach(function(header) {
      if (productHeaders.indexOf(header) === -1) throw new Error(database.name + " PRODUCTS is missing header: " + header);
    });

    const variantHeaders = variants.getRange(1, 1, 1, 5)
      .getDisplayValues()[0].map(function(value) { return String(value).trim(); });
    ["SKU", "Option", "Old Price", "New Price", "Stock"].forEach(function(header, index) {
      if (variantHeaders[index] !== header) {
        throw new Error(database.name + " VARIANTS column " + (index + 1) + " must be: " + header);
      }
    });

    const markerHeader = String(variants.getRange(1, 6).getDisplayValue()).trim();
    if (markerHeader !== "" && markerHeader !== "Last Deduction Payment ID") {
      throw new Error(database.name + " VARIANTS column F is already used. Check it before enabling stock deduction.");
    }
    if (markerHeader === "" && variants.getLastRow() >= 2) {
      const values = variants.getRange(2, 6, variants.getLastRow() - 1, 1).getDisplayValues();
      if (values.some(function(row) { return String(row[0]).trim() !== ""; })) {
        throw new Error(database.name + " VARIANTS column F contains data but has no marker header.");
      }
    }
    Logger.log(database.name + " database tabs and headers verified.");
  });

  Logger.log("VMOOD SIMPLE PAYMENT SYSTEM SETUP CHECK PASSED.");
  Logger.log("Required Script Properties: ORDERS_SPREADSHEET_ID, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.");
  Logger.log("ORDERS columns checked: A:P (16 columns).");
}

function vmoodPostResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
