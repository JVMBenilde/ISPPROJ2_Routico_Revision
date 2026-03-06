const mysql = require('mysql2/promise');

/**
 * Billing Statement Service
 * Manages billing statements using the existing billing table
 */
class BillingStatementService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate billing statement for a business owner
   * @param {number} ownerId - Business owner ID
   * @param {string} statementPeriod - Billing period in YYYY-MM format
   * @param {number} deliveryCount - Number of deliveries for the period
   * @returns {Promise<Object>} - Generated statement
   */
  async generateStatement(ownerId, statementPeriod, deliveryCount = 0) {
    try {
      // Calculate fees
      const baseFee = 2000.00;
      const deliveryFee = deliveryCount * 10.00;
      const totalDue = baseFee + deliveryFee;

      // Calculate dates
      const statementDate = new Date();
      const dueDate = this.calculateDueDate(ownerId, statementPeriod);
      const gracePeriodEnd = new Date(dueDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      // Check if statement already exists
      const existingStatement = await this.getStatementByPeriod(ownerId, statementPeriod);
      if (existingStatement) {
        throw new Error(`Statement for period ${statementPeriod} already exists`);
      }

      // Insert new billing statement
      const [result] = await this.db.query(
        `INSERT INTO billing (
          owner_id, 
          billing_period, 
          flat_fee, 
          total_commission, 
          total_due, 
          status, 
          generated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
        [ownerId, `${statementPeriod}-01`, baseFee, deliveryFee, totalDue]
      );

      return {
        statementId: result.insertId,
        ownerId,
        statementPeriod,
        statementDate: statementDate.toISOString(),
        dueDate: dueDate.toISOString(),
        gracePeriodEnd: gracePeriodEnd.toISOString(),
        baseFee,
        deliveryCount,
        deliveryFee,
        totalDue,
        status: 'pending'
      };

    } catch (error) {
      console.error('Error generating billing statement:', error);
      throw error;
    }
  }

  /**
   * Calculate due date for a statement period
   * @param {number} ownerId - Business owner ID
   * @param {string} statementPeriod - Billing period in YYYY-MM format
   * @returns {Date} - Due date
   */
  async calculateDueDate(ownerId, statementPeriod) {
    try {
      // Get user's approval date
      const [userResult] = await this.db.query(
        `SELECT u.created_at 
         FROM users u 
         JOIN businessowners bo ON u.user_id = bo.user_id 
         WHERE bo.owner_id = ?`,
        [ownerId]
      );

      if (userResult.length === 0) {
        throw new Error('Business owner not found');
      }

      const approvalDate = new Date(userResult[0].created_at);
      const statementDate = new Date(`${statementPeriod}-01`);
      
      // Calculate how many months after approval this statement is for
      const monthsSinceApproval = (statementDate.getFullYear() - approvalDate.getFullYear()) * 12 + 
                                 (statementDate.getMonth() - approvalDate.getMonth());
      
      // Due date is exactly 1 month after the statement period starts
      const dueDate = new Date(statementDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      
      return dueDate;

    } catch (error) {
      console.error('Error calculating due date:', error);
      throw error;
    }
  }

  /**
   * Get all statements for a business owner
   * @param {number} ownerId - Business owner ID
   * @returns {Promise<Array>} - Array of statements
   */
  async getStatementsByOwner(ownerId) {
    try {
      // Auto-recalculate current month's billing from actual orders
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      await this.db.query(
        `UPDATE billing b SET
          b.flat_fee = 2000.00,
          b.total_commission = (SELECT COUNT(*) * 10.00 FROM orders o WHERE o.business_owner_id = b.owner_id AND DATE_FORMAT(o.order_created_at, '%Y-%m') = DATE_FORMAT(b.billing_period, '%Y-%m')),
          b.total_due = 2000.00 + (SELECT COUNT(*) * 10.00 FROM orders o WHERE o.business_owner_id = b.owner_id AND DATE_FORMAT(o.order_created_at, '%Y-%m') = DATE_FORMAT(b.billing_period, '%Y-%m')),
          b.status = CASE WHEN b.status = 'free' THEN 'pending' ELSE b.status END
        WHERE b.owner_id = ? AND DATE_FORMAT(b.billing_period, '%Y-%m') = ?`,
        [ownerId, currentMonth]
      );

      const [statements] = await this.db.query(
        `SELECT
          b.billing_id as statement_id,
          b.owner_id,
          DATE_FORMAT(b.billing_period, '%Y-%m') as statement_period,
          b.billing_period as statement_date,
          b.flat_fee as base_fee,
          b.total_commission as commission,
          b.total_due,
          b.status,
          b.generated_at,
          -- Calculate due date and grace period
          DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
          DATE_ADD(DATE_ADD(b.billing_period, INTERVAL 1 MONTH), INTERVAL 7 DAY) as grace_period_end,
          -- Calculate delivery count from orders
          (SELECT COUNT(*) FROM orders o WHERE o.business_owner_id = b.owner_id AND DATE_FORMAT(o.order_created_at, '%Y-%m') = DATE_FORMAT(b.billing_period, '%Y-%m')) as delivery_count,
          -- Get actual delivery fees from orders
          (SELECT COALESCE(SUM(o.delivery_fee), 0)
           FROM orders o
           WHERE o.business_owner_id = b.owner_id
           AND DATE_FORMAT(o.order_created_at, '%Y-%m') = DATE_FORMAT(b.billing_period, '%Y-%m')) as total_delivery_fees
         FROM billing b
         WHERE b.owner_id = ?
         ORDER BY b.billing_period DESC`,
        [ownerId]
      );

      return statements.map(stmt => ({
        ...stmt,
        statement_date: stmt.statement_date,
        due_date: stmt.due_date,
        grace_period_end: stmt.grace_period_end,
        delivery_count: parseInt(stmt.delivery_count) || 0,
        total_delivery_fees: parseFloat(stmt.total_delivery_fees) || 0
      }));

    } catch (error) {
      console.error('Error getting statements by owner:', error);
      throw error;
    }
  }

  /**
   * Get statement by period
   * @param {number} ownerId - Business owner ID
   * @param {string} statementPeriod - Billing period in YYYY-MM format
   * @returns {Promise<Object|null>} - Statement or null
   */
  async getStatementByPeriod(ownerId, statementPeriod) {
    try {
      const [statements] = await this.db.query(
        `SELECT 
          b.billing_id as statement_id,
          b.owner_id,
          DATE_FORMAT(b.billing_period, '%Y-%m') as statement_period,
          b.billing_period as statement_date,
          b.flat_fee as base_fee,
          b.total_commission as commission,
          b.total_due,
          b.status,
          b.generated_at,
          DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
          DATE_ADD(DATE_ADD(b.billing_period, INTERVAL 1 MONTH), INTERVAL 7 DAY) as grace_period_end,
          ROUND(b.total_commission / 10) as delivery_count,
          -- Get actual delivery fees from orders
          (SELECT COALESCE(SUM(o.delivery_fee), 0) 
           FROM orders o 
           WHERE o.business_owner_id = b.owner_id 
           AND DATE_FORMAT(o.order_created_at, '%Y-%m') = DATE_FORMAT(b.billing_period, '%Y-%m')) as total_delivery_fees
         FROM billing b 
         WHERE b.owner_id = ? 
         AND DATE_FORMAT(b.billing_period, '%Y-%m') = ?`,
        [ownerId, statementPeriod]
      );

      if (statements.length === 0) {
        return null;
      }

      const stmt = statements[0];
      return {
        ...stmt,
        statement_date: stmt.statement_date,
        due_date: stmt.due_date,
        grace_period_end: stmt.grace_period_end,
        delivery_count: parseInt(stmt.delivery_count) || 0,
        total_delivery_fees: parseFloat(stmt.total_delivery_fees) || 0
      };

    } catch (error) {
      console.error('Error getting statement by period:', error);
      throw error;
    }
  }

  /**
   * Get pending statements (not paid and not suspended)
   * @returns {Promise<Array>} - Array of pending statements
   */
  async getPendingStatements() {
    try {
      const [statements] = await this.db.query(
        `SELECT 
          b.billing_id as statement_id,
          b.owner_id,
          DATE_FORMAT(b.billing_period, '%Y-%m') as statement_period,
          b.billing_period as statement_date,
          b.flat_fee as base_fee,
          b.total_commission as commission,
          b.total_due,
          b.status,
          b.generated_at,
          b.payment_proof_path,
          DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
          DATE_ADD(DATE_ADD(b.billing_period, INTERVAL 1 MONTH), INTERVAL 7 DAY) as grace_period_end,
          ROUND(b.total_commission / 10) as delivery_count,
          u.full_name,
          u.email,
          bo.company_name,
          -- Get actual delivery fees from orders
          (SELECT COALESCE(SUM(o.delivery_fee), 0) 
           FROM orders o 
           WHERE o.business_owner_id = b.owner_id 
           AND DATE_FORMAT(o.order_created_at, '%Y-%m') = DATE_FORMAT(b.billing_period, '%Y-%m')) as total_delivery_fees
         FROM billing b 
         JOIN businessowners bo ON b.owner_id = bo.owner_id
         JOIN users u ON bo.user_id = u.user_id
         WHERE b.status = 'pending'
         AND DATE_ADD(b.billing_period, INTERVAL 1 MONTH) >= NOW()
         ORDER BY b.billing_period ASC`
      );

      return statements.map(stmt => ({
        ...stmt,
        statement_date: stmt.statement_date,
        due_date: stmt.due_date,
        grace_period_end: stmt.grace_period_end,
        delivery_count: parseInt(stmt.delivery_count) || 0,
        total_delivery_fees: parseFloat(stmt.total_delivery_fees) || 0,
        has_payment_proof: !!stmt.payment_proof_path
      }));

    } catch (error) {
      console.error('Error getting pending statements:', error);
      throw error;
    }
  }

  /**
   * Update statement status
   * @param {number} statementId - Statement ID
   * @param {string} status - New status
   * @param {string} paymentProofPath - Path to payment proof (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async updateStatementStatus(statementId, status, paymentProofPath = null) {
    try {
      const updateData = [status];
      let updateQuery = 'UPDATE billing SET status = ?';
      
      if (paymentProofPath) {
        updateQuery += ', payment_proof_path = ?';
        updateData.push(paymentProofPath);
      }
      
      updateQuery += ' WHERE billing_id = ?';
      updateData.push(statementId);

      const [result] = await this.db.query(updateQuery, updateData);
      
      return result.affectedRows > 0;

    } catch (error) {
      console.error('Error updating statement status:', error);
      throw error;
    }
  }

  /**
   * Check and update overdue statements
   * @returns {Promise<Array>} - Updated statements
   */
  async checkOverdueStatements() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get statements that are overdue (past due date but not paid)
      const [overdueStatements] = await this.db.query(
        `SELECT billing_id, owner_id, DATE_FORMAT(billing_period, '%Y-%m') as statement_period
         FROM billing 
         WHERE status = 'pending' 
         AND DATE_ADD(billing_period, INTERVAL 1 MONTH) < ?`,
        [today]
      );

      const updatedStatements = [];
      
      for (const stmt of overdueStatements) {
        await this.updateStatementStatus(stmt.billing_id, 'overdue');
        updatedStatements.push(stmt);
      }

      return updatedStatements;

    } catch (error) {
      console.error('Error checking overdue statements:', error);
      throw error;
    }
  }

  /**
   * Check and suspend accounts past grace period
   * @returns {Promise<Array>} - Suspended accounts
   */
  async checkSuspensionCandidates() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get statements past grace period
      const [suspensionCandidates] = await this.db.query(
        `SELECT b.billing_id, b.owner_id, u.user_id, u.email
         FROM billing b
         JOIN businessowners bo ON b.owner_id = bo.owner_id
         JOIN users u ON bo.user_id = u.user_id
         WHERE b.status = 'overdue'
         AND DATE_ADD(DATE_ADD(b.billing_period, INTERVAL 1 MONTH), INTERVAL 7 DAY) < ?
         AND u.active_status = 'active'`,
        [today]
      );

      const suspendedAccounts = [];
      
      for (const candidate of suspensionCandidates) {
        // Update billing statement status
        await this.updateStatementStatus(candidate.billing_id, 'suspended');
        
        // Update user active status
        await this.db.query(
          'UPDATE users SET active_status = ? WHERE user_id = ?',
          ['inactive', candidate.user_id]
        );
        
        suspendedAccounts.push(candidate);
      }

      return suspendedAccounts;

    } catch (error) {
      console.error('Error checking suspension candidates:', error);
      throw error;
    }
  }

  /**
   * Generate statements for all active business owners
   * @param {string} statementPeriod - Billing period in YYYY-MM format
   * @returns {Promise<Array>} - Generated statements
   */
  async generateStatementsForAllOwners(statementPeriod) {
    try {
      // Get all active business owners
      const [owners] = await this.db.query(
        `SELECT bo.owner_id, bo.user_id, u.email
         FROM businessowners bo
         JOIN users u ON bo.user_id = u.user_id
         WHERE u.account_status = 'approved' AND u.active_status = 'active'`
      );

      const generatedStatements = [];
      
      for (const owner of owners) {
        try {
          // Get delivery count for the period (you might need to implement this)
          const deliveryCount = await this.getDeliveryCountForPeriod(owner.owner_id, statementPeriod);
          
          const statement = await this.generateStatement(owner.owner_id, statementPeriod, deliveryCount);
          generatedStatements.push(statement);
          
        } catch (error) {
          console.error(`Error generating statement for owner ${owner.owner_id}:`, error);
        }
      }

      return generatedStatements;

    } catch (error) {
      console.error('Error generating statements for all owners:', error);
      throw error;
    }
  }

  /**
   * Get delivery count for a specific period
   * @param {number} ownerId - Business owner ID
   * @param {string} statementPeriod - Billing period in YYYY-MM format
   * @returns {Promise<number>} - Delivery count
   */
  async getDeliveryCountForPeriod(ownerId, statementPeriod) {
    try {
      // This is a placeholder - you'll need to implement based on your delivery tracking
      // For now, return 0 as default
      return 0;
    } catch (error) {
      console.error('Error getting delivery count:', error);
      return 0;
    }
  }
}

module.exports = BillingStatementService;
