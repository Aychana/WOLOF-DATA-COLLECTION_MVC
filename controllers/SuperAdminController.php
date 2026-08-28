<?php
require_once __DIR__ . '/../models/AdminModel.php';
require_once __DIR__ . '/../models/UserModel.php';
require_once __DIR__ . '/../models/AudioModel.php';
require_once __DIR__ . '/../config/database.php';

class SuperAdminController {
    private $adminModel;
    private $userModel;
    private $audioModel;
    private $db;

    public function __construct() {
        $this->adminModel = new AdminModel();
        $this->userModel  = new UserModel();
        $this->audioModel = new AudioModel();
        $this->db         = getDatabaseConnection();
    }

    private function requireSuperAdmin(): bool {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        return !empty($_SESSION['is_superadmin']);
    }

    private function jsonOut($data): void {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    // ===== DASHBOARD =====

    public function getDashboardStats(): void {
        if (!$this->requireSuperAdmin()) {
            $this->jsonOut(['error' => 'Accès refusé']);
        }

        $days = intval($_GET['days'] ?? 30);
        if ($days !== 0 && !in_array($days, [7, 30, 90], true)) {
            $days = 30;
        }

        $stats = $this->audioModel->getDashboardStats($days);
        $this->jsonOut($stats);
    }

    // ===== ADMINS =====

    public function getAdminsList(): void {
        if (!$this->requireSuperAdmin()) {
            $this->jsonOut(['error' => 'Accès refusé']);
        }
        $this->jsonOut($this->adminModel->getAllAdmins());
    }

    public function createAdmin(): array {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $name     = trim($_POST['name']     ?? '');
        $email    = trim($_POST['email']    ?? '');
        $username = trim($_POST['username'] ?? '');
        $role     = trim($_POST['role']     ?? 'validator');

        if (empty($name) || empty($email) || empty($username)) {
            return ['error' => 'Tous les champs sont requis'];
        }

        // Valider le rôle
        if (!in_array($role, ['validator', 'controller'])) {
            $role = 'validator';
        }

        $tempPassword = bin2hex(random_bytes(6)); // 12 caractères hex

        try {
            $adminId = $this->adminModel->createAdmin($name, $email, $username, $tempPassword, false, $role);
            return [
                'success'       => true,
                'admin_id'      => $adminId,
                'temp_password' => $tempPassword,
                'message'       => "Admin créé avec succès.",
            ];
        } catch (Exception $e) {
            return ['error' => 'Erreur création : ' . $e->getMessage()];
        }
    }

    public function updateAdmin(): array {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id   = trim($_POST['id']    ?? '');
        $name = trim($_POST['name']  ?? '');
        $email= trim($_POST['email'] ?? '');
        $role = trim($_POST['role']  ?? 'validator');

        if (empty($id) || empty($name) || empty($email)) {
            return ['error' => 'Champs requis manquants'];
        }

        if (!in_array($role, ['validator', 'controller'])) {
            $role = 'validator';
        }

        // Les permissions sont recalculées automatiquement depuis le rôle
        $permissions = AdminModel::ROLE_PERMISSIONS[$role];

        if ($this->adminModel->updateAdmin($id, $name, $email, $role, $permissions)) {
            return ['success' => true, 'message' => 'Admin mis à jour'];
        }
        return ['error' => 'Erreur mise à jour'];
    }

    public function deleteAdmin(): array {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        if (empty($id)) return ['error' => 'ID requis'];

        if ($this->adminModel->deleteAdmin($id)) {
            return ['success' => true, 'message' => 'Admin supprimé'];
        }
        return ['error' => 'Erreur suppression'];
    }

    // ===== USERS =====
    public function getUsersList(): void {
        if (!$this->requireSuperAdmin()) {
            $this->jsonOut(['error' => 'Accès refusé']);
        }

        $this->jsonOut($this->userModel->getAllUsers());
    }

    // Nouvelle méthode de suspension / réactivation
    public function toggleUserStatus(): void {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonOut(['error' => 'Accès refusé']);
        }

        $userId   = trim($_POST['id'] ?? '');
        $isActive = intval($_POST['is_active'] ?? 1);

        if (empty($userId)) {
            $this->jsonOut(['error' => 'ID utilisateur manquant']);
        }

        $success = $this->userModel->toggleActiveStatus($userId, $isActive);
        $actionName = $isActive === 1 ? 'réactivé' : 'suspendu';

        if ($success) {
            $this->audioModel->logAudit(
                'USER_' . $userId,
                'toggle_user_status',
                'admin',
                $_SESSION['admin_id'] ?? null,
                null,
                ['is_active' => $isActive],
                "Compte contributeur $actionName"
            );
            $this->jsonOut(['success' => true, 'message' => "Contributeur $actionName avec succès."]);
        } else {
            $this->jsonOut(['error' => 'Erreur lors de la mise à jour']);
        }
    }

    public function deleteUser(): array {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        if (empty($id)) return ['error' => 'ID requis'];

        $stmt = $this->db->prepare("DELETE FROM users WHERE id=?");
        $stmt->bind_param("s", $id);
        $ok = $stmt->execute();
        $stmt->close();

        return $ok
            ? ['success' => true, 'message' => 'Utilisateur supprimé']
            : ['error' => 'Erreur suppression'];
    }

    // ===== AUDIOS =====

    public function getAudiosList(): void {
        if (!$this->requireSuperAdmin()) {
            $this->jsonOut(['error' => 'Accès refusé']);
        }
        $this->jsonOut($this->audioModel->getAllAudios());
    }

    public function updateAudio(): array {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id            = trim($_POST['id']            ?? '');
        $assignedTo    = trim($_POST['assigned_to']   ?? '') ?: null;
        $status        = trim($_POST['status']         ?? '');
        $transcription = trim($_POST['transcription'] ?? '');
        $translation   = trim($_POST['translation']   ?? '');

        if (empty($id)) return ['error' => 'ID requis'];

        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $adminId = $_SESSION['admin_id'] ?? null;

        $oldAudio = $this->audioModel->getById($id);

        // Assigned_to
        $stmt = $this->db->prepare("UPDATE uploads SET assigned_to=? WHERE id=?");
        $stmt->bind_param("ss", $assignedTo, $id);
        $stmt->execute();
        $stmt->close();

        // Status + content
        $this->audioModel->updateStatus($id, $status, $adminId);
        $this->audioModel->updateContent($id, $transcription, $translation, $adminId);

        $this->audioModel->logAudit($id, 'superadmin_update', 'admin', $adminId, $oldAudio ? 
        ['status' => $oldAudio['status'],  'assigned_to' => $oldAudio['assigned_to']] : null,
        ['status' => $status, 'assigned_to' => $assignedTo],
        'Mise à jour directe SuperAdmin'
        );
        return ['success' => true, 'message' => 'Audio mis à jour'];
    }

    public function deleteAudio(): array {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        if (empty($id)) return ['error' => 'ID requis'];

        $audio = $this->audioModel->getById($id);
        if (!$audio) return ['error' => 'Audio non trouvé'];

        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $adminId = $_SESSION['admin_id'] ?? null;

        if ($this->audioModel->delete($id)) {
            $this->audioModel->logAudit(
                $id,
                'superadmin_delete',
                'admin',
                $adminId,
                $audio,
                null,
                'Suppression par SuperAdmin'
            );
            return ['success' => true, 'message' => 'Audio supprimé'];
        }
        return ['error' => 'Erreur suppression'];
    }

}
?>