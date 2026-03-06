// Script to insert admin user into the database
const mysql = require('mysql2/promise');
require('dotenv').config();

const insertAdminUser = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'routico',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Insert admin user
    const [result] = await connection.execute(`
      INSERT INTO users (full_name, email, password_hash, phone, account_status, active_status, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'Routico Administrator',
      'admin@routico.com',
      '$2b$10$example_hash_here', // This should be replaced with actual bcrypt hash
      '09123456789',
      'approved',
      'active',
      'administrator'
    ]);

    console.log('Admin user inserted successfully with ID:', result.insertId);
  } catch (error) {
    console.error('Error inserting admin user:', error);
  } finally {
    await connection.end();
  }
};

insertAdminUser();
