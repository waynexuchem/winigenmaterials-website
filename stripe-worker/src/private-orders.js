export const PRIVATE_ORDER_PURPOSE = 'PRIVATE_NEGOTIATED_ORDER';

const googleOrder = Object.freeze({
  orderId: 'WQ20260923-01',
  quotationNumber: 'WQ20260923-01',
  quotationDate: '2026-09-23',
  validThrough: null,
  customerName: 'Google LLC',
  sellerName: 'Winigen Materials LLC',
  billingEmail: 'chuangangl@google.com',
  currency: 'usd',
  productSubtotal: 40000,
  freightTotal: 40000,
  totalAmount: 80000,
  paymentTerms: 'Delivery after payment',
  deliveryEstimate: '12–15 days after receipt of payment',
  incoterms: 'DAP Mountain View, CA',
  buyerResponsibility: 'Import duties, taxes, customs-clearance fees, and unloading are the buyer’s responsibility.',
  checkoutAttemptId: 'private-WQ20260923-01',
  checkoutCartHash: 'PRIVATE_ORDER|WQ20260923-01|KLH-GOG101|2|500G|FREIGHT|1|USD|80000|v2',
  lineItems: Object.freeze([
    Object.freeze({
      kind: 'PRODUCT',
      sku: 'KLH-GOG101',
      productSlug: 'private-hv-lco-si-electrolyte',
      name: 'HV LCO–100% Si Electrolyte (KLH-GOG101) — 500 g',
      grade: 'KLH-GOG101',
      packageLabel: '500 g',
      packageUnit: 'g',
      packageQuantity: 500,
      quantity: 2,
      unitAmount: 20000,
      description: 'KLH-GOG101 · 500 g bottle'
    }),
    Object.freeze({
      kind: 'FREIGHT',
      sku: 'WQ20260923-01-FREIGHT',
      productSlug: 'private-order-freight',
      name: 'FedEx freight',
      grade: 'FedEx freight',
      packageLabel: 'Mountain View delivery',
      packageUnit: 'shipment',
      packageQuantity: 1,
      quantity: 1,
      unitAmount: 40000,
      description: 'FedEx freight · Mountain View, CA'
    })
  ]),
  shippingDestinations: Object.freeze([
    Object.freeze({
      label: 'Delivery destination',
      recipient: 'Chuangang Lin',
      company: 'Google LLC',
      addressLines: Object.freeze([
        '1600 Amphitheatre Pkwy',
        'Mountain View, CA 94043',
        'USA'
      ])
    })
  ])
});

const privateOrders = new Map([[googleOrder.orderId, googleOrder]]);

export function getPrivateOrder(orderId) {
  return privateOrders.get(orderId) || null;
}

export function toCustomerSafePrivateOrder(order) {
  return {
    orderId: order.orderId,
    quotationNumber: order.quotationNumber,
    quotationDate: order.quotationDate,
    validThrough: order.validThrough,
    customerName: order.customerName,
    sellerName: order.sellerName,
    currency: order.currency.toUpperCase(),
    productSubtotal: order.productSubtotal,
    freightTotal: order.freightTotal,
    totalAmount: order.totalAmount,
    paymentTerms: order.paymentTerms,
    deliveryEstimate: order.deliveryEstimate,
    incoterms: order.incoterms,
    buyerResponsibility: order.buyerResponsibility,
    lineItems: order.lineItems.map(item => ({
      kind: item.kind,
      sku: item.sku,
      name: item.name,
      packageLabel: item.packageLabel,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      lineTotal: item.unitAmount * item.quantity
    })),
    shippingDestinations: order.shippingDestinations.map(destination => ({
      label: destination.label,
      recipient: destination.recipient,
      company: destination.company,
      addressLines: [...destination.addressLines]
    }))
  };
}
