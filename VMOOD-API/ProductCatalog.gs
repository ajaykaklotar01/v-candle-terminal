// ==========================================
// VMOOD PRODUCT CATALOG
// MEN + WOMEN product and variant loading
// Public response uses an explicit field allowlist.
// ==========================================

function getProduct(spreadsheetId, sku) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const productSheet = ss.getSheetByName("PRODUCTS");
  const variantSheet = ss.getSheetByName("VARIANTS");
  if (!productSheet || !variantSheet) throw new Error("PRODUCTS or VARIANTS sheet missing");

  const productRows = productSheet.getDataRange().getDisplayValues();
  const variantRows = variantSheet.getDataRange().getDisplayValues();
  if (productRows.length < 2 || !productRows[0].length || variantRows.length < 2 || !variantRows[0].length) {
    throw new Error("Product database is empty or incomplete");
  }

  const productHeaders = productRows[0].map(function(h) { return String(h).trim(); });
  const skuIndex = productHeaders.indexOf("SKU");
  if (skuIndex < 0) throw new Error("SKU column missing in PRODUCTS");

  const matches = productRows.slice(1).filter(function(row) {
    return String(row[skuIndex] || "").trim().toUpperCase() === String(sku).toUpperCase();
  });
  if (matches.length > 1) throw new Error("Duplicate product SKU found");
  if (!matches.length) return null;

  const productRow = matches[0];
  // These are the only PRODUCTS fields required by the public product and collection pages.
  const publicFields = [
    "SKU", "Product Name", "Color Name", "Color HEX",
    "Description", "Image Folder", "Image Count", "Delivery"
  ];
  const product = {};
  publicFields.forEach(function(field) {
    const index = productHeaders.indexOf(field);
    product[field] = index >= 0 ? String(productRow[index] || "") : "";
  });

  const variantHeaders = variantRows[0].map(function(h) { return String(h).trim(); });
  const requiredVariantFields = ["SKU", "Option", "Old Price", "New Price", "Stock"];
  requiredVariantFields.forEach(function(field) {
    if (variantHeaders.indexOf(field) < 0) throw new Error("Required VARIANTS field missing: " + field);
  });
  const vi = {};
  requiredVariantFields.forEach(function(field) { vi[field] = variantHeaders.indexOf(field); });

  const variants = {};
  variantRows.slice(1).forEach(function(row) {
    if (String(row[vi.SKU] || "").trim().toUpperCase() !== String(sku).toUpperCase()) return;
    const option = String(row[vi.Option] || "").trim();
    if (!option) return;
    if (Object.prototype.hasOwnProperty.call(variants, option)) throw new Error("Duplicate product variant found");
    variants[option] = {
      oldPrice: Number(row[vi["Old Price"]]),
      newPrice: Number(row[vi["New Price"]]),
      stock: Number(row[vi.Stock])
    };
  });

  product.variants = variants;
  return product;
}
