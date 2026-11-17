// ==========================================
// VMOOD API ROUTER
// GET product requests + POST payment/order actions
// ==========================================

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
  const url = "https://script.google.com/macros/s/AKfycbxYD0NSy7bcNlWRutvt4zgQWL8_lRbC1wSW_KgqkiyzK6Dd3mGn3uq1ODB6rqFs_ndcVA/exec";

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


function testVmoodCreateOrderOnce() {
  // Run this ONCE only. Each run creates a new Razorpay TEST order
  // and a 15-minute reservation row. It does not deduct stock.
  const url = "https://script.google.com/macros/s/AKfycbxYD0NSy7bcNlWRutvt4zgQWL8_lRbC1wSW_KgqkiyzK6Dd3mGn3uq1ODB6rqFs_ndcVA/exec";

  const payload = {
    action: "CREATE_ORDER",
    sku: "MP0001",
    option: "S",
    quantity: 1,
    customerName: "VMOOD Test Customer",
    phone: "9876543210",
    email: "test@example.com",
    street: "VMOOD Test Address - Not For Delivery",
    city: "Surat",
    state: "Gujarat",
    pincode: "395004"
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify(payload),
    followRedirects: true,
    muteHttpExceptions: true
  });

  Logger.log("HTTP STATUS: " + response.getResponseCode());
  Logger.log("CREATE ORDER RESPONSE: " + response.getContentText());
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
