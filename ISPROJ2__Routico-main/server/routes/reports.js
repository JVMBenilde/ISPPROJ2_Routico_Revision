const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');
const { createObjectCsvStringifier } = require('csv-writer');
const PDFDocument = require('pdfkit');

/**
 * Get available report data (preview before download)
 * @route GET /api/reports/:type
 * @access Private (Business Owner)
 */
router.get('/:type', requirePerm('view_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const reportType = req.params.type;
    const { startDate, endDate } = req.query;

    const [ownerResult] = await db.query(
      'SELECT owner_id, company_name FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    const ownerId = ownerResult[0].owner_id;

    let data;
    switch (reportType) {
      case 'delivery-summary':
        data = await getDeliverySummaryData(db, ownerId, startDate, endDate);
        break;
      case 'driver-performance':
        data = await getDriverPerformanceData(db, ownerId, startDate, endDate);
        break;
      case 'fleet-utilization':
        data = await getFleetUtilizationData(db, ownerId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ error: 'Failed to fetch report data' });
  }
});

/**
 * Download report as CSV
 * @route GET /api/reports/:type/download/csv
 */
router.get('/:type/download/csv', requirePerm('view_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const reportType = req.params.type;
    const { startDate, endDate } = req.query;

    const [ownerResult] = await db.query(
      'SELECT owner_id, company_name FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    const ownerId = ownerResult[0].owner_id;

    let csvContent, filename;

    switch (reportType) {
      case 'delivery-summary':
        ({ csvContent, filename } = await generateDeliverySummaryCSV(db, ownerId, startDate, endDate));
        break;
      case 'driver-performance':
        ({ csvContent, filename } = await generateDriverPerformanceCSV(db, ownerId, startDate, endDate));
        break;
      case 'fleet-utilization':
        ({ csvContent, filename } = await generateFleetUtilizationCSV(db, ownerId));
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error generating CSV report:', error);
    res.status(500).json({ error: 'Failed to generate CSV report' });
  }
});

/**
 * Download report as PDF
 * @route GET /api/reports/:type/download/pdf
 */
router.get('/:type/download/pdf', requirePerm('view_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const reportType = req.params.type;
    const { startDate, endDate } = req.query;

    const [ownerResult] = await db.query(
      'SELECT owner_id, company_name FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    const ownerId = ownerResult[0].owner_id;
    const companyName = ownerResult[0].company_name || 'Business';

    let title, data;

    switch (reportType) {
      case 'delivery-summary':
        title = 'Delivery Summary Report';
        data = await getDeliverySummaryData(db, ownerId, startDate, endDate);
        break;
      case 'driver-performance':
        title = 'Driver Performance Report';
        data = await getDriverPerformanceData(db, ownerId, startDate, endDate);
        break;
      case 'fleet-utilization':
        title = 'Fleet Utilization Report';
        data = await getFleetUtilizationData(db, ownerId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : 'All Time';
    const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#666666').text(companyName, { align: 'center' });
    doc.fontSize(10).text(`Period: ${dateRange}`, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);
    doc.fillColor('#000000');

    if (reportType === 'delivery-summary') {
      renderDeliverySummaryPDF(doc, data);
    } else if (reportType === 'driver-performance') {
      renderDriverPerformancePDF(doc, data);
    } else if (reportType === 'fleet-utilization') {
      renderFleetUtilizationPDF(doc, data);
    }

    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// ==================== DATA FETCHERS ====================

async function getDeliverySummaryData(db, ownerId, startDate, endDate) {
  let dateFilter = '';
  const params = [ownerId];

  if (startDate && endDate) {
    dateFilter = 'AND o.order_created_at BETWEEN ? AND ?';
    params.push(startDate, endDate + ' 23:59:59');
  }

  const [orders] = await db.query(
    `SELECT
      o.order_id, o.pickup_location, o.drop_off_location, o.delivery_fee,
      o.weight, o.size, o.order_status, o.order_created_at, o.scheduled_delivery_time,
      c.company_name AS customer_name,
      CONCAT(u.full_name) AS driver_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
    LEFT JOIN users u ON d.user_id = u.user_id
    WHERE o.business_owner_id = ? ${dateFilter}
    ORDER BY o.order_created_at DESC`,
    params
  );

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.order_status === 'completed').length;
  const cancelledOrders = orders.filter(o => o.order_status === 'cancelled').length;
  const pendingOrders = orders.filter(o => o.order_status === 'pending').length;
  const inTransitOrders = orders.filter(o => o.order_status === 'in_transit').length;
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0);
  const completionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;

  return {
    summary: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      inTransitOrders,
      totalRevenue,
      completionRate
    },
    orders
  };
}

async function getDriverPerformanceData(db, ownerId, startDate, endDate) {
  let dateFilter = '';
  const params = [ownerId];

  if (startDate && endDate) {
    dateFilter = 'AND o.order_created_at BETWEEN ? AND ?';
    params.push(startDate, endDate + ' 23:59:59');
  }

  const [drivers] = await db.query(
    `SELECT
      d.driver_id,
      u.full_name AS driver_name,
      u.email,
      d.license_number,
      d.status AS driver_status,
      COUNT(o.order_id) AS total_orders,
      SUM(CASE WHEN o.order_status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
      SUM(CASE WHEN o.order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
      SUM(CASE WHEN o.order_status = 'in_transit' THEN 1 ELSE 0 END) AS in_transit_orders,
      COALESCE(SUM(o.delivery_fee), 0) AS total_revenue
    FROM drivers d
    JOIN users u ON d.user_id = u.user_id
    LEFT JOIN orders o ON o.assigned_driver_id = d.driver_id ${dateFilter}
    WHERE d.owner_id = ?
    GROUP BY d.driver_id, u.full_name, u.email, d.license_number, d.status
    ORDER BY completed_orders DESC`,
    [...params.slice(1), params[0]]
  );

  const driverStats = drivers.map(d => ({
    ...d,
    total_orders: parseInt(d.total_orders),
    completed_orders: parseInt(d.completed_orders),
    cancelled_orders: parseInt(d.cancelled_orders),
    in_transit_orders: parseInt(d.in_transit_orders),
    total_revenue: parseFloat(d.total_revenue),
    completion_rate: d.total_orders > 0
      ? ((d.completed_orders / d.total_orders) * 100).toFixed(1)
      : '0.0'
  }));

  return {
    summary: {
      totalDrivers: driverStats.length,
      activeDrivers: driverStats.filter(d => d.driver_status === 'active').length,
      totalDeliveries: driverStats.reduce((sum, d) => sum + d.completed_orders, 0),
      avgCompletionRate: driverStats.length > 0
        ? (driverStats.reduce((sum, d) => sum + parseFloat(d.completion_rate), 0) / driverStats.length).toFixed(1)
        : '0.0'
    },
    drivers: driverStats
  };
}

async function getFleetUtilizationData(db, ownerId) {
  const [vehicles] = await db.query(
    `SELECT
      t.truck_id, t.plate_number, t.model, t.capacity, t.status,
      t.vehicle_type, t.fuel_type, t.year, t.mileage,
      t.insurance_expiry, t.registration_expiry,
      t.last_maintenance_date, t.next_maintenance_date,
      CONCAT(u.full_name) AS assigned_driver,
      COUNT(o.order_id) AS total_trips,
      COALESCE(SUM(o.delivery_fee), 0) AS total_revenue
    FROM trucks t
    LEFT JOIN drivers d ON t.assigned_driver_id = d.driver_id
    LEFT JOIN users u ON d.user_id = u.user_id
    LEFT JOIN orders o ON o.truck_id = t.truck_id AND o.order_status = 'completed'
    WHERE t.owner_id = ?
    GROUP BY t.truck_id
    ORDER BY total_trips DESC`,
    [ownerId]
  );

  const vehicleStats = vehicles.map(v => ({
    ...v,
    total_trips: parseInt(v.total_trips),
    total_revenue: parseFloat(v.total_revenue),
    maintenance_due: v.next_maintenance_date ? new Date(v.next_maintenance_date) <= new Date() : false,
    insurance_expired: v.insurance_expiry ? new Date(v.insurance_expiry) <= new Date() : false
  }));

  return {
    summary: {
      totalVehicles: vehicleStats.length,
      activeVehicles: vehicleStats.filter(v => v.status === 'active').length,
      maintenanceDue: vehicleStats.filter(v => v.maintenance_due).length,
      totalTrips: vehicleStats.reduce((sum, v) => sum + v.total_trips, 0),
      totalRevenue: vehicleStats.reduce((sum, v) => sum + v.total_revenue, 0)
    },
    vehicles: vehicleStats
  };
}

// ==================== CSV GENERATORS ====================

async function generateDeliverySummaryCSV(db, ownerId, startDate, endDate) {
  const data = await getDeliverySummaryData(db, ownerId, startDate, endDate);

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'order_id', title: 'Order ID' },
      { id: 'date', title: 'Date' },
      { id: 'customer', title: 'Customer' },
      { id: 'driver', title: 'Driver' },
      { id: 'pickup', title: 'Pickup' },
      { id: 'dropoff', title: 'Drop-off' },
      { id: 'status', title: 'Status' },
      { id: 'fee', title: 'Delivery Fee' }
    ]
  });

  const records = data.orders.map(o => ({
    order_id: o.order_id,
    date: new Date(o.order_created_at).toLocaleDateString(),
    customer: o.customer_name || 'N/A',
    driver: o.driver_name || 'Unassigned',
    pickup: o.pickup_location || '',
    dropoff: o.drop_off_location || '',
    status: o.order_status,
    fee: parseFloat(o.delivery_fee || 0).toFixed(2)
  }));

  const summaryRecords = [
    { order_id: '', date: '', customer: '', driver: '', pickup: '', dropoff: '', status: '', fee: '' },
    { order_id: '', date: '', customer: '', driver: '', pickup: '', dropoff: 'Total Orders:', status: data.summary.totalOrders, fee: '' },
    { order_id: '', date: '', customer: '', driver: '', pickup: '', dropoff: 'Completed:', status: data.summary.completedOrders, fee: '' },
    { order_id: '', date: '', customer: '', driver: '', pickup: '', dropoff: 'Completion Rate:', status: `${data.summary.completionRate}%`, fee: '' },
    { order_id: '', date: '', customer: '', driver: '', pickup: '', dropoff: 'Total Revenue:', status: '', fee: data.summary.totalRevenue.toFixed(2) }
  ];

  const csvContent = csvStringifier.getHeaderString() +
    csvStringifier.stringifyRecords(records) +
    csvStringifier.stringifyRecords(summaryRecords);

  return { csvContent, filename: `delivery-summary-${new Date().toISOString().split('T')[0]}.csv` };
}

