import { singleLine } from './validation.js';
const from = 'Catherine | Winigen Materials <inquiries@notify.winigenmaterials.com>';
const recipients = ['wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com'];
export function contactEmail(row, kind) {
  const product = singleLine(row.product_interest).slice(0, 200);
  if (kind === 'internal') {
    const identity = singleLine(row.company || row.name || 'Website visitor').slice(0, 160);
    return {
      from, to: recipients, replyTo: 'catherine@winigenmaterials.com',
      subject: `New Winigen inquiry — ${identity}${product ? ` — ${product}` : ''}`,
      text: [
        ['Submission ID', row.id], ['Submission time', new Date(row.created_at).toISOString()],
        ['Name', row.name], ['Company', row.company], ['Email', row.email], ['Inquiry type', row.inquiry_type],
        ['Product', row.product_interest], ['Quantity scale', row.quantity_scale], ['Source page', row.source_page],
        ['Form location', row.form_location], ['Message', row.message]
      ].map(([label, value]) => `${label}: ${value || '(not provided)'}`).join('\n\n')
    };
  }
  const firstName = singleLine(row.name).split(' ')[0] || 'there';
  return {
    from, to: row.email, bcc: recipients, replyTo: 'catherine@winigenmaterials.com',
    subject: `Thanks for contacting Winigen Materials${product ? ` — ${product}` : ''}`,
    text: `Hi ${firstName},\n\nThis is Catherine from Winigen Materials. Thank you for reaching out${product ? ` regarding ${product}` : ' to us'}.\n\nWe’ve received your request and I’ll review the details with our team and get back to you shortly.\n\nIs there anything specific you’d like us to prioritize when we review your request?\n\nThanks and best,\nCatherine\nWinigen Materials`
  };
}
