import { Injectable, Logger } from '@nestjs/common';

/**
 * Thin wrapper around the Meta WhatsApp Cloud API. Until WHATSAPP_ACCESS_TOKEN
 * and WHATSAPP_PHONE_NUMBER_ID are set, every send is logged instead of
 * actually posted — safe to run in every environment without credentials.
 *
 * Meta only allows free-form text outside an open 24h customer-service
 * window if the recipient messaged the business number first; proactive
 * notifications outside that window need a pre-approved message template
 * (see WHATSAPP_TEMPLATE_NAME). sendText() is the simple path for now —
 * swap in sendTemplate() once templates are approved in Meta Business
 * Manager for fully proactive delivery.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly token = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v21.0';

  get configured() {
    return !!(this.token && this.phoneNumberId);
  }

  async sendText(toE164: string, body: string) {
    if (!this.configured) {
      this.logger.log(`[WhatsApp mock] would send to ${toE164}: ${body}`);
      return { mocked: true };
    }
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toE164,
          type: 'text',
          text: { body },
        }),
      });
      if (!res.ok) {
        this.logger.error(`WhatsApp send failed (${res.status}): ${await res.text()}`);
        return { ok: false };
      }
      return { ok: true, response: await res.json() };
    } catch (err) {
      this.logger.error(`WhatsApp send threw: ${(err as Error).message}`);
      return { ok: false };
    }
  }
}
