// ==========================================
// VMOOD API ROUTER
// GET product requests + POST payment/order actions
// ==========================================

function doGet(e) {
  try {
    const sku = String(e.parameter.sku || "").trim();
    if (!sku) return sendResponse({ success: false, message: "SKU is required" }, e);

    let result = null;
    if (sku.toUpperCase().startsWith("MP")) {
      result = getProduct(VMOOD_DATABASES.MEN, sku);
    } else if (sku.toUpperCase().startsWith("WP")) {
      result = getProduct(VMOOD_DATABASES.WOMEN, sku);
    } else {
      return sendResponse({ success: false, message: "Invalid SKU" }, e);
    }

    if (!result) return sendResponse({ success: false, message: "Product not found" }, e);
    return sendResponse({ success: true, product: result }, e);
  } catch (error) {
    return sendResponse({ success: false, message: vmoodPublicErrorMessage_(error, "GET_PRODUCT") }, e);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Request body is missing");
    const body = JSON.parse(e.postData.contents || "{}");
    const action = String(body.action || "").trim().toUpperCase();

    if (action === "PING") {
      return vmoodPostResponse_({ success: true, message: "VMOOD POST API CONNECTED" });
    }
    if (action === "CREATE_ORDER") return vmoodPostResponse_(createVmoodRazorpayOrder_(body));
    if (action === "VERIFY_PAYMENT") return vmoodPostResponse_(verifyVmoodPayment_(body));
    if (action === "TRACK_ORDER") return vmoodPostResponse_(trackVmoodOrder_(body));

    return vmoodPostResponse_({ success: false, message: "Unknown API action" });
  } catch (error) {
    let action = "UNKNOWN";
    try { action = String(JSON.parse(e.postData.contents || "{}").action || "UNKNOWN").trim().toUpperCase(); } catch (ignored) {}
    return vmoodPostResponse_({ success: false, message: vmoodPublicErrorMessage_(error, action) });
  }
}

// Diagnostic test: logs the real HTTP response before attempting JSON parsing.
function testVmoodPostDeployment() {
  const url = ScriptApp.getService().getUrl();
  if (!url) throw new Error("Web App URL not found. Check deployment.");

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify({ action: "PING" }),
    followRedirects: true,
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const headers = response.getHeaders();
  const contentType = headers["Content-Type"] || headers["content-type"] || "Not provided";
  const body = response.getContentText();

  Logger.log("POST HTTP STATUS: " + status);
  Logger.log("POST CONTENT TYPE: " + contentType);
  Logger.log("POST RESPONSE BODY (first 1500 characters): " + body.substring(0, 1500));

  let result;
  try {
    result = JSON.parse(body);
  } catch (error) {
    throw new Error("POST returned non-JSON. HTTP " + status + "; Content-Type: " + contentType + ". Check the logged response body above.");
  }

  if (status !== 200 || !result.success) {
    throw new Error("POST test failed: " + body);
  }

  Logger.log("VMOOD POST API SUCCESSFUL");
  Logger.log("Response: " + result.message);
}
