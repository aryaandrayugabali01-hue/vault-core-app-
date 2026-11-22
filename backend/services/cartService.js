const MAX_LINES = 10;
const MAX_LINE_QUANTITY = 5;
const MAX_TOTAL_QUANTITY = 20;

export function normalizeCartItems(input = {}, { testMode = false } = {}) {
  let rawItems = input.items;
  if (!Array.isArray(rawItems) && input.productId !== undefined) {
    rawItems = [{ productId:input.productId, quantity:input.quantity ?? 1 }];
  }
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > MAX_LINES) {
    return { ok:false, error:'INVALID_ORDER_INPUT' };
  }

  const merged = new Map();
  for (const item of rawItems) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity ?? 1);
    if (!Number.isSafeInteger(productId) || productId <= 0
        || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return { ok:false, error:'INVALID_ORDER_INPUT' };
    }
    const next = (merged.get(productId) || 0) + quantity;
    if (next > MAX_LINE_QUANTITY) return { ok:false, error:'INVALID_ORDER_INPUT' };
    merged.set(productId,next);
  }

  const items = [...merged.entries()].map(([productId,quantity])=>({productId,quantity}))
    .sort((a,b)=>a.productId-b.productId);
  const totalQuantity = items.reduce((sum,item)=>sum+item.quantity,0);
  if (totalQuantity > MAX_TOTAL_QUANTITY || (testMode && (items.length !== 1 || totalQuantity > 5))) {
    return { ok:false, error:'INVALID_ORDER_INPUT' };
  }
  return { ok:true, value:{items,totalQuantity} };
}
