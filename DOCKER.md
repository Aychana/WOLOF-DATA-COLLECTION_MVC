Documentation Technique Docker - Architecture et Prise en Main

Ce document décrit l'infrastructure conteneurisée du projet application web de collecte de données wolof, les fichiers de configuration Docker, ainsi que les procédures d'installation, d'exécution et de maintenance.

1. Vue d'Ensemble de l'Architecture

L'application s'appuie sur deux conteneurs principaux orchestrés via Docker Compose :

Serveur Web (wolof_app_web) :

Image basée sur php:8.3-apache.

Dépendances système : ffmpeg, libpng-dev, libjpeg-dev, libfreetype6-dev, zip, unzip, git.

Extensions PHP : pdo, pdo_mysql, mysqli, gd.

Configuration Apache : Réécriture d'URL activée (mod_rewrite), DocumentRoot pointant vers /var/www/html/public, support des fichiers .htaccess.

Mappage de ports : 8081 (Hôte) -> 80 (Conteneur).

Base de Données (wolof_app_db) :

Image officielle mysql:8.0.

Initialisation automatique via l'injection du fichier ./database.sql.

Stockage persistant via le volume nommé db_data.

Mappage de ports : 3307 (Hôte) -> 3306 (Conteneur).

2. Configuration des Fichiers Docker

2.1 Dockerfile (Dockerfile)

FROM php:8.3-apache

# 1. Installation des dépendances système Linux et de FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    zip \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Configuration et installation des extensions PHP requises
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) mysqli pdo pdo_mysql gd

# 3. Activation du module de réécriture Apache et configuration du DocumentRoot
RUN a2enmod rewrite
RUN sed -i 's|/var/www/html|/var/www/html/public|g' /etc/apache2/sites-available/000-default.conf
RUN sed -i 's|/var/www/html|/var/www/html/public|g' /etc/apache2/apache2.conf
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# 4. Copie du code source du projet dans le conteneur
COPY . /var/www/html/

# 5. Attributs de propriété et permissions sur le dossier web pour les uploads
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html

# 6. Exposition du port HTTP standard
EXPOSE 80


2.2 Composition des Services (compose.yaml)

services:
  # ---------------------------------------------------------------------------
  # Service 1 : Serveur Web (PHP 8.3 + Apache + FFmpeg)
  # ---------------------------------------------------------------------------
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wolof_app_web
    ports:
      - "8081:80"
    volumes:
      - .:/var/www/html
    environment:
      DB_HOST: ${DB_HOST}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
    depends_on:
      - db

  # ---------------------------------------------------------------------------
  # Service 2 : Base de données (MySQL 8.0)
  # ---------------------------------------------------------------------------
  db:
    image: mysql:8.0
    container_name: wolof_app_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3307:3306"
    volumes:
      - db_data:/var/lib/mysql
      - ./database.sql:/docker-entrypoint-initdb.d/init.sql

# -----------------------------------------------------------------------------
# Déclaration des volumes persistants
# -----------------------------------------------------------------------------
volumes:
  db_data:


3. Variables d'Environnement (.env)

Un fichier .env doit être présent à la racine du projet avec les clés suivantes :

DB_HOST=db
DB_NAME=votre_nom_de_bdd
DB_USER=votre_utilisateur
DB_PASSWORD=votre_mot_de_passe
MYSQL_ROOT_PASSWORD=votre_mot_de_passe_root


Un fichier d'exemple .env.example est conservé dans le dépôt Git pour servir de modèle de configuration sans exposer de secrets.

4. Guide d'Installation et d'Exécution

4.1 Prérequis

Git

Docker Engine (version 20.10 ou supérieure)

Docker Compose (v2)

4.2 Démarrage Initial

Cloner le dépôt et se placer dans le répertoire :

git clone <repository_url>
cd <nom_dossier>


Configurer le fichier d'environnement :

cp .env.example .env


Construire les images et démarrer les conteneurs :

docker compose up -d --build


Accès au service web :

URL de l'application : http://localhost:8081

Connexion BDD externe (DBeaver/phpMyAdmin) : 127.0.0.1:3307

5. Commandes d'Exploitation et de Maintenance

5.1 Manipulation de l'Environnement

Mettre en pause les conteneurs (Fin de journée) :

docker compose stop


Relancer les conteneurs mis en pause :

docker compose start


Arrêter et supprimer les conteneurs et le réseau virtuel :

docker compose down


Arrêter et réinitialiser les volumes de la BDD (Attention : détruit les données locales) :

docker compose down -v


Redémarrer les services après mise à jour du code ou du Dockerfile :

docker compose up -d --build


5.2 Inspection et Diagnostics

Consulter l'état des conteneurs :

docker compose ps


Consulter les journaux d'erreurs (logs) :

docker compose logs -f web
docker compose logs -f db


Accéder au terminal Linux du conteneur Web :

docker exec -it wolof_app_web bash


Accéder directement à l'interface CLI MySQL :

docker exec -it wolof_app_db mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME}


6. Spécificités pour le Déploiement en Production

Pour le déploiement sur serveur distant, appliquer les modifications de sécurité suivantes dans le fichier compose.yaml :

Suppression du Bind Mount : Retirer la ligne - .:/var/www/html du service web pour figer le code source à l'intérieur de l'image Docker.

Isolation du port MySQL : Retirer la ligne ports: - "3307:3306" du service db. La base de données ne doit être accessible que par le conteneur web via l'hôte réseau db.

Mise à jour distante :

git pull origin main
docker compose up -d --build
