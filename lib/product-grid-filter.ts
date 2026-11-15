/** Filter section Daftar Produk/Jasa: tipe (`all`/kosong = semua) + beberapa kategori (kosong = semua). */
export interface ProductGridFilter {
  type?: string;
  categoryIds: string[];
}

export function productGridFilter(content: Record<string, unknown>, fallbackType?: string): ProductGridFilter {
  const raw = typeof content.filter_type === 'string' && content.filter_type ? content.filter_type : fallbackType;
  const categoryIds = Array.isArray(content.category_ids)
    ? content.category_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  return { type: raw && raw !== 'all' ? raw : undefined, categoryIds };
}

export function matchesProductGridFilter(item: { type: string; categoryId?: string }, filter: ProductGridFilter): boolean {
  if (filter.type && item.type !== filter.type) return false;
  if (filter.categoryIds.length > 0 && (!item.categoryId || !filter.categoryIds.includes(item.categoryId))) return false;
  return true;
}

