# Documentation complète de la plateforme de collecte de données Wolof

## 1. Présentation générale
La plateforme est une application web PHP en architecture MVC destinée à collecter des échantillons audio en langue wolof, avec transcription et traduction, puis à les valider, contrôler et exporter dans un format exploitable pour la création d’un dataset.

Elle permet à plusieurs catégories d’acteurs d’interagir autour du cycle de vie d’un audio :
- contribution d’un utilisateur
- validation par un validateur
- contrôle qualité par un contrôleur
- supervision par un super administrateur

## 2. Objectifs métier
- Collecter des audios de qualité
- Assurer la traçabilité des contributions
- Gérer des workflows de validation et de contrôle
- Produire un dataset exportable
- Maintenir une logique d’audit des actions critiques

## 3. Acteurs et rôles
### 3.1 Contributeur / Utilisateur
Rôle principal de dépôt de contenu.
Actions possibles :
- se connecter avec un identifiant email ou téléphone
- recevoir un code OTP par email
- téléverser un audio
- saisir la transcription et la traduction
- consulter l’historique de ses contributions
- modifier un contenu encore en attente de validation

### 3.2 Validateur
Rôle chargé d’examiner les audios soumis.
Actions possibles :
- consulter la queue de validation
- prendre en charge un audio
- valider, rejeter ou éditer une transcription/traduction
- suivre les statistiques de travail

### 3.3 Contrôleur
Rôle chargé de vérifier et de contrôler les audios déjà validés.
Actions possibles :
- prendre en charge des audios validés ou rejetés
- contrôler la qualité
- réactiver ou corriger des contenus
- archiver les audios après traitement

### 3.4 Super administrateur
Rôle de supervision globale.
Actions possibles :
- gérer les validateurs et contrôleurs
- superviser les utilisateurs
- visualiser les statistiques globales
- gérer les audios
- exporter le dataset

### 3.5 Système
Le système gère :
- la connexion par OTP
- l’upload et le traitement audio
- l’archivage et l’export
- l’audit des actions utilisateur et administrateur

## 4. Architecture technique
### 4.1 Frontend
Le frontend est composé essentiellement de fichiers HTML, CSS et JavaScript dans le dossier views.
- views/user : interface contributeur
- views/admin : interfaces administrateur et super admin
Les pages JS assurent :
- les appels AJAX vers l’API interne
- la gestion du formulaire d’upload
- l’intégration du microphone
- l’affichage des tableaux et statuts

### 4.2 Backend
Le backend est écrit en PHP et suit une logique MVC simple.
- controllers : logique métier et traitement des requêtes
- models : accès aux données et logique SQL
- config : configuration base de données et email
- public : point d’entrée unique du site via index.php

### 4.3 Dépendances
- PHP 8+
- MySQL / MariaDB
- Composer
- PHPMailer
- FFmpeg pour le traitement audio

## 5. Structure du projet
### 5.1 Dossiers principaux
- controllers/ : AuthController, AudioController, AdminController, SuperAdminController
- models/ : UserModel, AudioModel, AdminModel, VerificationModel
- views/ : interfaces utilisateur et administrateur
- public/ : routeur principal index.php
- config/ : configuration base de données et mail
- dataset_creation/ : export du dataset et fichiers audios associés
- audios/ : stockage des audios téléversés

### 5.2 Fichiers clés
- public/index.php : centralise les routes et redirige vers les contrôleurs adaptés
- controllers/AuthController.php : authentification utilisateur par OTP
- controllers/AudioController.php : upload, historique, suppression, export dataset
- controllers/AdminController.php : gestion des validateurs/contrôleurs et workflow de validation
- controllers/SuperAdminController.php : supervision globale et gestion des administrateurs
- models/AudioModel.php : logique SQL pour les uploads et leurs statuts
- models/AdminModel.php : gestion des admins et permissions
- models/UserModel.php : gestion des contributeurs
- models/VerificationModel.php : stockage et vérification des OTP
- config/database.php : configuration de connexion MySQL
- config/mail.php : configuration SMTP

## 6. Modèle de données
### 6.1 Table users
Stocke les contributeurs.
Colonnes principales :
- id
- name
- email
- phone
- uploader_ref
- last_ip
- created_at

### 6.2 Table verifications
Stocke les OTP temporaires pour la connexion.
Colonnes principales :
- identifier
- type
- code
- user_data
- expires_at
- created_at

### 6.3 Table uploads
Contient les audios soumis par les utilisateurs.
Colonnes principales :
- id
- audio_name
- original_name
- audio_path
- transcription
- traduction
- uploader_ref
- status
- assigned_to
- controlled_by
- rejection_reason
- date_creation
- last_modified_at

