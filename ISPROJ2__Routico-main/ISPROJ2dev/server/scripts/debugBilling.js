const mysql = require('mysql2/promise');
require('dotenv').config();

const debugBilling = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'routico',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('=== Checking Billing Statements ===\n');
    
    // Get all billing statements
    const [allStatements] = await connection.query(
      `SELECT 
        b.billing_id,
        bo.company_name,
        DATE_FORMAT(b.billing_period, '%Y-%m') as period,
        b.status,
        b.billing_period,
        DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
        NOW() as current_datetime,
        DATEDIFF(NOW(), DATE_ADD(b.billing_period, INTERVAL 1 MONTH)) as days_overdue
      FROM billing b
      JOIN businessowners bo ON b.owner_id = bo.owner_id
      ORDER BY b.billing_period DESC`
    );
    
    console.log('All Billing Statements:');
    console.table(allStatements);
    
    console.log('\n=== Checking Overdue Condition ===\n');
    
    // Check which statements should be overdue
    const [overdueCheck] = await connection.query(
      `SELECT 
        b.billing_id,
        bo.company_name,
        DATE_FORMAT(b.billing_period, '%Y-%m') as period,
        b.status,
        DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
        NOW() as current_datetime,
        DATE_ADD(b.billing_period, INTERVAL 1 MONTH) < NOW() as is_past_due,
        DATEDIFF(NOW(), DATE_ADD(b.billing_period, INTERVAL 1 MONTH)) as days_overdue,
        (b.status IN ('overdue', 'suspended', 'pending') AND DATE_ADD(b.billing_period, INTERVAL 1 MONTH) < NOW()) as should_show_overdue
      FROM billing b
      JOIN businessowners bo ON b.owner_id = bo.owner_id
      WHERE bo.company_name LIKE '%test%' OR bo.owner_id = 4
      ORDER BY b.billing_period DESC`
    );
    
    console.log('Overdue Check (Test Accounts):');
    console.table(overdueCheck);
    
    console.log('\n=== Actual Overdue Query Result ===\n');
    
    // Run the actual overdue query
    const [overdueAccounts] = await connection.query(
      `SELECT 
        bo.owner_id,
        bo.company_name,
        b.billing_id as statement_id,
        DATE_FORMAT(b.billing_period, '%Y-%m') as statement_period,
        b.total_due,
        b.status,
        b.billing_period as statement_date,
        DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
        DATEDIFF(NOW(), DATE_ADD(b.billing_period, INTERVAL 1 MONTH)) as days_overdue
      FROM billing b
      JOIN businessowners bo ON b.owner_id = bo.owner_id
      JOIN users u ON bo.user_id = u.user_id
      WHERE (b.status IN ('overdue', 'suspended', 'pending') 
        AND DATE_ADD(b.billing_period, INTERVAL 1 MONTH) < NOW())
      ORDER BY days_overdue DESC`
    );
    
    console.log('Overdue Accounts Query Result:');
    console.table(overdueAccounts);
    
    console.log(`\nTotal overdue accounts found: ${overdueAccounts.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
};

debugBilling();

