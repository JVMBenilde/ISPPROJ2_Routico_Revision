const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');

// POST /predict - Generate AI predictions from order data
router.post('/predict', requirePerm('use_ai_analytics'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) return res.status(403).json({ error: 'No owner profile' });
    const ownerId = ownerResult[0].owner_id;

    // Gather order data
    const [orders] = await db.query(
      `SELECT o.order_status, o.delivery_fee, o.pickup_location, o.drop_off_location,
              o.scheduled_delivery_time, o.order_created_at, o.weight, o.size,
              c.company_name as customer_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       WHERE o.business_owner_id = ?
       ORDER BY o.order_created_at DESC
       LIMIT 200`,
      [ownerId]
    );

    const [drivers] = await db.query(
      'SELECT status, rides_completed FROM drivers WHERE owner_id = ?',
      [ownerId]
    );

    const [issues] = await db.query(
      `SELECT i.status, ic.category_name, i.reported_at
       FROM issues i
       LEFT JOIN issuescategories ic ON i.category_id = ic.category_id
       WHERE i.reported_by = ?
       ORDER BY i.reported_at DESC
       LIMIT 50`,
      [userId]
    );

    // Build summaries
    const orderSummary = { total: orders.length, byStatus: {}, totalRevenue: 0, avgFee: 0 };
    orders.forEach(o => {
      orderSummary.byStatus[o.order_status] = (orderSummary.byStatus[o.order_status] || 0) + 1;
      orderSummary.totalRevenue += parseFloat(o.delivery_fee || 0);
    });
    orderSummary.avgFee = orders.length > 0 ? orderSummary.totalRevenue / orders.length : 0;

    const driverSummary = {
      total: drivers.length,
      active: drivers.filter(d => d.status === 'active').length,
      totalRides: drivers.reduce((sum, d) => sum + (d.rides_completed || 0), 0)
    };

    const issueSummary = { total: issues.length, byCategory: {}, byStatus: {} };
    issues.forEach(i => {
      if (i.category_name) issueSummary.byCategory[i.category_name] = (issueSummary.byCategory[i.category_name] || 0) + 1;
      issueSummary.byStatus[i.status] = (issueSummary.byStatus[i.status] || 0) + 1;
    });

    const recentOrders = orders.slice(0, 30).map(o => ({
      status: o.order_status,
      fee: o.delivery_fee,
      pickup: o.pickup_location,
      dropoff: o.drop_off_location,
      scheduled: o.scheduled_delivery_time,
      created: o.order_created_at,
      customer: o.customer_name
    }));

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI analytics not configured. Set ANTHROPIC_API_KEY in server/.env' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const prompt = `You are a logistics and delivery business analyst. Analyze the following business data and provide actionable insights.

## Business Data

### Orders (up to last 200)
- Total orders: ${orderSummary.total}
- Status breakdown: ${JSON.stringify(orderSummary.byStatus)}
- Total revenue: PHP ${orderSummary.totalRevenue.toLocaleString()}
- Average delivery fee: PHP ${orderSummary.avgFee.toFixed(2)}
- Recent orders sample: ${JSON.stringify(recentOrders.slice(0, 10))}

### Drivers
- Total drivers: ${driverSummary.total}
- Active drivers: ${driverSummary.active}
- Total rides completed: ${driverSummary.totalRides}

### Issues/Complaints
- Total issues: ${issueSummary.total}
- By category: ${JSON.stringify(issueSummary.byCategory)}
- By status: ${JSON.stringify(issueSummary.byStatus)}

## Required Analysis
Provide your response as valid JSON with these exact keys:
{
  "demandForecast": "string - predict busy periods and demand trends",
  "performanceInsights": "string - analyze delivery completion rates and bottlenecks",
  "revenueOptimization": "string - suggest ways to increase revenue",
  "riskAlerts": "string - identify concerning trends",
  "driverUtilization": "string - assess driver pool sufficiency",
  "recommendations": ["array of 3-5 specific actionable recommendations"]
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const aiResponse = message.content[0].text;

    let insights;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: aiResponse };
    } catch {
      insights = { raw: aiResponse };
    }

    res.json({
      insights,
      dataSnapshot: {
        totalOrders: orderSummary.total,
        totalRevenue: orderSummary.totalRevenue,
        activeDrivers: driverSummary.active,
        openIssues: issueSummary.byStatus['open'] || 0
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating AI analytics:', error);
    res.status(500).json({ error: 'Failed to generate AI analytics', details: error.message });
  }
});

module.exports = router;
