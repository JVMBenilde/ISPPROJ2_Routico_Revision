-- Orders table for trucking business management

CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  business_owner_id INT NOT NULL,
  
  -- Customer Information
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_email VARCHAR(255),
  
  -- Pickup Location
  pickup_address TEXT NOT NULL,
  pickup_location_lat DECIMAL(10, 8),
  pickup_location_lng DECIMAL(11, 8),
  
  -- Delivery Location
  delivery_address TEXT NOT NULL,
  delivery_location_lat DECIMAL(10, 8),
  delivery_location_lng DECIMAL(11, 8),
  
  -- Item Information
  item_description VARCHAR(500) NOT NULL,
  item_weight DECIMAL(10, 2),
  item_dimensions VARCHAR(100),
  special_instructions TEXT,
  
  -- Order Details
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  scheduled_date DATE,
  scheduled_time TIME,
  distance DECIMAL(10, 2),
  status ENUM('pending', 'confirmed', 'in-transit', 'delivered', 'cancelled') DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint (if you have a users table)
  -- FOREIGN KEY (business_owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
  
  INDEX idx_business_owner (business_owner_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

