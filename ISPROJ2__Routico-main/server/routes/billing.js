const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');
const BillingStatementService = require('../services/billingStatementService');
const { createObjectCsvStringifier } = require('csv-writer');
const PDFDocument = require('pdfkit');

/**
 * Download billing statement as CSV
 * @route GET /api/billing/statement/:period/download/csv
 * @access Private (Business Owner)
 */
router.get('/statement/:period/download/csv', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const period = req.params.period; // Format: YYYY-MM
    
    // Get owner_id from businessowners table
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    
    const ownerId = ownerResult[0].owner_id;
    
    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'Invalid period format. Use YYYY-MM.' });
    }
    
    const billingStatementService = new BillingStatementService(db);
    
    // Get statement data
    const statement = await billingStatementService.getStatementByPeriod(ownerId, period);
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found for the specified period.' });
    }
    
    // Get order details for the period
    const [orders] = await db.query(
      `SELECT 
        o.order_id,
        o.pickup_location,
        o.drop_off_location,
        o.delivery_fee,
        o.scheduled_delivery_time,
        o.order_status,
        o.order_created_at
      FROM orders o
      WHERE o.business_owner_id = ?
      AND DATE_FORMAT(o.order_created_at, '%Y-%m') = ?
      ORDER BY o.order_created_at ASC`,
      [ownerId, period]
    );
    
    // Create CSV header
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'order_id', title: 'Order ID' },
        { id: 'date', title: 'Date' },
        { id: 'pickup', title: 'Pickup Location' },
        { id: 'dropoff', title: 'Drop-off Location' },
        { id: 'status', title: 'Status' },
        { id: 'delivery_fee', title: 'Delivery Fee (₱)' },
        { id: 'commission', title: 'Commission (₱)' }
      ]
    });
    
    // Format order data for CSV
    const orderRecords = orders.map(order => ({
      order_id: order.order_id,
      date: new Date(order.order_created_at).toLocaleDateString(),
      pickup: order.pickup_location,
      dropoff: order.drop_off_location,
      status: order.order_status,
      delivery_fee: parseFloat(order.delivery_fee || 0).toFixed(2),
      commission: '10.00' // Fixed commission per delivery
    }));
    
    // Add summary rows
    const summaryRecords = [
      {
        order_id: '',
        date: '',
        pickup: '',
        dropoff: '',
        status: '',
        delivery_fee: '',
        commission: ''
      },
      {
        order_id: '',
        date: '',
        pickup: '',
        dropoff: 'Total Orders:',
        status: orders.length,
        delivery_fee: '',
        commission: ''
      },
      {
        order_id: '',
        date: '',
        pickup: '',
        dropoff: 'Total Delivery Fees:',
        status: '',
        delivery_fee: parseFloat(statement.delivery_fee).toFixed(2),
        commission: ''
      },
      {
        order_id: '',
        date: '',
        pickup: '',
        dropoff: 'Total Commission:',
        status: '',
        delivery_fee: '',
        commission: (orders.length * 10).toFixed(2)
      },
      {
        order_id: '',
        date: '',
        pickup: '',
        dropoff: 'Base Fee:',
        status: '',
        delivery_fee: '',
        commission: parseFloat(statement.base_fee).toFixed(2)
      },
      {
        order_id: '',
        date: '',
        pickup: '',
        dropoff: 'TOTAL DUE:',
        status: '',
        delivery_fee: '',
        commission: parseFloat(statement.total_due).toFixed(2)
      }
    ];
    
    // Generate CSV content
    const csvContent = csvStringifier.getHeaderString() + 
                       csvStringifier.stringifyRecords(orderRecords) +
                       csvStringifier.stringifyRecords(summaryRecords);
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="billing-statement-${period}.csv"`);
    
    // Send CSV response
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error generating CSV statement:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate CSV statement', details: error.message });
  }
});

/**
 * Download billing statement as PDF
 * @route GET /api/billing/statement/:period/download/pdf
 * @access Private (Business Owner)
 */
router.get('/statement/:period/download/pdf', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const period = req.params.period; // Format: YYYY-MM
    
    // Get owner_id from businessowners table
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    
    const ownerId = ownerResult[0].owner_id;
    
    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'Invalid period format. Use YYYY-MM.' });
    }
    
    const billingStatementService = new BillingStatementService(db);
    
    // Get statement data
    const statement = await billingStatementService.getStatementByPeriod(ownerId, period);
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found for the specified period.' });
    }
    
    // Get order details for the period
    const [orders] = await db.query(
      `SELECT 
        o.order_id,
        o.pickup_location,
        o.drop_off_location,
        o.delivery_fee,
        o.scheduled_delivery_time,
        o.order_status,
        o.order_created_at
      FROM orders o
      WHERE o.business_owner_id = ?
      AND DATE_FORMAT(o.order_created_at, '%Y-%m') = ?
      ORDER BY o.order_created_at ASC`,
      [ownerId, period]
    );
    
    // Get business owner details
    const [ownerDetails] = await db.query(
      `SELECT 
        bo.company_name,
        u.full_name,
        u.email
      FROM businessowners bo
      JOIN users u ON bo.user_id = u.user_id
      WHERE bo.owner_id = ?`,
      [ownerId]
    );
    
    const owner = ownerDetails[0] || { company_name: 'Business Owner', full_name: '', email: '' };
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="billing-statement-${period}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('Billing Statement', { align: 'center' });
    doc.moveDown();
    
    // Statement period and details
    doc.fontSize(12).text(`Period: ${period}`, { align: 'left' });
    doc.text(`Statement Date: ${new Date(statement.statement_date).toLocaleDateString()}`);
    doc.text(`Due Date: ${new Date(statement.due_date).toLocaleDateString()}`);
    doc.text(`Status: ${statement.status.toUpperCase()}`);
    doc.moveDown();
    
    // Business owner details
    doc.fontSize(14).text('Business Details', { underline: true });
    doc.fontSize(12).text(`Company: ${owner.company_name}`);
    doc.text(`Contact: ${owner.full_name}`);
    doc.text(`Email: ${owner.email}`);
    doc.moveDown();
    
    // Orders table
    doc.fontSize(14).text('Orders', { underline: true });
    doc.moveDown(0.5);
    
    // Table headers
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [40, 70, 100, 100, 60, 70, 60];
    
    doc.fontSize(10);
    doc.text('ID', tableLeft, tableTop);
    doc.text('Date', tableLeft + colWidths[0], tableTop);
    doc.text('Pickup', tableLeft + colWidths[0] + colWidths[1], tableTop);
    doc.text('Drop-off', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
    doc.text('Status', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
    doc.text('Del. Fee (₱)', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
    doc.text('Comm. (₱)', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], tableTop);
    
    // Draw horizontal line
    doc.moveTo(tableLeft, tableTop + 15)
       .lineTo(tableLeft + colWidths.reduce((sum, w) => sum + w, 0), tableTop + 15)
       .stroke();
    
    // Table rows
    let rowTop = tableTop + 20;
    
    // Check if we need a new page
    const checkAndAddPage = () => {
      if (rowTop > doc.page.height - 100) {
        doc.addPage();
        rowTop = 50;
        return true;
      }
      return false;
    };
    
    // Add order rows
    orders.forEach((order, i) => {
      if (checkAndAddPage()) {
        // Re-add headers on new page
        doc.fontSize(10);
        doc.text('ID', tableLeft, rowTop);
        doc.text('Date', tableLeft + colWidths[0], rowTop);
        doc.text('Pickup', tableLeft + colWidths[0] + colWidths[1], rowTop);
        doc.text('Drop-off', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], rowTop);
        doc.text('Status', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowTop);
        doc.text('Del. Fee (₱)', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], rowTop);
        doc.text('Comm. (₱)', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], rowTop);
        
        // Draw horizontal line
        doc.moveTo(tableLeft, rowTop + 15)
           .lineTo(tableLeft + colWidths.reduce((sum, w) => sum + w, 0), rowTop + 15)
           .stroke();
        
        rowTop += 20;
      }
      
      // Truncate long text
      const truncate = (text, maxLength) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      };
      
      doc.fontSize(8);
      doc.text(order.order_id.toString(), tableLeft, rowTop);
      doc.text(new Date(order.order_created_at).toLocaleDateString(), tableLeft + colWidths[0], rowTop);
      doc.text(truncate(order.pickup_location, 15), tableLeft + colWidths[0] + colWidths[1], rowTop);
      doc.text(truncate(order.drop_off_location, 15), tableLeft + colWidths[0] + colWidths[1] + colWidths[2], rowTop);
      doc.text(order.order_status, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowTop);
      doc.text(parseFloat(order.delivery_fee || 0).toFixed(2), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], rowTop);
      doc.text('10.00', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], rowTop);
      
      rowTop += 15;
    });
    
    // Draw horizontal line
    doc.moveTo(tableLeft, rowTop)
       .lineTo(tableLeft + colWidths.reduce((sum, w) => sum + w, 0), rowTop)
       .stroke();
    
    rowTop += 20;
    checkAndAddPage();
    
    // Summary section
    doc.fontSize(12).text('Summary', { underline: true });
    doc.moveDown(0.5);
    
    const summaryLeft = 300;
    
    doc.fontSize(10);
    doc.text('Total Orders:', summaryLeft);
    doc.text(orders.length.toString(), summaryLeft + 150);
    
    doc.text('Total Delivery Fees:', summaryLeft);
    doc.text(`₱${parseFloat(statement.delivery_fee).toFixed(2)}`, summaryLeft + 150);
    
    doc.text('Total Commission:', summaryLeft);
    doc.text(`₱${(orders.length * 10).toFixed(2)}`, summaryLeft + 150);
    
    doc.text('Base Fee:', summaryLeft);
    doc.text(`₱${parseFloat(statement.base_fee).toFixed(2)}`, summaryLeft + 150);
    
    doc.moveDown(0.5);
    doc.fontSize(12).text('TOTAL DUE:', summaryLeft, null, { bold: true });
    doc.fontSize(12).text(`₱${parseFloat(statement.total_due).toFixed(2)}`, summaryLeft + 150, null, { bold: true });
    
    doc.moveDown();
    
    // Payment status
    doc.fontSize(10).text(`Payment Status: ${statement.status.toUpperCase()}`, { align: 'center' });
    
    if (statement.status === 'pending' || statement.status === 'overdue') {
      doc.moveDown();
      doc.fontSize(10).text('Please submit your payment before the due date to avoid service interruption.', { align: 'center' });
    }
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating PDF statement:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate PDF statement', details: error.message });
  }
});

module.exports = router;
