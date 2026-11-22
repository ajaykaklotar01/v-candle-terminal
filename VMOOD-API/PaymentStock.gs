// ==========================================
// VMOOD PAYMENT STOCK HELPERS
// Variant stock state + permanent payment deduction ledger
// ==========================================

const VMOOD_DEDUCTION_HEADERS_ = [
  "Payment ID", "Razorpay Order ID", "SKU", "Option", "Quantity",
  "Before Stock", "After Stock", "Status", "Updated At"
];

function getVmoodVariantStockState_(databaseId, sku, option) {
  const ss = SpreadsheetApp.openById(databaseId);
  const sheet = ss.getSheetByName("VARIANTS");
  if (!sheet) throw new Error("VARIANTS sheet not found");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("No product variants found");

  const markerHeader = String(sheet.getRange(1, 6).getValue()).trim();
  if (markerHeader === "") {
    sheet.getRange(1, 6).setValue("Last Deduction Payment ID");
  } else if (markerHeader !== "Last Deduction Payment ID") {
    throw new Error("VARIANTS column F is already used");
  }

  const headers = sheet.getRange(1, 1, 1, 5).getValues()[0]
    .map(function(value) { return String(value).trim().toUpperCase(); });
  const skuColumn = headers.indexOf("SKU");
  const optionColumn = headers.indexOf("OPTION");
  const stockColumn = headers.indexOf("STOCK");
  if (skuColumn < 0 || optionColumn < 0 || stockColumn !== 4) {
    throw new Error("VARIANTS headers are incorrect. STOCK must be column E.");
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  let variantRow = null, stock = 0, lastPaymentId = "";
  for (let i = 0; i < rows.length; i++) {
    const rowSku = String(rows[i][skuColumn] || "").trim().toUpperCase();
    const rowOption = String(rows[i][optionColumn] || "").trim().toUpperCase();
    if (rowSku === sku.toUpperCase() && rowOption === option.toUpperCase()) {
      if (variantRow !== null) throw new Error("Duplicate product variant found");
      variantRow = i + 2;
      stock = Number(rows[i][stockColumn]);
      lastPaymentId = String(rows[i][5] || "").trim();
    }
  }
  if (variantRow === null) throw new Error("Product variant not found");
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error("Invalid variant stock");
  return { sheet: sheet, row: variantRow, stock: stock, lastPaymentId: lastPaymentId };
}

function getVmoodDeductionLedgerSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("ORDERS_SPREADSHEET_ID");
  if (!id) throw new Error("Orders spreadsheet ID missing");
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName("PAYMENT_DEDUCTIONS");
  if (!sheet) sheet = ss.insertSheet("PAYMENT_DEDUCTIONS");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, VMOOD_DEDUCTION_HEADERS_.length).setValues([VMOOD_DEDUCTION_HEADERS_]);
    SpreadsheetApp.flush();
  } else {
    const actual = sheet.getRange(1, 1, 1, VMOOD_DEDUCTION_HEADERS_.length)
      .getDisplayValues()[0].map(function(v) { return String(v).trim(); });
    VMOOD_DEDUCTION_HEADERS_.forEach(function(header, i) {
      if (actual[i] !== header) throw new Error("PAYMENT_DEDUCTIONS header mismatch at column " + (i + 1));
    });
  }
  return sheet;
}

function findVmoodDeductionRow_(sheet, paymentId) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const ids = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === paymentId) return i + 2;
  }
  return null;
}

function deductVmoodStockOnce_(databaseId, sku, option, quantity, paymentId) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Invalid stock deduction quantity");
  if (!paymentId) throw new Error("Payment ID missing");
  const state = getVmoodVariantStockState_(databaseId, sku, option);
  if (state.lastPaymentId === paymentId) return { success: true, alreadyDeducted: true };
  if (state.stock - quantity < 3) throw new Error("Stock deduction would use the protected 3-unit reserve");
  state.sheet.getRange(state.row, 5, 1, 2).setValues([[state.stock - quantity, paymentId]]);
  SpreadsheetApp.flush();
  return { success: true, alreadyDeducted: false };
}

