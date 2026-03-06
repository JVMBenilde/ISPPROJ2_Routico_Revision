// Script to generate sample billing data for a business owner
const mysql = require('mysql2/promise');
require('dotenv').config();

const generateSampleBilling = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'routico',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Get the business owner for testacc3@yahoo.com
    const [users] = await connection.execute(
      'SELECT u.user_id, bo.owner_id FROM users u JOIN businessowners bo ON u.user_id = bo.user_id WHERE u.email = ?',
      ['testacc3@yahoo.com']
    );

    if (users.length === 0) {
      console.log('Business owner not found for testacc3@yahoo.com');
      return;
    }

    const ownerId = users[0].owner_id;
    const userId = users[0].user_id;
    console.log(`Found business owner with ID: ${ownerId} (user ID: ${userId})`);

    // Generate billing statements for the last 6 months
    const statements = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const billingDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const billingPeriod = billingDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      const periodString = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Random number of deliveries (5-20 per month)
      const deliveryCount = Math.floor(Math.random() * 16) + 5;
      const baseFee = 2000.00;
      const totalCommission = deliveryCount * 10.00;
      const totalDue = baseFee + totalCommission;
      
      // Determine status based on month
      let status;
      if (i >= 2) {
        status = 'paid'; // Older months are paid
      } else if (i === 1) {
        status = 'pending'; // Last month is pending
      } else {
        status = 'pending'; // Current month is pending
      }

      statements.push({
        period: billingPeriod,
        periodString,
        baseFee,
        deliveryCount,
        totalCommission,
        totalDue,
        status
      });
    }

    // Insert billing statements
    for (const stmt of statements) {
      // Check if statement already exists
      const [existing] = await connection.execute(
        'SELECT billing_id FROM billing WHERE owner_id = ? AND billing_period = ?',
        [ownerId, stmt.period]
      );

      if (existing.length > 0) {
        console.log(`Statement for ${stmt.periodString} already exists, skipping...`);
        continue;
      }

      const [result] = await connection.execute(
        `INSERT INTO billing (
          owner_id, 
          billing_period, 
          flat_fee, 
          total_commission, 
          total_due, 
          status, 
          generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [ownerId, stmt.period, stmt.baseFee, stmt.totalCommission, stmt.totalDue, stmt.status]
      );

      console.log(`✓ Created ${stmt.status} statement for ${stmt.periodString}: ${stmt.deliveryCount} deliveries, ₱${stmt.totalDue} total`);
    }

    // Now create sample orders for the current month
    console.log('\nGenerating sample orders for current month...');
    
    const currentMonthStatement = statements[statements.length - 1];
    const deliveryCount = currentMonthStatement.deliveryCount;
    
    // Get or create a customer
    let customerId;
    const [customers] = await connection.execute(
      'SELECT customer_id FROM customers LIMIT 1'
    );
    
    if (customers.length > 0) {
      customerId = customers[0].customer_id;
    } else {
      // Create a sample customer
      const [customerResult] = await connection.execute(
        `INSERT INTO customers (company_name, address, contact_number) 
         VALUES (?, ?, ?)`,
        ['Sample Customer Inc.', '123 Main St, Manila', '09123456789']
      );
      customerId = customerResult.insertId;
      console.log(`Created sample customer with ID: ${customerId}`);
    }

    // Sample locations in Metro Manila
    const locations = [
      'Quezon City, Metro Manila',
      'Makati City, Metro Manila',
      'Taguig City, Metro Manila',
      'Pasig City, Metro Manila',
      'Mandaluyong City, Metro Manila',
      'Manila City, Metro Manila',
      'Pasay City, Metro Manila',
      'Parañaque City, Metro Manila',
      'Las Piñas City, Metro Manila',
      'Muntinlupa City, Metro Manila'
    ];

    const statuses = ['pending', 'in-transit', 'delivered'];
    
    for (let i = 0; i < deliveryCount; i++) {
      const pickupLocation = locations[Math.floor(Math.random() * locations.length)];
      let dropOffLocation = locations[Math.floor(Math.random() * locations.length)];
      
      // Ensure pickup and dropoff are different
      while (dropOffLocation === pickupLocation) {
        dropOffLocation = locations[Math.floor(Math.random() * locations.length)];
      }
      
      const weight = (Math.random() * 50 + 1).toFixed(2); // 1-50 kg
      const sizes = ['small', 'medium', 'large'];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const deliveryFee = (Math.random() * 500 + 100).toFixed(2); // ₱100-₱600
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Random date within current month
      const dayOfMonth = Math.floor(Math.random() * 28) + 1;
      const orderDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
      const scheduledDate = new Date(orderDate);
      scheduledDate.setDate(scheduledDate.getDate() + Math.floor(Math.random() * 3) + 1); // 1-3 days after order

      await connection.execute(
        `INSERT INTO orders (
          business_owner_id,
          customer_id,
          pickup_location,
          drop_off_location,
          delivery_fee,
          weight,
          size,
          scheduled_delivery_time,
          order_status,
          order_created_at,
          order_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          ownerId,
          customerId,
          pickupLocation,
          dropOffLocation,
          deliveryFee,
          weight,
          size,
          scheduledDate.toISOString().slice(0, 19).replace('T', ' '),
          status,
          orderDate.toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
    }

    console.log(`✓ Created ${deliveryCount} sample orders for current month`);
    
    console.log('\n✅ Sample billing data generated successfully!');
    console.log('\nSummary:');
    console.log(`- Business Owner: testacc3@yahoo.com (ID: ${ownerId})`);
    console.log(`- Billing Statements: ${statements.length} months`);
    console.log(`- Sample Orders: ${deliveryCount} for current month`);
    console.log('\nYou can now view this data in the Billing & Payments tab!');

  } catch (error) {
    console.error('Error generating sample billing data:', error);
  } finally {
    await connection.end();
  }
};

generateSampleBilling();

