const bcrypt = require('bcryptjs');

class SubscriptionService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create free first month subscription when user is approved
   * @param {number} ownerId - Owner ID (user_id)
   * @param {string} approvalDate - Date when user was approved
   */
  async createFreeFirstMonth(ownerId, approvalDate) {
    try {
      const paymentDate = new Date(approvalDate);
      
      await this.db.query(
        `INSERT INTO subscriptions (owner_id, payment_proof, payment_date, approval_status) 
         VALUES (?, 'FREE_FIRST_MONTH', ?, 'approved')`,
        [ownerId, paymentDate]
      );

      // Create initial billing record
      await this.db.query(
        `INSERT INTO billing (owner_id, billing_period, flat_fee, total_commission, total_due, status, generated_at) 
         VALUES (?, ?, 0.00, 0.00, 0.00, 'free', NOW())`,
        [ownerId, paymentDate]
      );

      console.log(`Free first month subscription created for owner ${ownerId}`);
    } catch (error) {
      console.error('Error creating free first month subscription:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status for an owner
   * @param {number} ownerId - Owner ID
   * @returns {Promise<Object>} - Current subscription info
   */
  async getCurrentSubscription(ownerId) {
    try {
      const result = await this.db.query(
        `SELECT s.*, u.full_name, u.email 
         FROM subscriptions s 
         JOIN businessowners bo ON s.owner_id = bo.owner_id 
         JOIN users u ON bo.user_id = u.user_id 
         WHERE s.owner_id = ? 
         ORDER BY s.payment_date DESC 
         LIMIT 1`,
        [ownerId]
      );

      return result[0][0] || null;
    } catch (error) {
      console.error('Error getting current subscription:', error);
      throw error;
    }
  }

  /**
   * Get all subscriptions for an owner
   * @param {number} ownerId - Owner ID
   * @returns {Promise<Array>} - All subscriptions
   */
  async getOwnerSubscriptions(ownerId) {
    try {
      const result = await this.db.query(
        `SELECT s.*, u.full_name, u.email 
         FROM subscriptions s 
         JOIN businessowners bo ON s.owner_id = bo.owner_id 
         JOIN users u ON bo.user_id = u.user_id 
         WHERE s.owner_id = ? 
         ORDER BY s.payment_date DESC`,
        [ownerId]
      );

      return result[0];
    } catch (error) {
      console.error('Error getting owner subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get all pending payment proofs (Admin)
   * @returns {Promise<Array>} - Pending payment proofs
   */
  async getPendingPayments() {
    try {
      const result = await this.db.query(
        `SELECT s.*, u.full_name, u.email, u.phone, u.created_at
         FROM subscriptions s 
         JOIN businessowners bo ON s.owner_id = bo.owner_id 
         JOIN users u ON bo.user_id = u.user_id 
         WHERE s.approval_status = 'pending' 
         ORDER BY s.payment_date DESC`
      );

      // Add calculated due date for each payment
      const paymentsWithDueDate = result[0].map(payment => {
        const approvalDate = new Date(payment.created_at);
        const today = new Date();
        
        // Calculate how many months have passed since approval
        const monthsSinceApproval = (today.getFullYear() - approvalDate.getFullYear()) * 12 + 
                                   (today.getMonth() - approvalDate.getMonth());
        
        // Payment is due exactly one month after approval, then every month after that
        const nextDueMonth = monthsSinceApproval + 1;
        
        const dueDate = new Date(approvalDate);
        dueDate.setMonth(dueDate.getMonth() + nextDueMonth);
        // Keep the same day of the month as approval date
        
        // Calculate days until due (negative means overdue, positive means advance payment)
        const daysUntilDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        return {
          ...payment,
          payment_due_date: dueDate.toISOString(),
          days_until_due: daysUntilDue
        };
      });

      return paymentsWithDueDate;
    } catch (error) {
      console.error('Error getting pending payments:', error);
      throw error;
    }
  }

  /**
   * Get all suspended accounts (both with and without payment submissions)
   * @returns {Array} Array of suspended accounts with payment status
   */
  async getAllSuspendedAccounts() {
    try {
      const result = await this.db.query(
        `SELECT 
           u.user_id,
           u.full_name, 
           u.email, 
           u.phone,
           u.active_status,
           u.account_status,
           u.created_at,
           bo.owner_id,
           s.subscription_id,
           s.approval_status,
           s.payment_date,
           s.payment_proof,
           b.billing_period,
           b.status as billing_status,
           CASE 
             WHEN s.subscription_id IS NULL THEN 'no_submission'
             WHEN s.approval_status = 'pending' THEN 'pending_review'
             WHEN s.approval_status = 'rejected' THEN 'rejected'
             WHEN s.approval_status = 'approved' THEN 'approved'
             ELSE 'unknown'
           END as payment_status
         FROM users u 
         JOIN businessowners bo ON u.user_id = bo.user_id 
         LEFT JOIN subscriptions s ON bo.owner_id = s.owner_id 
         LEFT JOIN billing b ON bo.owner_id = b.owner_id
         WHERE u.role = 'business_owner' 
           AND u.account_status = 'approved' 
           AND u.active_status = 'inactive'
         ORDER BY u.full_name, s.payment_date DESC`
      );

      // Group by user to get the latest payment status for each user
      const userMap = new Map();
      
      result[0].forEach(row => {
        const userId = row.user_id;
        
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: row.user_id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            owner_id: row.owner_id,
            active_status: row.active_status,
            account_status: row.account_status,
            latest_submission: null,
            payment_status: 'no_submission',
            submission_count: 0,
            billing_period: row.billing_period,
            billing_status: row.billing_status,
            payment_due_date: null,
            days_overdue: null
          });
        }
        
        const user = userMap.get(userId);
        
        // If this row has a subscription, update the latest submission info
        if (row.subscription_id) {
          user.submission_count++;
          
          // Keep the most recent submission
          if (!user.latest_submission || new Date(row.payment_date) > new Date(user.latest_submission.payment_date)) {
            user.latest_submission = {
              subscription_id: row.subscription_id,
              approval_status: row.approval_status,
              payment_date: row.payment_date,
              payment_proof: row.payment_proof
            };
            user.payment_status = row.payment_status;
          }
        }
        
        // Calculate payment due date based on approval date (created_at for approved users)
        if (row.created_at) {
          const approvalDate = new Date(row.created_at);
          const today = new Date();
          
          // Calculate how many months have passed since approval
          const monthsSinceApproval = (today.getFullYear() - approvalDate.getFullYear()) * 12 + 
                                     (today.getMonth() - approvalDate.getMonth());
          
          // Payment is due exactly one month after approval, then every month after that
          const nextDueMonth = monthsSinceApproval + 1;
          
          const dueDate = new Date(approvalDate);
          dueDate.setMonth(dueDate.getMonth() + nextDueMonth);
          // Keep the same day of the month as approval date
          
          user.payment_due_date = dueDate.toISOString();
          
          // Calculate days overdue (negative means advance payment, positive means overdue)
          const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          user.days_overdue = daysDiff;
        }
      });

      return Array.from(userMap.values());
    } catch (error) {
      console.error('Error getting all suspended accounts:', error);
      throw error;
    }
  }

  /**
   * Upload payment proof
   * @param {number} ownerId - Owner ID
   * @param {string} filePath - Path to uploaded file
   * @param {number} amount - Payment amount (should be at least ₱2,000 for monthly fee)
   */
  async uploadPaymentProof(ownerId, filePath, amount) {
    try {
      // Validate payment amount (should be at least ₱2,000 for monthly subscription)
      if (amount < 2000) {
        throw new Error('Payment amount must be at least ₱2,000 (monthly subscription fee)');
      }

      // Create new subscription record with pending status
      await this.db.query(
        `INSERT INTO subscriptions (owner_id, payment_proof, payment_date, approval_status) 
         VALUES (?, ?, NOW(), 'pending')`,
        [ownerId, filePath]
      );

      console.log(`Payment proof uploaded for owner ${ownerId}, amount: ₱${amount}`);
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      throw error;
    }
  }

  /**
   * Approve payment proof (Admin)
   * @param {number} subscriptionId - Subscription ID
   * @param {number} adminUserId - Admin user ID who approved
   */
  async approvePayment(subscriptionId, adminUserId) {
    try {
      await this.db.query(
        `UPDATE subscriptions 
         SET approval_status = 'approved' 
         WHERE subscription_id = ?`,
        [subscriptionId]
      );

      // Get subscription details
      const subscription = await this.db.query(
        'SELECT * FROM subscriptions WHERE subscription_id = ?',
        [subscriptionId]
      );

      if (subscription[0].length > 0) {
        const sub = subscription[0][0];
        
        // Create billing record for the approved payment
        await this.db.query(
          `INSERT INTO billing (owner_id, billing_period, flat_fee, total_commission, total_due, status, generated_at) 
           VALUES (?, ?, 2000.00, 0.00, 2000.00, 'paid', NOW())`,
          [sub.owner_id, sub.payment_date]
        );

        // Ensure user account is active
        await this.db.query(
          'UPDATE users SET active_status = "active" WHERE user_id = ?',
          [sub.owner_id]
        );
      }

      console.log(`Payment approved for subscription ${subscriptionId}`);
    } catch (error) {
      console.error('Error approving payment:', error);
      throw error;
    }
  }

  /**
   * Reject payment proof (Admin)
   * @param {number} subscriptionId - Subscription ID
   * @param {number} adminUserId - Admin user ID who rejected
   */
  async rejectPayment(subscriptionId, adminUserId, reason) {
    try {
      await this.db.query(
        `UPDATE subscriptions 
         SET approval_status = 'rejected' 
         WHERE subscription_id = ?`,
        [subscriptionId]
      );

      // Get subscription details
      const subscription = await this.db.query(
        'SELECT owner_id FROM subscriptions WHERE subscription_id = ?',
        [subscriptionId]
      );

      if (subscription[0].length > 0) {
        // Set user account to inactive
        await this.db.query(
          'UPDATE users SET active_status = "inactive" WHERE user_id = ?',
          [subscription[0][0].owner_id]
        );
      }

      console.log(`Payment rejected for subscription ${subscriptionId}`);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      throw error;
    }
  }

  /**
   * Get billing information for an owner
   * @param {number} ownerId - Owner ID
   * @returns {Promise<Array>} - Billing records
   */
  async getOwnerBilling(ownerId) {
    try {
      const result = await this.db.query(
        `SELECT * FROM billing 
         WHERE owner_id = ? 
         ORDER BY billing_period DESC`,
        [ownerId]
      );

      return result[0];
    } catch (error) {
      console.error('Error getting owner billing:', error);
      throw error;
    }
  }

  /**
   * Create billing record for delivery commission
   * @param {number} ownerId - Owner ID
   * @param {number} deliveryCount - Number of deliveries
   * @param {string} billingPeriod - Billing period (YYYY-MM)
   */
  async createDeliveryBilling(ownerId, deliveryCount, billingPeriod) {
    try {
      const commission = deliveryCount * 10; // ₱10 per delivery
      const totalDue = 2000 + commission; // ₱2,000 base + commission

      await this.db.query(
        `INSERT INTO billing (owner_id, billing_period, flat_fee, total_commission, total_due, status, generated_at) 
         VALUES (?, ?, 2000.00, ?, ?, 'pending', NOW())`,
        [ownerId, billingPeriod, commission, totalDue]
      );

      console.log(`Delivery billing created for owner ${ownerId}: ${deliveryCount} deliveries = ₱${commission}`);
    } catch (error) {
      console.error('Error creating delivery billing:', error);
      throw error;
    }
  }

  /**
   * Check for overdue subscriptions and deactivate accounts
   */
  async checkOverdueSubscriptions() {
    try {
      // Find owners with no approved payment in the last 30 days
      const result = await this.db.query(
        `SELECT DISTINCT u.user_id 
         FROM users u 
         LEFT JOIN subscriptions s ON u.user_id = s.owner_id 
         WHERE u.role = 'business_owner' 
         AND u.active_status = 'active'
         AND (s.approval_status IS NULL OR s.approval_status != 'approved' OR s.payment_date < DATE_SUB(NOW(), INTERVAL 30 DAY))`
      );

      for (const user of result[0]) {
        // Deactivate user account
        await this.db.query(
          'UPDATE users SET active_status = "inactive" WHERE user_id = ?',
          [user.user_id]
        );

        console.log(`User ${user.user_id} deactivated due to overdue subscription`);
      }
    } catch (error) {
      console.error('Error checking overdue subscriptions:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionService;