async function generateDriverPerformanceCSV(db, ownerId, startDate, endDate) {
  const data = await getDriverPerformanceData(db, ownerId, startDate, endDate);

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'driver_name', title: 'Driver Name' },
      { id: 'email', title: 'Email' },
      { id: 'status', title: 'Status' },
      { id: 'total_orders', title: 'Total Orders' },
      { id: 'completed', title: 'Completed' },
      { id: 'cancelled', title: 'Cancelled' },
      { id: 'completion_rate', title: 'Completion Rate' },
      { id: 'revenue', title: 'Revenue Generated' }
    ]
  });

  const records = data.drivers.map(d => ({
    driver_name: d.driver_name,
    email: d.email,
    status: d.driver_status,
    total_orders: d.total_orders,
    completed: d.completed_orders,
    cancelled: d.cancelled_orders,
    completion_rate: `${d.completion_rate}%`,
    revenue: d.total_revenue.toFixed(2)
  }));

  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  return { csvContent, filename: `driver-performance-${new Date().toISOString().split('T')[0]}.csv` };
}

async function generateFleetUtilizationCSV(db, ownerId) {
  const data = await getFleetUtilizationData(db, ownerId);

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'plate', title: 'Plate Number' },
      { id: 'model', title: 'Model' },
      { id: 'status', title: 'Status' },
      { id: 'driver', title: 'Assigned Driver' },
      { id: 'trips', title: 'Total Trips' },
      { id: 'revenue', title: 'Revenue' },
      { id: 'maintenance', title: 'Maintenance Due' },
      { id: 'insurance', title: 'Insurance Status' }
    ]
  });

  const records = data.vehicles.map(v => ({
    plate: v.plate_number,
    model: v.model || 'N/A',
    status: v.status,
    driver: v.assigned_driver || 'Unassigned',
    trips: v.total_trips,
    revenue: v.total_revenue.toFixed(2),
    maintenance: v.maintenance_due ? 'OVERDUE' : 'OK',
    insurance: v.insurance_expired ? 'EXPIRED' : 'Valid'
  }));

  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  return { csvContent, filename: `fleet-utilization-${new Date().toISOString().split('T')[0]}.csv` };
}

