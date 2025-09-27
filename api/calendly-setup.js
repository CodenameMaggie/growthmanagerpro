// Calendly Webhook Setup API
// Add this as api/calendly-setup.js

const CALENDLY_TOKEN = process.env.CALENDLY_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!CALENDLY_TOKEN) {
    return res.status(400).json({
      ok: false,
      error: 'Calendly token not configured',
      setup_needed: true,
      instructions: 'Add CALENDLY_TOKEN to your Vercel environment variables'
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Check current webhook status
        const webhooksResponse = await fetch('https://api.calendly.com/webhook_subscriptions', {
          headers: {
            'Authorization': `Bearer ${CALENDLY_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!webhooksResponse.ok) {
          throw new Error(`Failed to fetch webhooks: ${webhooksResponse.status}`);
        }

        const webhooks = await webhooksResponse.json();
        
        return res.status(200).json({
          ok: true,
          existing_webhooks: webhooks.collection,
          webhook_url: `${req.headers.origin || 'https://your-domain.vercel.app'}/api/prospects`,
          status: webhooks.collection.length > 0 ? 'configured' : 'needs_setup'
        });

      case 'POST':
        // Create webhook subscription
        const { events = ['invitee.created', 'invitee.canceled'] } = req.body;
        const webhookUrl = `${req.headers.origin || req.headers.host}/api/prospects`;

        // Get user/organization info first
        const userResponse = await fetch('https://api.calendly.com/users/me', {
          headers: {
            'Authorization': `Bearer ${CALENDLY_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!userResponse.ok) {
          throw new Error(`Failed to get user info: ${userResponse.status}`);
        }

        const userData = await userResponse.json();
        const organizationUri = userData.resource.current_organization;

        // Create webhook subscription
        const createWebhookResponse = await fetch('https://api.calendly.com/webhook_subscriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CALENDLY_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: webhookUrl,
            events: events,
            organization: organizationUri,
            scope: 'organization'
          })
        });

        if (!createWebhookResponse.ok) {
          const errorData = await createWebhookResponse.text();
          throw new Error(`Failed to create webhook: ${createWebhookResponse.status} - ${errorData}`);
        }

        const newWebhook = await createWebhookResponse.json();

        return res.status(201).json({
          ok: true,
          webhook: newWebhook.resource,
          message: 'Webhook created successfully',
          next_steps: [
            'Webhook is now active',
            'New Calendly bookings will automatically sync to your dashboard',
            'Check your dashboard for live data updates'
          ]
        });

      default:
        return res.status(405).json({
          ok: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Calendly setup error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to setup Calendly integration',
      message: error.message,
      troubleshooting: [
        'Verify your Calendly token has webhook permissions',
        'Check that your Calendly account is on a paid plan',
        'Ensure the webhook URL is accessible from the internet'
      ]
    });
  }
}
