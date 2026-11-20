// ==========================================
// VMOOD SIMPLE PAYMENT SYSTEM
// Razorpay + ORDERS sheet (no reservations)
// ==========================================

function testVmoodRazorpayConnection() {
  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are missing.");

  const response = UrlFetchApp.fetch("https://api.razorpay.com/v1/orders", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
    payload: JSON.stringify({
      amount: 100, currency: "INR", receipt: "VMOOD_TEST_" + Date.now(),
      notes: { purpose: "VMOOD backend connection test" }
    }),
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200 && response.getResponseCode() !== 201) {
    throw new Error(result.error && result.error.description ? result.error.description : response.getContentText());
  }
  Logger.log("RAZORPAY CONNECTION SUCCESSFUL");
  Logger.log("Test Order ID: " + result.id);
}

function getVmoodOrdersSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("ORDERS_SPREADSHEET_ID");
  if (!id) throw new Error("Orders spreadsheet ID missing");
  const sheet = SpreadsheetApp.openById(id).getSheetByName("ORDERS");
  if (!sheet || sheet.getLastColumn() < 16) throw new Error("ORDERS sheet is missing or incomplete");

  const expected = [
    "Created At", "Order ID", "SKU", "Product Name", "Option", "Quantity",
    "Unit Price", "Total Amount", "Customer Name", "Phone", "Full Address",
    "Delivery Status", "Razorpay Order ID", "Razorpay Payment ID",
    "Payment Status", "Stock Deducted"
  ];
  const actual = sheet.getRange(1, 1, 1, 16).getDisplayValues()[0];
  expected.forEach(function(header, i) {
    if (String(actual[i]).trim() !== header) {
      throw new Error("ORDERS header mismatch at column " + (i + 1) + ". Expected: " + header);
    }
  });
  return sheet;
}

function findVmoodOrderRow_(sheet, razorpayOrderId) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const ids = sheet.getRange(2, 13, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === razorpayOrderId) return i + 2;
  }
  return null;
}

function createVmoodRazorpayOrder_(body) {
  const sku = String(body.sku || "").trim().toUpperCase();
  const requestedOption = String(body.option || body.size || "").trim();
  const quantity = Number(body.quantity);

  if (!/^(MP|WP)[A-Z0-9_-]+$/.test(sku)) throw new Error("Invalid product SKU");
  if (!requestedOption || requestedOption.length > 20) throw new Error("Invalid product option");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new Error("Quantity must be between 1 and 20");
  }

  const customerName = String(body.customerName || body.name || "").trim();
  const phone = String(body.phone || "").replace(/\s+/g, "");
  const email = String(body.email || "").trim();
  const street = String(body.street || body.address || "").trim();
  const city = String(body.city || "").trim();
  const state = String(body.state || "").trim();
  const pincode = String(body.pincode || "").trim();

  if (customerName.length < 3 || customerName.length > 100) throw new Error("Please enter a valid customer name");
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Please enter a valid Indian mobile number");
  if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Please enter a valid email address");
  if (street.length < 10 || street.length > 300) throw new Error("Please enter a valid delivery address");
  if (city.length < 2 || city.length > 80) throw new Error("Please enter a valid city");
  if (state.length < 2 || state.length > 80) throw new Error("Please enter a valid state");
  if (!/^\d{6}$/.test(pincode)) throw new Error("Please enter a valid 6-digit pincode");

  const fullAddress = [street, city, state, pincode].join(", ");
  const databaseId = sku.startsWith("MP") ? VMOOD_DATABASES.MEN : VMOOD_DATABASES.WOMEN;
  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay configuration missing");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const product = getProduct(databaseId, sku);
    if (!product) throw new Error("Product not found");

    const option = Object.keys(product.variants || {}).find(function(key) {
      return key.trim().toUpperCase() === requestedOption.toUpperCase();
    });
    if (!option) throw new Error("Selected option is unavailable");

    const variant = product.variants[option];
    const stock = Number(variant.stock);
    const unitPrice = Number(variant.newPrice);
    if (!Number.isSafeInteger(stock) || stock < 0) throw new Error("Invalid product stock");
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("Invalid product price");

    // New checkouts close when stock reaches 3 or less.
    if (stock <= 3) throw new Error("This option is currently unavailable");
    if (quantity > stock) throw new Error("Only " + stock + " unit(s) are currently available");

    const amount = Math.round(unitPrice * quantity * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid order amount");

    const response = UrlFetchApp.fetch("https://api.razorpay.com/v1/orders", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
      payload: JSON.stringify({
        amount: amount,
        currency: "INR",
        receipt: "VM" + Date.now(),
        notes: { sku: sku, option: option, quantity: String(quantity) }
      }),
      muteHttpExceptions: true
    });

    let result;
    try {
      result = JSON.parse(response.getContentText());
    } catch (error) {
      throw new Error("Invalid response from Razorpay");
    }
    if (response.getResponseCode() !== 200 && response.getResponseCode() !== 201) {
      throw new Error(result.error && result.error.description ? result.error.description : "Razorpay order creation failed");
    }
    if (!result.id || Number(result.amount) !== amount) throw new Error("Invalid Razorpay order response");

    // Save the order before the customer can open Razorpay Checkout.
    const orderId = "VMOOD-" + Date.now() + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();
    const sheet = getVmoodOrdersSheet_();
    sheet.appendRow([
      new Date(), orderId, sku, String(product["Product Name"] || ""),
      option, quantity, unitPrice, amount / 100, customerName, phone,
      fullAddress, "PROCESSING", result.id, "", "PENDING", false
    ]);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "Order created. Continue to secure payment.",
      keyId: keyId,
      razorpayOrderId: result.id,
      orderId: orderId,
      amount: result.amount,
      currency: result.currency,
      sku: sku,
      size: option,
      quantity: quantity,
      unitPrice: unitPrice,
      productName: String(product["Product Name"] || "")
    };
  } finally {
    lock.releaseLock();
  }
}
