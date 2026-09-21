const approvedPublicTdsPath = /^\/assets\/documents\/tds\/Winigen_(?:[A-Za-z0-9_]+_Representative_TDS_RevB|[A-Za-z0-9]+_Representative_TDS|MB_Battery_Grade_TDS)\.pdf$/;

export function isApprovedPublicTdsPath(path) {
  return approvedPublicTdsPath.test(path);
}
