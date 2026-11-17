// ==========================================
// VMOOD PRODUCT CATALOG
// MEN + WOMEN product and variant loading
// ==========================================

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
