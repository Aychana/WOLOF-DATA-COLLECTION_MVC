-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: data_collection_wolof
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` varchar(32) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `uploader_ref` varchar(32) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'validator',
  `is_superadmin` tinyint(1) DEFAULT '0',
  `is_first_login` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` datetime DEFAULT NULL,
  `last_ip` varchar(45) DEFAULT NULL,
  `temp_password` varchar(50) DEFAULT NULL,
  `permissions` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admins_username` (`username`),
  UNIQUE KEY `uq_admins_email` (`email`),
  UNIQUE KEY `uq_admins_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES ('447d250dc94dbfba4539','Dominique Ndong','domique@gmail.com','Do',NULL,NULL,'$2y$10$oDGCXuxK.ob9XlV2u9xsHOJ.ySl/Iar8AMtQlaH09CR.SgiCdnv3a','validator',0,0,'2026-07-30 09:15:14','2026-07-30 09:29:03','::1',NULL,'edit_transcription,validate,reject,delete'),('74c45b0c6c2c1caefd68','Hawa Sall','hawa@gmail.com','hawa',NULL,NULL,'$2y$10$B/1bzExKHHbE44U6YQj6h.hzwvmAZhd4XBhGTdU0LD4HurroYCZqC','validator',0,0,'2026-07-29 15:05:43','2026-07-30 09:53:22','::1',NULL,'edit_transcription,validate,reject,delete'),('f0a17949de1d578876cf','Baba Faye','fayebaba@gmail.com','baba',NULL,NULL,'$2y$10$OFqQgKCgj9ksOv468RMxau7byxOnR2QAR0gok7coYr4YD5JJ07OS.','controller',0,0,'2026-07-30 09:16:03','2026-07-30 09:44:21','::1',NULL,'edit_transcription,validate,reject,delete'),('f7d1788de13999a45d47','too yo','tokoro@gmail.com','tokoro',NULL,NULL,'$2y$10$/1qNRwduE2kwexy61Rq.OubWxSXeGtjM4YYCCm1fov75FFbXOue7i','controller',0,0,'2026-07-29 15:06:14','2026-07-30 09:51:52','::1',NULL,'edit_transcription,validate,reject,delete'),('super_admin__01','Aycha','aycha@wolof.local','aycha',NULL,'','$2y$10$CoiHO0PUJli36zub1TZ4reYuI5KN3wRxjHDNodNLtDm.qWTzVVXZm','controller',1,0,'2026-07-29 08:38:57','2026-07-30 09:36:06','::1',NULL,'edit_transcription,validate,reject,delete,export,archive'),('super_admin_001','Super Administrateur','super@wolof.local','superadmin',NULL,NULL,'2y$10$3mQqxgjXS0GALa2JjwclKuWqg9ssMcrv./NQT5x8oO6cgEh1uNnra','validator',1,1,'2026-07-30 15:51:44',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `audio_id` varchar(32) NOT NULL,
  `admin_id` varchar(32) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `old_data` longtext,
  `new_data` longtext,
  `reason` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `uploads`
--

DROP TABLE IF EXISTS `uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uploads` (
  `id` varchar(36) NOT NULL,
  `audio_name` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `audio_path` varchar(255) NOT NULL,
  `transcription` text NOT NULL,
  `traduction` text NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `uploader_ref` varchar(32) DEFAULT NULL,
  `assigned_to` varchar(32) DEFAULT NULL,
  `controlled_by` varchar(32) DEFAULT NULL,
  `controlled_at` datetime DEFAULT NULL,
  `status` char(1) DEFAULT 'E',
  `last_modified_by` varchar(32) DEFAULT NULL,
  `last_modified_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_controlled_by` (`controlled_by`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `uploads`
--

LOCK TABLES `uploads` WRITE;
/*!40000 ALTER TABLE `uploads` DISABLE KEYS */;
INSERT INTO `uploads` VALUES ('291207AD-951B-4102-A0C8-162E36A4EA9E','291207AD-951B-4102-A0C8-162E36A4EA9E.wav','enregistrement.wav','audios/291207AD-951B-4102-A0C8-162E36A4EA9E.wav','VIDE','darra','2026-07-29 12:38:36','851ab9f26a26',NULL,NULL,NULL,'E','851ab9f26a26','2026-07-29 16:32:25',NULL),('3B7251AE-B6AF-42DD-B830-566E69E6FA20','3B7251AE-B6AF-42DD-B830-566E69E6FA20.wav','enregistrement.wav','audios/3B7251AE-B6AF-42DD-B830-566E69E6FA20.wav','danga téla gneuw','tu es venu tôt','2026-07-30 08:56:12','cd1cfe50a8c6',NULL,NULL,NULL,'E',NULL,NULL,NULL),('5A02A21A-0171-434F-AC3D-9F1320264D41','5A02A21A-0171-434F-AC3D-9F1320264D41.wav','enregistrement.wav','audios/5A02A21A-0171-434F-AC3D-9F1320264D41.wav','wa yaw loy deff fiiiii','Mais toi qu\'est ce que tu fais ici ?','2026-07-29 08:21:43','851ab9f26a26','4997f36d5d818ceaaf6f','f7d1788de13999a45d47','2026-07-30 09:37:55','V','4997f36d5d818ceaaf6f','2026-07-29 12:36:30',NULL),('9912F22B-B753-4084-8E7B-50FECFDC69FA','9912F22B-B753-4084-8E7B-50FECFDC69FA.wav','enregistrement.wav','audios/9912F22B-B753-4084-8E7B-50FECFDC69FA.wav','Ay wax','Des paroles','2026-07-29 16:27:13','851ab9f26a26','447d250dc94dbfba4539',NULL,NULL,'E','447d250dc94dbfba4539','2026-07-30 09:35:38',NULL),('B208F15B-CE6C-42F6-93B2-7391E34A2CB5','B208F15B-CE6C-42F6-93B2-7391E34A2CB5.wav','enregistrement.wav','audios/B208F15B-CE6C-42F6-93B2-7391E34A2CB5.wav','mingui dox wala doxoul','ça marche ou pas ?','2026-07-28 14:20:31','851ab9f26a26',NULL,NULL,NULL,'E','851ab9f26a26','2026-07-29 16:31:40',NULL);
/*!40000 ALTER TABLE `uploads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(191) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_ip` varchar(45) DEFAULT NULL,
  `uploader_ref` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('d92bf97c51ea603083d0','Utilisateur aichandongo1999','aichandongo1999@gmail.com','2026-07-30 08:52:38','::1','cd1cfe50a8c6'),('ffe397a96b0172c17ef6','Utilisateur aychana07','aychana07@gmail.com','2026-07-28 11:29:03','::1','851ab9f26a26');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `verifications`
--

DROP TABLE IF EXISTS `verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `identifier` varchar(191) NOT NULL,
  `type` varchar(50) NOT NULL,
  `code` varchar(10) NOT NULL,
  `user_data` longtext NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `verifications`
--

LOCK TABLES `verifications` WRITE;
/*!40000 ALTER TABLE `verifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'data_collection_wolof'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-30 16:12:53
