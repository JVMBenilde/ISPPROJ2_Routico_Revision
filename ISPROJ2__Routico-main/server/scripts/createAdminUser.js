// Script to create admin user with bcrypted password
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

const createAdminUser = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'routico_db',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Hash the password
    const password = 'Admin123!';
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if admin user already exists
    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      ['admin@routico.com']
    );

    if (existing.length > 0) {
      console.log('Admin user already exists!');
      console.log('Email: admin@routico.com');
      console.log('Password: Admin123!');
    } else {
      // Insert admin user
      const [result] = await connection.execute(`
        INSERT INTO users (full_name, email, password_hash, phone, account_status, active_status, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        'Routico Administrator',
        'admin@routico.com',
        passwordHash,
        '09123456789',
        'approved',
        'active',
        'administrator'
      ]);

      console.log('✓ Admin user created successfully!');
      console.log('Email: admin@routico.com');
      console.log('Password: Admin123!');
      console.log('User ID:', result.insertId);
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  } finally {
    await connection.end();
  }
};

createAdminUser();
