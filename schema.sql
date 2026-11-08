-- Run this once. It creates the database, the 3 tables and a few sample items.
CREATE DATABASE IF NOT EXISTS labtrack;
USE labtrack;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','student') NOT NULL DEFAULT 'student',
  account_status ENUM('active','inactive') NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS equipment (
  equipment_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  location VARCHAR(100) DEFAULT '',
  total_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT NOT NULL DEFAULT 0,
  item_condition ENUM('Good','Fair','Needs repair') DEFAULT 'Good',
  status ENUM('active','archived') DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS borrow_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  equipment_id INT NOT NULL,
  quantity INT NOT NULL,
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  needed_until DATE NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('pending','approved','rejected','returned','damaged','resolved') NOT NULL DEFAULT 'pending',
  processed_by INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

INSERT INTO equipment (name, category, location, total_quantity, available_quantity, item_condition) VALUES
('Compound Microscope','Optics','Lab 1',10,8,'Good'),
('Digital Multimeter','Electronics','Lab 2',15,15,'Good'),
('Bunsen Burner','Heating','Lab 1',12,9,'Fair');

-- Demo accounts (admin / student) are created by server.js the first time it starts.
