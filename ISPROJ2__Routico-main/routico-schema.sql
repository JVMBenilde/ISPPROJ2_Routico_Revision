-- Create Routico Database
CREATE DATABASE IF NOT EXISTS routico_db;
USE routico_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  phone VARCHAR(20),
  account_status VARCHAR(20) DEFAULT 'pending',
  active_status VARCHAR(20) DEFAULT 'inactive',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  role VARCHAR(50) DEFAULT 'user'
);

-- Business Owners table
CREATE TABLE IF NOT EXISTS businessowners (
  owner_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_name VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255),
  address TEXT,
  contact_number VARCHAR(20)
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  driver_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT,
  user_id INT,
  license_number VARCHAR(50),
  FOREIGN KEY (owner_id) REFERENCES businessowners(owner_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Trucks table
CREATE TABLE IF NOT EXISTS trucks (
  truck_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT,
  plate_number VARCHAR(50),
  model VARCHAR(100),
  capacity DECIMAL(10,2),
  status VARCHAR(20),
  FOREIGN KEY (owner_id) REFERENCES businessowners(owner_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  truck_id INT,
  business_owner_id INT,
  assigned_driver_id INT,
  customer_id INT,
  weight DECIMAL(10,2),
  size VARCHAR(50),
  order_status VARCHAR(50) DEFAULT 'pending',
  proof_of_delivery TEXT,
  pickup_location VARCHAR(255),
  drop_off_location VARCHAR(255),
  scheduled_delivery_time DATETIME,
  order_created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  order_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (truck_id) REFERENCES trucks(truck_id),
  FOREIGN KEY (business_owner_id) REFERENCES businessowners(owner_id),
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Delivery Status Logs table
CREATE TABLE IF NOT EXISTS deliverystatuslogs (
  status_log_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT,
  status VARCHAR(50),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Fleet Locations table
CREATE TABLE IF NOT EXISTS fleetlocations (
  fleet_location_id INT AUTO_INCREMENT PRIMARY KEY,
  truck_id INT,
  current_location VARCHAR(255),
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (truck_id) REFERENCES trucks(truck_id)
);

-- Issues Categories table
CREATE TABLE IF NOT EXISTS issuescategories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100),
  description TEXT
);

-- Issues table
CREATE TABLE IF NOT EXISTS issues (
  issue_id INT AUTO_INCREMENT PRIMARY KEY,
  reported_by INT,
  order_id INT,
  category_id INT,
  description TEXT,
  proof_attachment TEXT,
  status VARCHAR(20) DEFAULT 'open',
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reported_by) REFERENCES users(user_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (category_id) REFERENCES issuescategories(category_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  message VARCHAR(255),
  status VARCHAR(20) DEFAULT 'unread',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Route Optimization table
CREATE TABLE IF NOT EXISTS routeoptimization (
  route_id INT AUTO_INCREMENT PRIMARY KEY,
  multi_order_group_id INT,
  start_location VARCHAR(255),
  destination VARCHAR(255),
  estimated_distance DECIMAL(10,2),
  estimated_time TIME,
  optimized_route TEXT,
  fuel_efficiency DECIMAL(10,2)
);

-- Route Orders table
CREATE TABLE IF NOT EXISTS routeorders (
  route_order_id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT,
  order_id INT,
  FOREIGN KEY (route_id) REFERENCES routeoptimization(route_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT,
  payment_proof VARCHAR(255),
  payment_date DATETIME,
  approval_status VARCHAR(50) DEFAULT 'pending',
  FOREIGN KEY (owner_id) REFERENCES businessowners(owner_id)
);

-- Billing table
CREATE TABLE IF NOT EXISTS billing (
  billing_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT,
  billing_period DATE,
  flat_fee DECIMAL(10,2),
  total_commission DECIMAL(10,2),
  total_due DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  payment_proof_path VARCHAR(255),
  FOREIGN KEY (owner_id) REFERENCES businessowners(owner_id)
);

-- Tracking table
CREATE TABLE IF NOT EXISTS tracking (
  tracking_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT,
  driver_id INT,
  current_location VARCHAR(255),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  generated_by INT,
  report_type VARCHAR(100),
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_path TEXT,
  FOREIGN KEY (generated_by) REFERENCES users(user_id)
);

-- System Logs table
CREATE TABLE IF NOT EXISTS systemlogs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action_type VARCHAR(255),
  affected_table VARCHAR(255),
  affected_record_id INT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
