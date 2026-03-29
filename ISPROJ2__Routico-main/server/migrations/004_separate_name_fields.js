const runNameFieldsMigration = async (db) => {
  // Check if migration already ran
  const [columns] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'first_name'"
  );
  if (columns.length > 0) {
    console.log('Name fields migration already applied, skipping.');
    return;
  }

  console.log('Running name fields migration...');

  // Add first_name, last_name, middle_name columns
  await db.query(`
    ALTER TABLE users
    ADD COLUMN first_name VARCHAR(100) AFTER full_name,
    ADD COLUMN last_name VARCHAR(100) AFTER first_name,
    ADD COLUMN middle_name VARCHAR(100) AFTER last_name
  `);

  // Backfill existing records: split full_name into first_name and last_name
  // For existing data, first word = first_name, rest = last_name
  await db.query(`
    UPDATE users
    SET first_name = SUBSTRING_INDEX(full_name, ' ', 1),
        last_name = CASE
          WHEN LOCATE(' ', full_name) > 0 THEN TRIM(SUBSTRING(full_name, LOCATE(' ', full_name) + 1))
          ELSE ''
        END
    WHERE first_name IS NULL
  `);

  console.log('Name fields migration complete.');
};

module.exports = { runNameFieldsMigration };
