const runMechanicsMigration = async (db) => {
  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mechanics'"
  );
  if (tables.length > 0) {
    console.log('Mechanics table already exists, skipping migration.');
    return;
  }

  console.log('Running mechanics migration...');

  await db.query(`
    CREATE TABLE mechanics (
      mechanic_id INT AUTO_INCREMENT PRIMARY KEY,
      owner_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES businessowners(owner_id) ON DELETE CASCADE
    )
  `);

  console.log('Mechanics migration complete.');

  // Also create partner_shops table
  const [shopTables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_shops'"
  );
  if (shopTables.length === 0) {
    console.log('Creating partner_shops table...');
    await db.query(`
      CREATE TABLE partner_shops (
        shop_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES businessowners(owner_id) ON DELETE CASCADE
      )
    `);
    console.log('Partner shops table created.');
  }
};

module.exports = { runMechanicsMigration };
