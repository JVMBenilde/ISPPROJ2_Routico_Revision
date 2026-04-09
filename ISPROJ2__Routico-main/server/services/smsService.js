const { Vonage } = require('@vonage/server-sdk');

class SMSService {
  constructor() {
    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    this.senderName = process.env.VONAGE_FROM || 'Routico';
    this.enabled = !!(apiKey && apiSecret);

    if (this.enabled) {
      this.client = new Vonage({ apiKey, apiSecret });
      console.log('SMS Service initialized (Vonage)');
    } else {
      this.client = null;
      console.log('SMS Service disabled (Vonage API key/secret not configured)');
    }
  }

  formatPhNumber(number) {
    if (!number) return null;
    const cleaned = String(number).trim().replace(/[^0-9+]/g, '');

    if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
    if (/^\+63\d{10}$/.test(cleaned)) return cleaned;
    if (/^63\d{10}$/.test(cleaned)) return `+${cleaned}`;

    return null;
  }

  async send(toNumber, message) {
    const formatted = this.formatPhNumber(toNumber);
    if (!formatted) return null;

    if (!this.enabled) {
      console.log(`[SMS Disabled] To: ${formatted} | Message: ${message}`);
      return null;
    }

    try {
      const response = await this.client.sms.send({
        to: formatted,
        from: this.senderName,
        text: message
      });

      const msg = response.messages[0];
      if (msg.status !== '0') {
        console.error(`[SMS Error] To: ${formatted} | Vonage Error: ${msg['error-text'] || `status ${msg.status}`}`);
        return null;
      }

      console.log(`[SMS Sent] To: ${formatted} | ID: ${msg['message-id']} | Status: ${msg.status}`);
      return msg;
    } catch (error) {
      console.error(`[SMS Error] To: ${formatted} | Error: ${error.message}`);
      return null;
    }
  }
}

module.exports = SMSService;
