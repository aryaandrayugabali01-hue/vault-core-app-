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
  const sensitiveLabel = /(login|password|sandi|otp|session|recovery|backup|token|credential|email|username|cookie)/i;
  for (const item of rawItems) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity ?? 1);
    if (!Number.isSafeInteger(productId) || productId <= 0
        || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return { ok:false, error:'INVALID_ORDER_INPUT' };
    }
    const rawCustomerInput = item?.customerInput ?? {};
    if (!rawCustomerInput || typeof rawCustomerInput !== 'object' || Array.isArray(rawCustomerInput)
        || Object.keys(rawCustomerInput).length > 12) return { ok:false, error:'INVALID_CUSTOMER_INPUT' };
    const customerInput = {};
    for (const [rawLabel,rawValue] of Object.entries(rawCustomerInput)) {
      const label = String(rawLabel).trim();
      const value = String(rawValue ?? '').trim();
      if (!label || label.length>80 || sensitiveLabel.test(label) || value.length>240) {
        return { ok:false,error:'INVALID_CUSTOMER_INPUT' };
      }
      customerInput[label]=value;
    }
    const existing=merged.get(productId);
    if (existing && JSON.stringify(existing.customerInput)!==JSON.stringify(customerInput)) {
      return { ok:false,error:'DUPLICATE_PRODUCT_INPUT_MISMATCH' };
    }
    const next=(existing?.quantity||0)+quantity;
    if(next>MAX_LINE_QUANTITY)return {ok:false,error:'INVALID_ORDER_INPUT'};
    merged.set(productId,{quantity:next,customerInput});
  }
  const items=[...merged.entries()].map(([productId,value])=>({productId,quantity:value.quantity,customerInput:value.customerInput}))
    .sort((a,b)=>a.productId-b.productId);
  const totalQuantity = items.reduce((sum,item)=>sum+item.quantity,0);
  if (totalQuantity > MAX_TOTAL_QUANTITY || (testMode && (items.length !== 1 || totalQuantity > 5))) {
    return { ok:false, error:'INVALID_ORDER_INPUT' };
  }
  return { ok:true, value:{items,totalQuantity} };
}
