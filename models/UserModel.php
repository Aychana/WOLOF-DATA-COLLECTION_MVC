<?php
require_once __DIR__ . '/../config/database.php';

class UserModel {
    private $db;

    public function __construct() {
        $this->db = getDatabaseConnection();
    }

    private function columnExists(string $table, string $column): bool {
        $res = $this->db->query(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='" . $this->db->real_escape_string($table) . "' AND COLUMN_NAME='" . $this->db->real_escape_string($column) . "'"
        );
        if (!$res) {
            return false;
        }
        $row = $res->fetch_assoc();
        return (int)($row['cnt'] ?? 0) > 0;
    }

    /**
     * Vérifie si un email existe déjà
     * @param string $email
     * @return bool
     */
    public function emailExists(string $email): bool {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $stmt->close();

        return $count > 0;
    }

    /**
     * Crée un nouvel utilisateur et retourne son ID
     * @param string $name (nom complet)
     * @param string|null $email
     * @param string $ip (adresse IP pour traçabilité)
     * @param string|null $phone
     * @return string ID généré
     */
    public function createUser(string $name, ?string $email, string $ip, ?string $phone = null): string {
        $id = bin2hex(random_bytes(10));
        $uploader_ref = bin2hex(random_bytes(6));
        $cleanEmail = (!empty($email) && trim($email) !== '') ? trim($email) : null;
        $sql = "INSERT INTO users (id, name, email, uploader_ref, last_ip, phone) VALUES (?, ?, ?, ?, ?, ?)";
    
        $stmt = $this->db->prepare($sql);
        $stmt->bind_param("ssssss", $id, $name, $cleanEmail, $uploader_ref, $ip, $phone);
        
        if (!$stmt->execute()) {
            error_log("Erreur création user : " . $stmt->error);
            throw new Exception("Erreur lors de la création de l'utilisateur");
        }

        $stmt->close();
        return $id;
    }

    /**
     * Récupère un utilisateur par son ID
     * @param string $id
     * @return array|null
     */
    public function getById(string $id): ?array {
        $select = "SELECT id, name, email, uploader_ref";
        if ($this->columnExists('users', 'phone')) {
            $select .= ", phone";
        }
        if ($this->columnExists('users', 'created_at')) {
            $select .= ", created_at";
        }
        $select .= " FROM users WHERE id = ?";

        $stmt = $this->db->prepare($select);
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        return $user ?: null;
    }

    /**
     * Récupère un utilisateur par email (pour reconnexion)
     * @param string $email
     * @return array|null
     */
    public function getByEmail(string $email): ?array {
        $select = "SELECT id, name, email, uploader_ref";
        if ($this->columnExists('users', 'phone')) {
            $select .= ", phone";
        }
        $select .= " FROM users WHERE email = ?";

        $stmt = $this->db->prepare($select);
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        return $user ?: null;
    }

    public function getByPhone(string $phone): ?array {
        $cleanPhone = trim($phone);

        $stmt = $this->db->prepare("SELECT id, name, email, uploader_ref, phone FROM users WHERE phone = ?");
        $stmt->bind_param("s", $cleanPhone);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        return $user ?: null;
    }

    public function updatePhone(string $id, string $phone): bool {
        $cleanPhone = trim($phone);
        if (!$this->columnExists('users', 'phone')) {
            return false;
        }

        $stmt = $this->db->prepare("UPDATE users SET phone = ? WHERE id = ?");
        $stmt->bind_param("ss", $cleanPhone, $id);
        $success = $stmt->execute();
        $stmt->close();
        return $success;
    }

    public function updateEmail(string $id, string $email): bool {
        $stmt = $this->db->prepare("UPDATE users SET email = ? WHERE id = ?");
        $stmt->bind_param("ss", $email, $id);
        $success = $stmt->execute();
        $stmt->close();
        return $success;
    }
}