// Must be called while the script-wide lock is held.
function processVmoodStockLedger_(databaseId, sku, option, quantity, paymentId, razorpayOrderId) {
  const ledger = getVmoodDeductionLedgerSheet_();
  let ledgerRow = findVmoodDeductionRow_(ledger, paymentId);
  let status = "";
  let beforeStock, afterStock;

  if (ledgerRow) {
    const saved = ledger.getRange(ledgerRow, 1, 1, 9).getValues()[0];
    if (String(saved[2]).toUpperCase() !== sku.toUpperCase() ||
        String(saved[3]).toUpperCase() !== option.toUpperCase() ||
        Number(saved[4]) !== quantity ||
        String(saved[1]) !== razorpayOrderId) {
      throw new Error("Payment ID is already recorded with different order details");
    }
    beforeStock = Number(saved[5]);
    afterStock = Number(saved[6]);
    status = String(saved[7]).trim().toUpperCase();
    if (status === "DEDUCTED") return { success: true, alreadyDeducted: true };
    if (status !== "PROCESSING") return { success: false, reviewRequired: true };
  } else {
    const state = getVmoodVariantStockState_(databaseId, sku, option);

    // Do not process new deductions while an older pre-ledger paid order for this
    // same variant is still unresolved. Its previous deduction may have occurred
    // before the permanent ledger was introduced.
    const ordersSheet = getVmoodOrdersSheet_();
    const ordersLastRow = ordersSheet.getLastRow();
    if (ordersLastRow >= 2) {
      const oldOrders = ordersSheet.getRange(2, 1, ordersLastRow - 1, 16).getValues();
      const unresolvedLegacyOrder = oldOrders.some(function(row) {
        return String(row[13] || "").trim() !== paymentId &&
          String(row[2] || "").trim().toUpperCase() === sku.toUpperCase() &&
          String(row[4] || "").trim().toUpperCase() === option.toUpperCase() &&
          String(row[14] || "").trim().toUpperCase() === "PAID" &&
          String(row[15] || "").trim().toUpperCase() !== "TRUE";
      });
      if (unresolvedLegacyOrder) return { success: false, reviewRequired: true };
    }

    // Compatibility with a deduction made by the previous version before its ledger existed.
    if (state.lastPaymentId === paymentId) {
      beforeStock = state.stock + quantity;
      afterStock = state.stock;
      ledger.appendRow([paymentId, razorpayOrderId, sku, option, quantity,
        beforeStock, afterStock, "DEDUCTED", new Date()]);
      SpreadsheetApp.flush();
      return { success: true, alreadyDeducted: true };
    }

    const last = ledger.getLastRow();
    if (last >= 2) {
      const rows = ledger.getRange(2, 1, last - 1, 9).getValues();
      const pending = rows.some(function(row) {
        return String(row[2]).toUpperCase() === sku.toUpperCase() &&
          String(row[3]).toUpperCase() === option.toUpperCase() &&
          String(row[7]).toUpperCase() === "PROCESSING";
      });
      if (pending) return { success: false, reviewRequired: true };
    }

    if (state.stock - quantity < 3) return { success: false, reviewRequired: true };
    beforeStock = state.stock;
    afterStock = state.stock - quantity;
    ledger.appendRow([paymentId, razorpayOrderId, sku, option, quantity,
      beforeStock, afterStock, "PROCESSING", new Date()]);
    SpreadsheetApp.flush();
    ledgerRow = ledger.getLastRow();
    status = "PROCESSING";
  }

  // If the previous execution stopped after writing stock but before updating the ledger,
  // the per-variant marker proves that this payment already made the deduction.
  const current = getVmoodVariantStockState_(databaseId, sku, option);
  // Only the matching payment marker proves that this payment wrote the stock.
  // A matching stock number alone is not proof: manual edits or another inventory
  // adjustment could coincidentally produce the same value. In that case, stop
  // and require reconciliation instead of falsely marking the payment complete.
  if (current.lastPaymentId === paymentId) {
    ledger.getRange(ledgerRow, 8, 1, 2).setValues([["DEDUCTED", new Date()]]);
    SpreadsheetApp.flush();
    return { success: true, alreadyDeducted: true };
  }

  // No later payment is allowed to pass a PROCESSING ledger row for this variant,
  // so stock must still equal the recorded before-value before we attempt the write.
  if (current.stock !== beforeStock) {
    ledger.getRange(ledgerRow, 8, 1, 2).setValues([["REVIEW_REQUIRED", new Date()]]);
    SpreadsheetApp.flush();
    return { success: false, reviewRequired: true };
  }

  deductVmoodStockOnce_(databaseId, sku, option, quantity, paymentId);
  const confirmed = getVmoodVariantStockState_(databaseId, sku, option);
  if (confirmed.lastPaymentId !== paymentId || confirmed.stock !== afterStock) {
    ledger.getRange(ledgerRow, 8, 1, 2).setValues([["REVIEW_REQUIRED", new Date()]]);
    SpreadsheetApp.flush();
    return { success: false, reviewRequired: true };
  }

  ledger.getRange(ledgerRow, 8, 1, 2).setValues([["DEDUCTED", new Date()]]);
  SpreadsheetApp.flush();
  return { success: true, alreadyDeducted: false };
}
