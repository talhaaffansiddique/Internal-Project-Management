export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required?: boolean;
  options?: string[];
  help?: string;
}

export interface TicketForm {
  type: string;
  label: string;
  fields: FormField[];
}

/**
 * Conditional forms per request type (brief §8.1–8.2).
 * Keys match Master Data `ticket_types` values. A fully DB-driven form
 * builder is deferred (§27) — for v1.0 the field sets live here.
 */
export const TICKET_FORMS: Record<string, TicketForm> = {
  erp_issue: {
    type: 'erp_issue',
    label: 'ERP Issue',
    fields: [
      { name: 'erpModule', label: 'ERP module', type: 'text', required: true, help: 'e.g. General Ledger, Inventory' },
      { name: 'whatTrying', label: 'What were you trying to do?', type: 'textarea', required: true },
      { name: 'whatWentWrong', label: 'What went wrong?', type: 'textarea', required: true },
      { name: 'errorMessage', label: 'Error message (exact text)', type: 'textarea' },
    ],
  },
  it_issue: {
    type: 'it_issue',
    label: 'IT / Computer Issue',
    fields: [
      { name: 'device', label: 'Device / asset', type: 'text', help: 'laptop, printer, monitor…' },
      { name: 'problem', label: 'What is the problem?', type: 'textarea', required: true },
      { name: 'whenStarted', label: 'When did it start?', type: 'text' },
    ],
  },
  training_request: {
    type: 'training_request',
    label: 'Training Request',
    fields: [
      { name: 'topic', label: 'Training topic', type: 'text', required: true },
      { name: 'headcount', label: 'How many people?', type: 'text' },
      { name: 'reason', label: 'Business reason', type: 'textarea' },
    ],
  },
  procurement_request: {
    type: 'procurement_request',
    label: 'Procurement Request',
    fields: [
      { name: 'kind', label: 'Product or service?', type: 'select', options: ['Product', 'Service'], required: true },
      { name: 'item', label: 'Item / service description', type: 'textarea', required: true },
      { name: 'quantity', label: 'Quantity (if applicable)', type: 'text' },
      { name: 'reason', label: 'Business reason', type: 'textarea', required: true },
    ],
  },
  access_request: {
    type: 'access_request',
    label: 'Access / Account Request',
    fields: [
      { name: 'system', label: 'System / application', type: 'text', required: true },
      { name: 'accessLevel', label: 'Access level needed', type: 'text' },
      { name: 'reason', label: 'Reason for access', type: 'textarea', required: true },
    ],
  },
  general_request: {
    type: 'general_request',
    label: 'General Internal Request / Other',
    fields: [
      { name: 'details', label: 'Details', type: 'textarea', required: true },
    ],
  },
};

export function getForm(type: string): TicketForm | undefined {
  return TICKET_FORMS[type];
}
