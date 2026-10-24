import { createHash } from 'node:crypto';

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

const octoberGoogleQuote = {
  orderId: 'WQ20261021-01',
  quotationNumber: 'WQ20261021-01',
  quotationDate: '2026-10-21',
  validThrough: '2026-10-31',
  customerName: 'Google, LLC',
  sellerName: 'Winigen Materials LLC',
  currency: 'usd',
  productSubtotal: 75000,
  discountTotal: 0,
  freightTotal: 54000,
  taxTotal: 0,
  totalAmount: 129000,
  paymentTerms: '100% advance payment',
  deliveryEstimate: '15–20 days after receipt of payment',
  incoterms: 'DAP to the USA',
  buyerResponsibility: 'Applicable import duties, import taxes, and customs-clearance charges, if any, are excluded.',
  checkoutAttemptId: 'private-WQ20261021-01',
  checkoutApprovalEnv: 'PRIVATE_ORDER_WQ20261021_01_ZERO_TAX_APPROVED',
  strictSessionValidation: true,
  sellerContact: Object.freeze({ name: 'Catherine Wen', email: 'catherine@winigenmaterials.com' }),
  // Fulfillment contact stays in the server-held definition and internal notification only.
  fulfillmentContact: Object.freeze({ phone: '650-793-8069' }),
  lineItems: Object.freeze([
    Object.freeze({
      kind: 'PRODUCT', sku: 'LB212C-42', productSlug: 'private-cnt-lb212c-42',
      name: 'CNT LB212C-42', grade: 'Water Paste: 0.4%wt (FT2020), 0.6% dispersant',
      packageLabel: '1 kg bottle', packageUnit: 'kg', packageQuantity: 1,
      quantity: 4, unitAmount: 9600,
      description: 'Water Paste: 0.4%wt (FT2020), 0.6% dispersant · 1 kg bottle'
    }),
    Object.freeze({
      kind: 'PRODUCT', sku: 'LB212C-82', productSlug: 'private-cnt-lb212c-82',
      name: 'CNT LB212C-82', grade: 'Water Paste: 0.8%wt (FT2020), 1.2% dispersant',
      packageLabel: '1 kg bottle', packageUnit: 'kg', packageQuantity: 1,
      quantity: 1, unitAmount: 12000,
      description: 'Water Paste: 0.8%wt (FT2020), 1.2% dispersant · 1 kg bottle'
    }),
    Object.freeze({
      kind: 'PRODUCT', sku: 'LB112B-41', productSlug: 'private-cnt-lb112b-41',
      name: 'CNT LB112B-41', grade: 'NMP Paste: 0.4%wt (FT2020); 0.4% dispersant',
      packageLabel: '1 kg bottle', packageUnit: 'kg', packageQuantity: 1,
      quantity: 1, unitAmount: 9600,
      description: 'NMP Paste: 0.4%wt (FT2020); 0.4% dispersant · 1 kg bottle'
    }),
    Object.freeze({
      kind: 'PRODUCT', sku: 'WM-PRIVATE-WQ20261021-01-SP200',
      productSlug: 'private-conductive-carbon-black-sp200',
      name: 'Conductive carbon black', grade: 'SP 200',
      packageLabel: '500 g bag', packageUnit: 'g', packageQuantity: 500,
      quantity: 1, unitAmount: 15000, description: 'SP 200 · 500 g bag'
    }),
    Object.freeze({
      kind: 'FREIGHT', sku: 'WM-PRIVATE-WQ20261021-01-FREIGHT',
      productSlug: 'private-order-freight', name: 'Freight', grade: 'Fixed quoted freight',
      packageLabel: 'Mountain View delivery', packageUnit: 'shipment', packageQuantity: 1,
      quantity: 1, unitAmount: 54000, description: 'Fixed quoted freight · DAP to the USA'
    })
  ]),
  shippingDestinations: Object.freeze([
    Object.freeze({
      label: 'Delivery destination', recipient: 'Qiang Xie', company: 'Google, LLC',
      addressLines: Object.freeze(['1600 Amphitheatre Parkway', 'Mountain View, CA 94043', 'USA'])
    })
  ])
};
const octoberGoogleOrder = Object.freeze({
  ...octoberGoogleQuote,
  checkoutCartHash: 'PRIVATE_ORDER|sha256:' + createHash('sha256')
    .update(JSON.stringify(octoberGoogleQuote)).digest('hex')
});

const privateOrders = new Map([
  [googleOrder.orderId, googleOrder],
  [octoberGoogleOrder.orderId, octoberGoogleOrder]
]);

export function isPrivateOrderCheckoutEnabled(order, env = {}) {
  return !order.checkoutApprovalEnv || env[order.checkoutApprovalEnv] === 'true';
}

export function getPrivateOrder(orderId) {
  return privateOrders.get(orderId) || null;
}

export function toCustomerSafePrivateOrder(order, env = {}) {
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
    ...(order.discountTotal !== undefined ? {
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      checkoutEnabled: isPrivateOrderCheckoutEnabled(order, env),
      checkoutMessage: isPrivateOrderCheckoutEnabled(order, env) ? '' : 'Payment is disabled pending sales-tax approval.'
    } : {}),
    totalAmount: order.totalAmount,
    paymentTerms: order.paymentTerms,
    deliveryEstimate: order.deliveryEstimate,
    incoterms: order.incoterms,
    buyerResponsibility: order.buyerResponsibility,
    lineItems: order.lineItems.map(item => ({
      kind: item.kind,
      sku: item.sku,
      name: item.name,
      ...(order.strictSessionValidation && item.kind === 'PRODUCT' ? { specification: item.grade } : {}),
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
