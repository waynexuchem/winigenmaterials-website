export const PRIVATE_ORDER_PURPOSE = 'PRIVATE_NEGOTIATED_ORDER';

const googleOrder = Object.freeze({
  orderId: 'WQ20260922-01',
  quotationNumber: 'WQ20260922-01',
  quotationDate: '2026-09-22',
  validThrough: '2026-09-29',
  customerName: 'Google LLC',
  sellerName: 'Winigen Materials LLC',
  billingEmail: 'chuangangl@google.com',
  currency: 'usd',
  productSubtotal: 40000,
  freightTotal: 60000,
  totalAmount: 100000,
  paymentTerms: 'Delivery after payment',
  deliveryEstimate: '14–21 days after receipt of payment',
  incoterms: 'DAP Mountain View, CA / DAP Newberry, IN',
  buyerResponsibility: 'Import duties, taxes, customs-clearance fees, and unloading are the buyer’s responsibility.',
  checkoutAttemptId: 'private-WQ20260922-01',
  checkoutCartHash: 'PRIVATE_ORDER|WQ20260922-01|KLH-GOG101|2|500G|FREIGHT|1|USD|100000|v2',
  lineItems: Object.freeze([
    Object.freeze({
      kind: 'PRODUCT',
      sku: 'KLH-GOG101',
      productSlug: 'private-hv-lco-si-electrolyte',
      name: 'HV LCO–Si Electrolyte',
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
      sku: 'WQ20260922-01-FREIGHT',
      productSlug: 'private-order-freight',
      name: 'FedEx Air freight',
      grade: 'Split shipment',
      packageLabel: 'Two destinations',
      packageUnit: 'shipment',
      packageQuantity: 1,
      quantity: 1,
      unitAmount: 60000,
      description: 'FedEx Air · split shipment to Mountain View, CA and Newberry, IN'
    })
  ]),
  shippingDestinations: Object.freeze([
    Object.freeze({
      label: 'Shipment 1 of 2',
      recipient: 'Chuangang Lin',
      company: 'Google LLC',
      addressLines: Object.freeze([
        '1600 Amphitheatre Pkwy',
        'Mountain View, CA 94043',
        'USA'
      ])
    }),
    Object.freeze({
      label: 'Shipment 2 of 2',
      recipient: 'Swapneel Kulkarni',
      company: '',
      addressLines: Object.freeze([
        '7970 S Energy Dr.',
        'Newberry, IN 47449',
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
