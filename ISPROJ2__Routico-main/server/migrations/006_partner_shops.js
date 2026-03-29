const runPartnerShopsMigration = async (db) => {
  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_shops'"
  );
  if (tables.length > 0) {
    console.log('Partner shops table already exists, skipping migration.');
    return;
  }

  console.log('Running partner shops migration...');

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

  console.log('Partner shops migration complete.');
};

module.exports = { runPartnerShopsMigration };
