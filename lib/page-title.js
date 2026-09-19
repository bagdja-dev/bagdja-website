function resolvePageHeadingLabel({ productName, platformName, fallbackTitle } = {}) {
  const cleanProduct = typeof productName === 'string' ? productName.trim() : '';
  const cleanPlatform = typeof platformName === 'string' ? platformName.trim() : '';
  const cleanFallback = typeof fallbackTitle === 'string' ? fallbackTitle.trim() : '';

  if (cleanProduct) return cleanProduct;
  if (cleanPlatform) return cleanPlatform;
  return cleanFallback || 'Produk';
}

module.exports = {
  resolvePageHeadingLabel,
};
