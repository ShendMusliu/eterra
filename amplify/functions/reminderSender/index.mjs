import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_WHATSAPP_FROM;

export const handler = async (event) => {
  // Support both direct invocation and API Gateway payload
  const body = event?.body ? JSON.parse(event.body) : event;
  const { message, recipient } = body || {};

  if (!message || !recipient) {
    return { statusCode: 400, body: 'Missing message or recipient' };
  }

  try {
    await client.messages.create({
      from: FROM,
      to: recipient.startsWith('whatsapp:') ? recipient : `whatsapp:${recipient}`,
      body: message,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error('Twilio send failed', error);
    return { statusCode: 500, body: 'Failed to send reminder' };
  }
};