### 6.4 Table admins
Contient les comptes validateurs, contrôleurs et super admin.
Colonnes principales :
- id
- name
- email
- username
- password_hash
- role
- permissions
- is_superadmin
- is_first_login

### 6.5 Table audit_logs
Enregistre les actions sensibles de modification des audios ou des comptes.

## 7. Flux fonctionnels principaux
### 7.1 Connexion contributeur
1. L’utilisateur saisit son email ou téléphone.
2. Le système crée ou retrouve un compte.
3. Un code OTP est généré et envoyé par email.
4. L’utilisateur valide le code sur la page de vérification.
5. Une session est créée et le contributeur peut téléverser des audios.

### 7.2 Téléversement d’un audio
1. Le contributeur renseigne la transcription et la traduction.
2. L’audio est soumis sous forme de fichier WAV ou MP3.
3. Le système vérifie la taille/durée et le type.
4. Si nécessaire, l’audio est converti en WAV mono à 16 kHz avec une limite de 15 secondes via FFmpeg.
5. L’enregistrement est inséré dans la table uploads avec le statut E.

### 7.3 Validation par un validateur
1. Le validateur consulte la queue de validation.
2. Un audio peut être “claimé” pour éviter les conflits.
3. Le validateur peut :
- modifier le contenu
- valider le contenu (statut V)
- rejeter le contenu (statut R)

### 7.4 Contrôle par un contrôleur
1. Le contrôleur consulte les audios validés ou rejetés.
2. Il peut prendre en charge un audio.
3. Il peut contrôler la qualité et provoquer un nouvel état.
4. Les audios contrôlés peuvent être archivés.

### 7.5 Export du dataset
1. Le super administrateur déclenche l’export.
2. Les audios avec statut C sont copiés vers dataset_creation/audios.
3. Un fichier dataset.json est généré contenant les références audio et leurs contenus.
4. Les audios exportés sont ensuite archivés.

## 8. Points d’entrée et routes
### 8.1 Routes publiques
- / : page d’accueil contributeur
- /login-user : connexion utilisateur
- /request-verification : demande OTP
- /verify-user : validation OTP
- /upload : téléversement audio
- /user-history : historique des contributions
- /user-profile : profil et statistiques

### 8.2 Routes administratives
- /loginAdmin : page de connexion administrateur
- /admin-login : authentification admin
- /get-audios-role : récupération des audios selon le rôle
- /update-audio-status : changement de statut
- /update-audio-content : modification de contenu
- /archive-all-validated : archivage des audios validés
- /take-control : prise en charge d’un audio par contrôleur

### 8.3 Routes super admin
- /superadmin-dashboard : tableau de bord
- /superadmin-get-admins : administrateurs
- /superadmin-get-users : utilisateurs
- /superadmin-get-audios : audios
- /superadmin-update-audio : modification d’un audio par super admin
- /superadmin-delete-audio : suppression d’un audio

## 9. Configuration et déploiement
### 9.1 Prérequis
- serveur web (WAMP/XAMPP/Apache)
- PHP 8+
- MySQL
- Composer
- FFmpeg installé et accessible au chemin spécifié dans le code

### 9.2 Étapes d’installation
1. Décompresser ou cloner le projet dans le dossier web du serveur.
2. Importer la base SQL fournie dans MySQL.
3. Configurer les accès de base de données dans config/database.php.
4. Configurer les paramètres SMTP dans config/mail.php.
5. Vérifier que le chemin FFmpeg est correct.
6. Accéder au projet via le navigateur.

### 9.3 Conseils de sécurité
- ne pas laisser les identifiants par défaut en production
- utiliser un mot de passe solide pour MySQL et les comptes admin
- protéger les dossiers sensibles et les fichiers audios
- vérifier l’hébergement des fichiers uploadés

## 10. Bonnes pratiques pour la maintenance
- conserver la logique d’audit
- centraliser les paramètres sensibles dans un fichier de configuration externe
- remplacer la logique de chemin FFmpeg codée en dur par une configuration
- prévoir des tests automatisés pour les workflows critiques
- documenter chaque évolution du statut des uploads

## 11. Recommandations pour les évolutions futures
- ajouter une API REST structurée
- introduire des tests unitaires et d’intégration
- améliorer le dashboard avec plus de métriques métier
- mettre en place un conteneur Docker
- ajouter des mécanismes de validation plus avancés (langue, qualité sonore, conformité)
- améliorer la gestion des droits par permission granulaires

## 12. Résumé opérationnel
La plateforme repose sur un workflow simple mais robuste : un contributeur dépose un audio, un validateur le traite, un contrôleur vérifie la qualité, puis un super administrateur supervise l’ensemble. L’architecture est modulaire et suffisamment claire pour permettre des évolutions futures sans réécrire l’application depuis zéro.
