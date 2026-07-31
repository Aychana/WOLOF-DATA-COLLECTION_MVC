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
# AUTORISER LES FICHIERS .HTACCESS (Routage MVC)
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# 4. Copie du code source du projet dans le conteneur
COPY . /var/www/html/

# 5. Attributs de propriété et permissions sur le dossier web pour les uploads
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html

# 6. Exposition du port HTTP standard
EXPOSE 80