// ==================== PDF RENDERERS ====================

function renderDeliverySummaryPDF(doc, data) {
  // Summary section
  doc.fontSize(14).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');

  const summaryItems = [
    ['Total Orders', data.summary.totalOrders],
    ['Completed', data.summary.completedOrders],
    ['Cancelled', data.summary.cancelledOrders],
    ['Pending', data.summary.pendingOrders],
    ['In Transit', data.summary.inTransitOrders],
    ['Completion Rate', `${data.summary.completionRate}%`],
    ['Total Revenue', `P${data.summary.totalRevenue.toFixed(2)}`]
  ];

  summaryItems.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, { indent: 20 });
  });

  doc.moveDown(1);
  doc.fontSize(14).font('Helvetica-Bold').text('Order Details');
  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('ID', 50, tableTop, { width: 30 });
  doc.text('Date', 85, tableTop, { width: 65 });
  doc.text('Customer', 155, tableTop, { width: 80 });
  doc.text('Status', 240, tableTop, { width: 60 });
  doc.text('Fee', 305, tableTop, { width: 50 });
  doc.text('Drop-off', 360, tableTop, { width: 185 });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
  doc.moveDown(0.3);

  // Table rows
  doc.font('Helvetica').fontSize(8);
  const maxRows = Math.min(data.orders.length, 40);
  for (let i = 0; i < maxRows; i++) {
    const o = data.orders[i];
    if (doc.y > 700) {
      doc.addPage();
      doc.y = 50;
    }
    const y = doc.y;
    doc.text(o.order_id, 50, y, { width: 30 });
    doc.text(new Date(o.order_created_at).toLocaleDateString(), 85, y, { width: 65 });
    doc.text((o.customer_name || 'N/A').substring(0, 15), 155, y, { width: 80 });
    doc.text(o.order_status, 240, y, { width: 60 });
    doc.text(`P${parseFloat(o.delivery_fee || 0).toFixed(2)}`, 305, y, { width: 50 });
    doc.text((o.drop_off_location || '').substring(0, 35), 360, y, { width: 185 });
    doc.moveDown(0.8);
  }

  if (data.orders.length > 40) {
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#888888').text(`... and ${data.orders.length - 40} more orders`, { align: 'center' });
  }
}

