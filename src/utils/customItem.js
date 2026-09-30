/**
 * Custom item wire format serializer and parser.
 * Encodes custom "Other" item names safely using bracket escaping (\] and \\)
 * so names containing ] (e.g. "Adapter [Type-C]") round-trip without truncation or stray text.
 */

export function serializeCustomItem(name = '', remarks = '') {
  const trimmedName = String(name).trim();
  const escapedName = trimmedName.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
  const trimmedRemarks = String(remarks ?? '').trim();
  return `[Custom item: ${escapedName}]${trimmedRemarks ? ` — ${trimmedRemarks}` : ''}`;
}

export function parseCustomItem(item, remarks) {
  if (item?.code !== 'OTHER') {
    return { displayName: item?.name ?? '—', displayRemarks: remarks ?? null };
  }
  const str = String(remarks ?? '');
  const match = /^\[Custom item: ((?:\\\]|[^\]])+)\](?:\s*—\s*)?(.*)$/s.exec(str);
  if (match) {
    const rawName = match[1];
    const unescapedName = rawName.replace(/\\\]/g, ']').replace(/\\\\/g, '\\').trim();
    const displayRemarks = match[2].trim() || null;
    return { displayName: unescapedName, displayRemarks };
  }
  return { displayName: 'Other (custom item)', displayRemarks: remarks ?? null };
}
