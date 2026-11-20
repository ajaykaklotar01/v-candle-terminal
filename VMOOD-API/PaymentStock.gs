// ==========================================
// VMOOD PAYMENT STOCK HELPERS
// Variant stock state + idempotent stock deduction
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

  if (state.stock - quantity < 3) {
    throw new Error("Stock deduction would use the protected 3-unit reserve");
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
