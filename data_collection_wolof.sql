-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mar. 13 jan. 2026 à 13:03
-- Version du serveur : 8.2.0
-- Version de PHP : 8.2.13

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Base de données : `data_collection_wolof`

-- --------------------------------------------------------
-- Table users
-- --------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
  id varchar(20) NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(191) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  last_ip varchar(45) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table verifications
-- --------------------------------------------------------
DROP TABLE IF EXISTS verifications;
CREATE TABLE IF NOT EXISTS verifications (
  id int NOT NULL AUTO_INCREMENT,
  identifier varchar(191) NOT NULL,
  type varchar(50) NOT NULL,
  code varchar(10) NOT NULL,
  user_data longtext NOT NULL,
  expires_at datetime NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table uploads
-- --------------------------------------------------------
DROP TABLE IF EXISTS uploads;
CREATE TABLE IF NOT EXISTS uploads (
  id varchar(36) NOT NULL,
  audio_name varchar(255) NOT NULL,
  original_name varchar(255) DEFAULT NULL,
  audio_path varchar(255) NOT NULL,
  transcription text NOT NULL,
  traduction text NOT NULL,
  date_creation timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Mises à jour structure de users et uploads
ALTER TABLE users ADD COLUMN uploader_ref VARCHAR(32) DEFAULT NULL;

ALTER TABLE uploads
  ADD COLUMN uploader_ref VARCHAR(32) DEFAULT NULL,
  ADD COLUMN assigned_to VARCHAR(32) DEFAULT NULL,
  ADD COLUMN controlled_by VARCHAR(32) DEFAULT NULL,
  ADD COLUMN controlled_at DATETIME DEFAULT NULL,
  ADD COLUMN status CHAR(1) DEFAULT 'E',
  ADD COLUMN last_modified_by VARCHAR(32) DEFAULT NULL,
  ADD COLUMN last_modified_at DATETIME DEFAULT NULL,
  ADD COLUMN rejection_reason VARCHAR(255) DEFAULT NULL;

ALTER TABLE uploads
  ADD INDEX idx_assigned_to (assigned_to),
  ADD INDEX idx_controlled_by (controlled_by),
  ADD INDEX idx_status (status);

-- --------------------------------------------------------
-- Table admins
-- --------------------------------------------------------
DROP TABLE IF EXISTS admins;
CREATE TABLE IF NOT EXISTS admins (
  id varchar(32) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(100) DEFAULT NULL,
  username VARCHAR(50) NOT NULL,
  phone varchar(20) DEFAULT NULL,
  uploader_ref varchar(32) DEFAULT NULL,
  password_hash varchar(255) DEFAULT NULL,
  role varchar(50) DEFAULT 'validator',
  is_superadmin BOOLEAN DEFAULT FALSE,
  is_first_login tinyint(1) DEFAULT 1,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  last_login_at datetime DEFAULT NULL,
  last_ip varchar(45) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email),
  UNIQUE KEY uq_admins_phone (phone),
  UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE admins 
  ADD COLUMN temp_password VARCHAR(50) DEFAULT NULL,
  ADD COLUMN permissions VARCHAR(255) DEFAULT NULL;

-- Mettre à jour les permissions par défaut
UPDATE admins 
  SET permissions = 'edit_transcription,validate,reject,delete' 
  WHERE role = 'validator';

UPDATE admins 
  SET permissions = 'edit_transcription,validate,reject,delete,export,archive' 
  WHERE role = 'controller';

UPDATE admins SET role = 'validator' WHERE role IN ('linguist');

-- --------------------------------------------------------
-- Table audit_logs
-- --------------------------------------------------------
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE IF NOT EXISTS audit_logs (
  id int NOT NULL AUTO_INCREMENT,
  audio_id varchar(32) NOT NULL,
  admin_id varchar(32) DEFAULT NULL,
  action varchar(50) NOT NULL,
  old_data longtext,
  new_data longtext,
  reason varchar(255) DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insertion du compte Super Admin
INSERT INTO admins (id, name, email, username, password_hash, is_superadmin, is_first_login) 
VALUES (
    'super_admin_001',
    'Super Administrateur',
    'super@wolof.local',
    'superadmin',
    '2y$10$3mQqxgjXS0GALa2JjwclKuWqg9ssMcrv./NQT5x8oO6cgEh1uNnra',
    TRUE,
    1
);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;