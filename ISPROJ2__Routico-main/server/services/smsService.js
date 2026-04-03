class SMSService {
  constructor() {
    this.enabled = !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET);
    this.from = process.env.VONAGE_SMS_FROM || 'Routico';
    if (this.enabled) {
      this.apiKey = process.env.VONAGE_API_KEY;
      this.apiSecret = process.env.VONAGE_API_SECRET;
      console.log('SMS Service initialized (Vonage)');
    } else {
      console.log('SMS Service disabled (Vonage credentials not configured)');
    }
  }

  formatPhNumber(number) {
    if (!number) return null;
    const cleaned = number.replace(/[^0-9+]/g, '');
    // Philippine format: 09xx -> 639xx (Vonage uses no + prefix)
    if (cleaned.startsWith('+63')) return cleaned.substring(1);
    if (cleaned.startsWith('09')) return '63' + cleaned.substring(1);
    if (cleaned.startsWith('63')) return cleaned;
    if (cleaned.startsWith('+')) return cleaned.substring(1);
    return cleaned;
  }

  async send(toNumber, message) {
    const formatted = this.formatPhNumber(toNumber);
    if (!formatted) return null;

    if (!this.enabled) {
      console.log(`[SMS Disabled] To: ${formatted} | Message: ${message}`);
      return null;
    }

    try {
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          api_secret: this.apiSecret,
          to: formatted,
          from: this.from,
          text: message
        })
      });

      const data = await response.json();
      const msg = data.messages?.[0];

      if (msg?.status === '0') {
        console.log(`[SMS Sent] To: ${formatted} | ID: ${msg['message-id']}`);
        return msg;
      } else {
        console.error(`[SMS Error] To: ${formatted} | Status: ${msg?.status} | Error: ${msg?.['error-text']}`);
        return null;
      }
    } catch (error) {
      console.error(`[SMS Error] To: ${formatted} | Error: ${error.message}`);
      return null;
    }
  }
}

module.exports = SMSService;