function renderDriverPerformancePDF(doc, data) {
  doc.fontSize(14).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Drivers: ${data.summary.totalDrivers}`, { indent: 20 });
  doc.text(`Active Drivers: ${data.summary.activeDrivers}`, { indent: 20 });
  doc.text(`Total Completed Deliveries: ${data.summary.totalDeliveries}`, { indent: 20 });
  doc.text(`Average Completion Rate: ${data.summary.avgCompletionRate}%`, { indent: 20 });

  doc.moveDown(1);
  doc.fontSize(14).font('Helvetica-Bold').text('Driver Details');
  doc.moveDown(0.5);

  const tableTop = doc.y;
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('Driver Name', 50, tableTop, { width: 100 });
  doc.text('Status', 155, tableTop, { width: 50 });
  doc.text('Total', 210, tableTop, { width: 40 });
  doc.text('Done', 255, tableTop, { width: 40 });
  doc.text('Cancel', 300, tableTop, { width: 40 });
  doc.text('Rate', 345, tableTop, { width: 45 });
  doc.text('Revenue', 395, tableTop, { width: 70 });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(8);
  data.drivers.forEach(d => {
    if (doc.y > 700) {
      doc.addPage();
      doc.y = 50;
    }
    const y = doc.y;
    doc.text(d.driver_name.substring(0, 20), 50, y, { width: 100 });
    doc.text(d.driver_status, 155, y, { width: 50 });
    doc.text(String(d.total_orders), 210, y, { width: 40 });
    doc.text(String(d.completed_orders), 255, y, { width: 40 });
    doc.text(String(d.cancelled_orders), 300, y, { width: 40 });
    doc.text(`${d.completion_rate}%`, 345, y, { width: 45 });
    doc.text(`P${d.total_revenue.toFixed(2)}`, 395, y, { width: 70 });
    doc.moveDown(0.8);
  });
}

function renderFleetUtilizationPDF(doc, data) {
  doc.fontSize(14).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Vehicles: ${data.summary.totalVehicles}`, { indent: 20 });
  doc.text(`Active Vehicles: ${data.summary.activeVehicles}`, { indent: 20 });
  doc.text(`Maintenance Due: ${data.summary.maintenanceDue}`, { indent: 20 });
  doc.text(`Total Completed Trips: ${data.summary.totalTrips}`, { indent: 20 });
  doc.text(`Total Revenue: P${data.summary.totalRevenue.toFixed(2)}`, { indent: 20 });

  doc.moveDown(1);
  doc.fontSize(14).font('Helvetica-Bold').text('Vehicle Details');
  doc.moveDown(0.5);

  const tableTop = doc.y;
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('Plate', 50, tableTop, { width: 70 });
  doc.text('Model', 125, tableTop, { width: 80 });
  doc.text('Status', 210, tableTop, { width: 50 });
  doc.text('Driver', 265, tableTop, { width: 90 });
  doc.text('Trips', 360, tableTop, { width: 35 });
  doc.text('Revenue', 400, tableTop, { width: 60 });
  doc.text('Maint.', 465, tableTop, { width: 45 });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(8);
  data.vehicles.forEach(v => {
    if (doc.y > 700) {
      doc.addPage();
      doc.y = 50;
    }
    const y = doc.y;
    doc.text(v.plate_number || '', 50, y, { width: 70 });
    doc.text((v.model || 'N/A').substring(0, 15), 125, y, { width: 80 });
    doc.text(v.status || '', 210, y, { width: 50 });
    doc.text((v.assigned_driver || 'Unassigned').substring(0, 18), 265, y, { width: 90 });
    doc.text(String(v.total_trips), 360, y, { width: 35 });
    doc.text(`P${v.total_revenue.toFixed(2)}`, 400, y, { width: 60 });
    doc.text(v.maintenance_due ? 'DUE' : 'OK', 465, y, { width: 45 });
    doc.moveDown(0.8);
  });
}

module.exports = router;
