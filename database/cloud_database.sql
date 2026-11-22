-- ============================================================================
-- CLOUD COMPATIBLE DATABASE SCRIPT (Render / TiDB / Railway / Aiven)
-- File: database/cloud_database.sql
-- ============================================================================
-- This script does NOT force CREATE DATABASE, so it works seamlessly inside
-- any cloud database provider (such as TiDB, Aiven, Railway, or Clever Cloud).

-- 1. Drop existing tables in reverse dependency order (Child -> Parent)
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `accounts`;
DROP TABLE IF EXISTS `customers`;

-- 2. Table: customers
CREATE TABLE `customers` (
  `customer_id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `mobile_number` VARCHAR(20) NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `address` TEXT NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_email` (`email`),
  INDEX `idx_customers_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: accounts
CREATE TABLE `accounts` (
  `account_id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `account_number` VARCHAR(20) NOT NULL UNIQUE,
  `account_type` ENUM('Savings', 'Current', 'Salary') NOT NULL DEFAULT 'Savings',
  `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `account_status` ENUM('Active', 'Suspended', 'Closed') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  INDEX `idx_accounts_account_number` (`account_number`),
  INDEX `idx_accounts_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: transactions
CREATE TABLE `transactions` (
  `transaction_id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_number` VARCHAR(40) NOT NULL UNIQUE,
  `account_id` INT NOT NULL,
  `transaction_type` ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_CREDIT') NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `balance_after` DECIMAL(15, 2) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `related_account_number` VARCHAR(20) DEFAULT NULL,
  `transaction_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `transaction_status` ENUM('SUCCESS', 'FAILED', 'PENDING') NOT NULL DEFAULT 'SUCCESS',
  FOREIGN KEY (`account_id`) 
    REFERENCES `accounts` (`account_id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  INDEX `idx_transactions_account_id` (`account_id`),
  INDEX `idx_transactions_reference_number` (`reference_number`),
  INDEX `idx_transactions_date` (`transaction_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Seed Pre-configured Demo Accounts
-- Password for both demo accounts: password123
INSERT INTO `customers` (
  `customer_id`, `full_name`, `email`, `mobile_number`, `date_of_birth`, `address`, `username`, `password_hash`
) VALUES 
(
  1,
  'John Doe',
  'john.doe@example.com',
  '9876543210',
  '1998-05-15',
  '123 Financial Avenue, Tech City, NY 10001',
  'john_doe',
  '$2b$10$lc6Ug72oWoxp7QBDJhmgDuwpojB.iqdGuzZt4s2YNQhbDY5qACoSq'
),
(
  2,
  'Jane Smith',
  'jane.smith@example.com',
  '9876543211',
  '2000-08-22',
  '456 Innovation Park, Metro City, CA 90210',
  'jane_smith',
  '$2b$10$lc6Ug72oWoxp7QBDJhmgDuwpojB.iqdGuzZt4s2YNQhbDY5qACoSq'
);

INSERT INTO `accounts` (
  `account_id`, `customer_id`, `account_number`, `account_type`, `balance`, `account_status`
) VALUES 
(1, 1, '1001002001', 'Savings', 2500.00, 'Active'),
(2, 2, '1001002002', 'Savings', 1800.00, 'Active');

INSERT INTO `transactions` (
  `reference_number`, `account_id`, `transaction_type`, `amount`, `balance_after`, `description`, `related_account_number`, `transaction_date`, `transaction_status`
) VALUES 
('TXN-INIT-001', 1, 'DEPOSIT', 2000.00, 2000.00, 'Initial Account Opening Deposit', NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), 'SUCCESS'),
('TXN-INIT-002', 1, 'DEPOSIT', 700.00, 2700.00, 'Branch Cash Deposit', NULL, DATE_SUB(NOW(), INTERVAL 3 DAY), 'SUCCESS'),
('TXN-INIT-003', 1, 'WITHDRAWAL', 200.00, 2500.00, 'ATM Cash Withdrawal', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY), 'SUCCESS'),
('TXN-INIT-004', 2, 'DEPOSIT', 1800.00, 1800.00, 'Initial Account Opening Deposit', NULL, DATE_SUB(NOW(), INTERVAL 4 DAY), 'SUCCESS');
