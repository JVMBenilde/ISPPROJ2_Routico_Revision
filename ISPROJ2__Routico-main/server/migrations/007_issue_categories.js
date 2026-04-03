async function runIssueCategoriesMigration(db) {
  try {
    // Remove duplicates first - keep only the lowest category_id for each name
    await db.query(`DELETE c1 FROM issuescategories c1
      INNER JOIN issuescategories c2
      WHERE c1.category_id > c2.category_id AND c1.category_name = c2.category_name`);

    // Check if correct categories already exist
    const [existing] = await db.query("SELECT COUNT(*) as count FROM issuescategories WHERE category_name = 'UI/Display Issue'");
    if (existing[0].count === 0) {
      // Clear old categories (disable FK checks temporarily)
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DELETE FROM issuescategories');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');

      const categories = [
        ['UI/Display Issue', 'Pages not displaying correctly, layout problems, or visual glitches'],
        ['Login/Authentication', 'Cannot log in, session expired, or password reset problems'],
        ['Performance Issue', 'Slow loading, unresponsive pages, or timeouts'],
        ['Feature Not Working', 'A feature is not functioning as expected'],
        ['Error Message', 'Unexpected error messages or crashes in the application'],
        ['Data Issue', 'Incorrect data displayed, missing information, or sync problems'],
        ['Navigation Problem', 'Broken links, incorrect redirects, or menu issues'],
        ['Browser Compatibility', 'App not working properly on a specific browser or device'],
        ['Suggestion/Feedback', 'Feature request or general feedback about the web application'],
        ['Other', 'Issues that do not fall into any other category']
      ];

      for (const [name, description] of categories) {
        await db.query(
          'INSERT INTO issuescategories (category_name, description) VALUES (?, ?)',
          [name, description]
        );
      }

      console.log(`Issue categories seeded: ${categories.length} categories added.`);
    } else {
      console.log('Issue categories already seeded, skipping.');
    }

    // Always ensure driver role has issue permissions
    const [driverRole] = await db.query("SELECT role_id FROM roles WHERE role_name = 'driver'");
    const [viewIssuesPerm] = await db.query("SELECT permission_id FROM permissions WHERE permission_key = 'view_issues'");
    const [manageIssuesPerm] = await db.query("SELECT permission_id FROM permissions WHERE permission_key = 'manage_issues'");

    if (driverRole.length > 0 && viewIssuesPerm.length > 0) {
      const driverId = driverRole[0].role_id;
      const viewId = viewIssuesPerm[0].permission_id;
      const manageId = manageIssuesPerm.length > 0 ? manageIssuesPerm[0].permission_id : null;

      await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [driverId, viewId]);
      if (manageId) {
        await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [driverId, manageId]);
      }
    }
  } catch (error) {
    console.error('Issue categories migration error:', error);
  }
}

module.exports = { runIssueCategoriesMigration };
