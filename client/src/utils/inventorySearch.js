export function filterInventoryBySearch(items, query) {
  const term = query.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => {
    const name = (item.name || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    return name.includes(term) || sku.includes(term);
  });
}
