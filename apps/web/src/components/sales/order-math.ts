/** Cálculo igual ao da API (orders.service.ts): desconto sobre o bruto, IVA sobre o líquido. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface LineInput {
  price: number;
  taxRate: number;
  quantity: number;
  discountPct: number;
}

export function lineTotals({ price, taxRate, quantity, discountPct }: LineInput) {
  const gross = price * quantity;
  const discount = gross * (discountPct / 100);
  const tax = (gross - discount) * (taxRate / 100);
  return { gross, discount, tax, total: round2(gross - discount + tax) };
}

export function orderTotals(lines: LineInput[]) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  for (const l of lines) {
    const t = lineTotals(l);
    subtotal += t.gross;
    discount += t.discount;
    tax += t.tax;
  }
  return { subtotal: round2(subtotal), discount: round2(discount), tax: round2(tax), total: round2(subtotal - discount + tax) };
}
