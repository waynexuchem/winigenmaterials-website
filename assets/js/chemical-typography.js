/* Display-only chemistry notation. Never use this to rewrite SKUs, URLs or commerce data. */
(() => {
  const formulas = `Al2O3 C12H10 C12H16 C18H15O3P C2BF2LiO4 C2BF2NaO4 C2H4O3S C2H4O4S C2H4O6S2 C3H2O3 C3H3FO3 C3H4O3 C3H6O2 C3H6O3 C3H6O4S C4BLiO8 C4F2LiO8P C4H10O2 C4H4N2 C4H5F3O3 C4H6O3 C4H8O2 C4H8O3 C4H8O3S C5H10O2 C5H10O3 C5H4F6O3 C5H4F8O C5H6O3 C6H12O2 C6H12O6S2 C6H19NSi2 C6H5F C6H8N2 C8H12N2O2 C8H12Si C9H11N3 C9H15O4P C9H33O6PSi3 F2NNaO4S2 F2NaO2P KPF6 Li5.5PS4.5Cl1.5 Li5.5PS4.5ClxBr1.5-x Li6PS5Cl LiBF4 LiN(CF3SO2)2 LiN(SO2F)2 LiNO3 LiPF6 LiPO2F2 Mo2C Mo2CTx N2 NaPF6 NaPO2F2 Nb2C Nb2CTx PF6 Ti3C2 Ti3C2Tx V2C V2CTx SiOx`.split(' ');
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![A-Za-z0-9_\\-])(${formulas.sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})(?![A-Za-z0-9_])`, 'g');
  const subscript = formula => formula.replace(/\d+(?:\.\d+)?(?:-x)?|x/g, value => `<sub>${value}</sub>`);
  const format = text => text.replace(pattern, subscript);
  const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  globalThis.WinigenChemicalTypography = Object.freeze({ format, html: text => format(escapeHtml(text)) });
})();
