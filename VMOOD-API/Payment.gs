// ==========================================
// VMOOD SIMPLE PAYMENT SYSTEM
// Create Razorpay order only. No Google Sheets write before payment.
// ==========================================

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
    if (stock <= 3) throw new Error("This option is currently unavailable");
    const maxPurchasable = stock - 3;
    if (quantity > maxPurchasable) {
      throw new Error("You can buy a maximum of " + maxPurchasable + " unit(s). 3 units are kept in reserve.");
    }

    const amount = Math.round(unitPrice * quantity * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid order amount");

    // Razorpay notes keep checkout details until payment succeeds.
    // Nothing is appended to Google Sheets at this stage.
    const notes = {
      sku: sku,
      option: option,
      quantity: String(quantity),
      unit_price: String(unitPrice),
      product_name: String(product["Product Name"] || "").slice(0, 200),
      customer_name: customerName,
      phone: phone,
      email: email,
      street_1: street.slice(0, 250),
      city: city,
      state: state,
      pincode: pincode
    };

    if (street.length > 250) notes.street_2 = street.slice(250);

    const response = UrlFetchApp.fetch("https://api.razorpay.com/v1/orders", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
      payload: JSON.stringify({
        amount: amount,
        currency: "INR",
        receipt: "VM" + Date.now(),
        notes: notes
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
      throw new Error("Razorpay order creation failed. Please try again.");
    }
    if (!result.id || Number(result.amount) !== amount || result.currency !== "INR") {
      throw new Error("Invalid Razorpay order response");
    }

    return {
      success: true,
      message: "Continue to secure payment.",
      keyId: keyId,
      razorpayOrderId: result.id,
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
