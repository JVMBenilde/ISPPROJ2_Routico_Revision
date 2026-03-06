// Script to set admin role for existing users
const mysql = require('mysql2/promise');
require('dotenv').config();

const setAdminRole = async (userId) => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'routico',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Update user role to administrator
    const [result] = await connection.execute(`
      UPDATE users 
      SET role = 'administrator', account_status = 'approved', active_status = 'active'
      WHERE user_id = ?
    `, [userId]);

    if (result.affectedRows > 0) {
      console.log(`User ${userId} has been set as administrator`);
    } else {
      console.log(`User ${userId} not found`);
    }
  } catch (error) {
    console.error('Error setting admin role:', error);
  } finally {
    await connection.end();
  }
};

// Get userId from command line argument
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node setAdminRole.js <userId>');
  process.exit(1);
}

setAdminRole(userId);
