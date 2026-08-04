<?php
require_once __DIR__ . '/../config/database.php';

class AudioModel
{
    private mysqli $conn;

    public function __construct()
    {
        $this->conn = getDatabaseConnection();
    }

    // ===== SUPERADMIN : tout =====

    public function getAllAudios(): array
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        $ctrlCols = $hasControlled
            ? ", u.controlled_by, u.controlled_at, c.name AS controlled_admin_name"
            : ", NULL AS controlled_by, NULL AS controlled_at, NULL AS controlled_admin_name";
        $ctrlJoin = $hasControlled ? "LEFT JOIN admins c ON c.id = u.controlled_by" : "";

        $sql = "SELECT u.id, u.audio_name, u.audio_path, u.transcription, u.traduction,
                       u.uploader_ref, u.status, u.assigned_to, u.date_creation,
                       u.rejection_reason, u.last_modified_at,
                       a.name AS assigned_admin_name,
                       usr.name AS uploader_name
                       $ctrlCols
                FROM uploads u
                LEFT JOIN admins a ON a.id = u.assigned_to
                LEFT JOIN users usr ON usr.uploader_ref = u.uploader_ref
                $ctrlJoin
                ORDER BY u.date_creation DESC";
        $result = $this->conn->query($sql);
        $rows   = [];
        if ($result) while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    // ===== VALIDATEURS : E et R non encore pris par un autre =====

    public function getAvailableForValidators(): array
    {
        $sql = "SELECT u.id, u.audio_name, u.audio_path, u.transcription, u.traduction,
                       u.uploader_ref, u.status, u.assigned_to, u.date_creation,
                       u.rejection_reason,
                       a.name AS assigned_admin_name
                FROM uploads u
                LEFT JOIN admins a ON a.id = u.assigned_to
                WHERE u.status IN ('E', 'R')
                  AND (u.controlled_by IS NULL OR u.controlled_by = '')
                ORDER BY u.date_creation ASC";
        $result = $this->conn->query($sql);
        $rows   = [];
        if ($result) while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    /**
     * Claim atomique : assigner au validateur uniquement si l'audio
     * n'est pas encore pris OU déjà pris par ce validateur.
     * Retourne true si la claim a réussi, false si pris par un autre.
     */
    public function claimForValidator(string $audioId, string $adminId): bool
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads
             SET assigned_to = ?, last_modified_at = NOW()
             WHERE id = ?
               AND status IN ('E','R')
               AND (assigned_to IS NULL OR assigned_to = ?)"
        );
        $stmt->bind_param("sss", $adminId, $audioId, $adminId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    // ===== CONTRÔLEURS : V et R (contrôle qualité + réactivation) =====

    public function getValidatedForControllers(): array
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        $ctrlCols = $hasControlled
            ? ", u.controlled_by, u.controlled_at, c.name AS controlled_admin_name"
            : ", NULL AS controlled_by, NULL AS controlled_at, NULL AS controlled_admin_name";
        $ctrlJoin = $hasControlled ? "LEFT JOIN admins c ON c.id = u.controlled_by" : "";

        $sql = "SELECT u.id, u.audio_name, u.audio_path, u.transcription, u.traduction,
                       u.uploader_ref, u.status, u.assigned_to, u.date_creation,
                       u.rejection_reason,
                       a.name AS assigned_admin_name
                       $ctrlCols
                FROM uploads u
                LEFT JOIN admins a ON a.id = u.assigned_to
                $ctrlJoin
                WHERE u.status IN ('V', 'R', 'C')
                ORDER BY FIELD(u.status, 'C', 'R', 'V'), u.date_creation DESC";
        $result = $this->conn->query($sql);
        if (!$result) {
            error_log("getValidatedForControllers SQL error: " . $this->conn->error);
            return [];
        }
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    /**
     * Prise en charge exclusive par un contrôleur.
     */
    public function takeControl(string $audioId, string $adminId): bool
    {
        if (!$this->columnExists('uploads', 'controlled_by')) {
            return true;
        }
        $stmt = $this->conn->prepare(
            "UPDATE uploads
             SET controlled_by = ?, controlled_at = NOW()
             WHERE id = ?
               AND status IN ('V','R','C')
               AND (controlled_by IS NULL OR controlled_by = ?)"
        );
        $stmt->bind_param("sss", $adminId, $audioId, $adminId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    // ===== COMMUNES =====

    public function getById(string $id): ?array
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        $ctrlCols = $hasControlled ? ", u.controlled_by, u.controlled_at" : ", NULL AS controlled_by, NULL AS controlled_at";

        $stmt = $this->conn->prepare(
            "SELECT u.* $ctrlCols
             FROM uploads u
             WHERE u.id = ?"
        );
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row    = $result->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function getByUploaderRef(string $uploaderRef, int $limit = 0): array
    {
        $sql = "SELECT id, audio_name, original_name, audio_path, transcription, traduction, uploader_ref, status, rejection_reason, date_creation, last_modified_at FROM uploads WHERE uploader_ref = ? ORDER BY date_creation DESC";
        if ($limit > 0) {
            $sql .= " LIMIT " . intval($limit);
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->bind_param("s", $uploaderRef);
        $stmt->execute();
        $result = $stmt->get_result();

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        $stmt->close();
        return $rows;
    }

    public function updateStatus(string $id, string $status, ?string $adminId = null, ?string $rejectionReason = null): bool
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads SET status=?, last_modified_by=?, last_modified_at=NOW(), rejection_reason=? WHERE id=?"
        );
        $stmt->bind_param("ssss", $status, $adminId, $rejectionReason, $id);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function updateContent(string $id, string $transcription, string $traduction, ?string $adminId = null): bool
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads SET transcription=?, traduction=?, status = 'E', rejection_reason = NULL, last_modified_by=?, last_modified_at=NOW() WHERE id=?"
        );
        $stmt->bind_param("ssss", $transcription, $traduction, $adminId, $id);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function archiveAllValidated(?string $adminId = null): int
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        if ($hasControlled) {
            $stmt = $this->conn->prepare(
                "UPDATE uploads SET status='A', last_modified_by=?, last_modified_at=NOW()
                 WHERE status='V' AND controlled_by=?"
            );
            $stmt->bind_param("ss", $adminId, $adminId);
        } else {
            $stmt = $this->conn->prepare(
                "UPDATE uploads SET status='A', last_modified_by=?, last_modified_at=NOW()
                 WHERE status='V'"
            );
            $stmt->bind_param("s", $adminId);
        }
        $stmt->execute();
        $count = $stmt->affected_rows;
        $stmt->close();
        return $count;
    }

    public function delete(string $id, string $uploaderRef = ''): array
    {
        $audio    = $this->getById($id);
        if (!$audio) {
            return [
                "success" => false,
                "message" => "Audio introuvable."];
        }
        $filePath = __DIR__ . '/../' . $audio['audio_path'];

        if (!empty($uploaderRef) && $audio['uploader_ref'] !== $uploaderRef) {
            return [
                'success' => false, 
                'message' => 'Vous n\'avez pas l\'autorisation de supprimer cet audio.'
            ];
        }

        if ($audio['status'] !== 'E') {
            return [
                'success' => false, 
                'message' => 'Impossible de supprimer cet audio : il est déjà en cours de traitement ou validé.'
            ];
        }
        
        $filePath = __DIR__ . '/../' . $audio['audio_path'];
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
        $stmt = $this->conn->prepare("DELETE FROM uploads WHERE id=?");
        $stmt->bind_param("s", $id);
        $success = $stmt->execute();
        $stmt->close();

        if ($success) {
            return [
                'success' => true, 
                'message' => 'Audio supprimé avec succès.'
            ];
        }

        return [
            'success' => false, 
            'message' => 'Erreur lors de la suppression en base de données.'
        ];
       
    }

    public function deleteAll(): bool
    {
        $result = $this->conn->query("SELECT audio_path FROM uploads");
        while ($row = $result->fetch_assoc()) {
            $fp = __DIR__ . '/../' . $row['audio_path'];
            if (file_exists($fp)) @unlink($fp);
        }
        return $this->conn->query("DELETE FROM uploads") !== false;
    }

    public function exportDataset(string $exportDir, string $jsonPath): array
    {
        if (!file_exists($exportDir)) mkdir($exportDir, 0777, true);
        $result  = $this->conn->query(
            "SELECT id, audio_path, transcription, traduction FROM uploads WHERE status='C'"
        );
        $dataset = [];
        while ($row = $result->fetch_assoc()) {
            $source  = __DIR__ . '/../' . $row['audio_path'];
            $newName = $row['id'] . ".wav";
            $dest    = $exportDir . $newName;
            if (file_exists($source)) copy($source, $dest);
            $dataset[] = [
                "audio_path"    => "dataset_creation/audios/" . $newName,
                "transcription" => $row['transcription'],
                "traduction"    => $row['traduction'],
            ];
        }
        file_put_contents($jsonPath, json_encode($dataset, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return ['total' => count($dataset)];
    }

    public function archiveExportedDataset(): int
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads SET status='A', last_modified_at=NOW() WHERE status='C'"
        );
        $stmt->execute();
        $count = $stmt->affected_rows;
        $stmt->close();
        return $count;
    }

    /**
     * Insert — sans assignedTo (plus d'assignation automatique).
     * Signature corrigée : 7 paramètres au lieu de 8.
     */
    public function insert(
        string $id,
        string $audio_name,
        string $original_name,
        string $audio_path,
        string $transcription,
        string $traduction,
        string $uploader_ref
    ): bool {
        $stmt = $this->conn->prepare(
            "INSERT INTO uploads (id, audio_name, original_name, audio_path, transcription, traduction, uploader_ref, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'E')"
        );
        $stmt->bind_param("sssssss",
            $id, $audio_name, $original_name, $audio_path,
            $transcription, $traduction, $uploader_ref
        );
        $success = $stmt->execute();
        if (!$success) error_log("AudioModel::insert error: " . $stmt->error);
        $stmt->close();
        return $success;
    }

    public function getAverageValidationTimeForAdmin(string $adminId): array
    {
        $stmt = $this->conn->prepare(
            "SELECT
                COUNT(*) AS validation_count,
                AVG(TIMESTAMPDIFF(SECOND, u.date_creation, al.created_at)) AS avg_seconds
             FROM audit_logs al
             INNER JOIN uploads u ON u.id = al.audio_id
             WHERE al.action = 'status_change'
               AND al.admin_id = ?
               AND JSON_UNQUOTE(JSON_EXTRACT(al.new_data, '$.status')) = 'V'
               AND u.date_creation IS NOT NULL
               AND al.created_at IS NOT NULL
               AND al.created_at >= u.date_creation"
        );
        $stmt->bind_param("s", $adminId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : [];
        $stmt->close();

        $validationCount = (int)($row['validation_count'] ?? 0);
        $avgSeconds = $row['avg_seconds'] !== null ? (float)$row['avg_seconds'] : null;

        return [
            'validation_count' => $validationCount,
            'avg_seconds' => $avgSeconds !== null ? (int)round($avgSeconds) : null,
            'avg_label' => $avgSeconds !== null ? $this->formatDuration((int)round($avgSeconds)) : null,
        ];
    }

    private function formatDuration(int $seconds): string
    {
        $seconds = max(0, $seconds);
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%dh %02dm', $hours, $minutes);
        }

        if ($minutes > 0) {
            return $remainingSeconds > 0
                ? sprintf('%dm %02ds', $minutes, $remainingSeconds)
                : sprintf('%dm', $minutes);
        }

        return sprintf('%ds', $remainingSeconds);
    }

    // ===== DASHBOARD STATS =====

    public function getDashboardStats(int $days = 30): array
    {
        $dateFilter = $days > 0 ? "AND u.date_creation >= DATE_SUB(NOW(), INTERVAL $days DAY)" : "";

        // KPIs
        $kpis = [
            'total_submitted' => 0,
            'total_pending' => 0,
            'total_validated' => 0,
            'total_controlled' => 0,
            'total_rejected' => 0,
            'total_contributors' => 0,
            'validation_rate' => 0,
            'exportable_volume' => 0
        ];

        $kpiResult = $this->conn->query(
            "SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status='E' THEN 1 ELSE 0 END) AS submitted,
                SUM(CASE WHEN status='V' THEN 1 ELSE 0 END) AS validated,
                SUM(CASE WHEN status='C' THEN 1 ELSE 0 END) AS controlled,
                SUM(CASE WHEN status='R' THEN 1 ELSE 0 END) AS rejected
            FROM uploads u
            WHERE 1=1 $dateFilter"
        );
        if ($kpiResult) {
            $row = $kpiResult->fetch_assoc();
            $kpis['total_submitted'] = (int)($row['total'] ?? 0);
            $kpis['total_pending'] = (int)($row['submitted'] ?? 0);
            $kpis['total_validated'] = (int)($row['validated'] ?? 0);
            $kpis['total_controlled'] = (int)($row['controlled'] ?? 0);
            $kpis['total_rejected'] = (int)($row['rejected'] ?? 0);
            $kpis['exportable_volume'] = (int)($row['controlled'] ?? 0);
            $kpis['validation_rate'] = $kpis['total_submitted'] > 0
                ? round(($kpis['total_controlled'] / $kpis['total_submitted']) * 100, 1)
                : 0;
        }

        $contribResult = $this->conn->query(
            "SELECT COUNT(DISTINCT uploader_ref) AS cnt FROM uploads u WHERE uploader_ref IS NOT NULL AND uploader_ref != '' $dateFilter"
        );
        if ($contribResult) {
            $contribRow = $contribResult->fetch_assoc();
            $kpis['total_contributors'] = (int)($contribRow['cnt'] ?? 0);
        }

        // Daily stats (30 days)
        $dailyStats = [];
        $dailyResult = $this->conn->query(
            "SELECT 
                DATE(u.date_creation) AS date,
                COUNT(*) AS total,
                SUM(CASE WHEN status='E' THEN 1 ELSE 0 END) AS submitted,
                SUM(CASE WHEN status='V' THEN 1 ELSE 0 END) AS validated,
                SUM(CASE WHEN status='C' THEN 1 ELSE 0 END) AS controlled,
                SUM(CASE WHEN status='R' THEN 1 ELSE 0 END) AS rejected
            FROM uploads u
            WHERE u.date_creation >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(u.date_creation)
            ORDER BY u.date_creation ASC"
        );
        if ($dailyResult) {
            while ($row = $dailyResult->fetch_assoc()) {
                $dailyStats[] = [
                    'date' => $row['date'],
                    'submitted' => (int)($row['submitted'] ?? 0),
                    'validated' => (int)($row['validated'] ?? 0),
                    'controlled' => (int)($row['controlled'] ?? 0),
                    'rejected' => (int)($row['rejected'] ?? 0)
                ];
            }
        }

        // Team productivity
        $teamStats = [];
        $teamResult = $this->conn->query(
            "SELECT 
                a.id, a.name, a.role,
                COUNT(DISTINCT u.id) AS completed,
                SUM(CASE WHEN u.status IN ('E','R') THEN 1 ELSE 0 END) AS pending
            FROM admins a
            LEFT JOIN uploads u ON u.assigned_to = a.id $dateFilter
            WHERE a.role IN ('validator', 'controller')
            GROUP BY a.id, a.name, a.role
            ORDER BY a.role DESC, completed DESC"
        );
        if ($teamResult) {
            while ($row = $teamResult->fetch_assoc()) {
                $teamStats[] = [
                    'admin_id' => $row['id'],
                    'name' => $row['name'],
                    'role' => $row['role'],
                    'pending' => (int)($row['pending'] ?? 0),
                    'completed' => (int)($row['completed'] ?? 0)
                ];
            }
        }

        // Top contributors
        $topContributors = [];
        $topResult = $this->conn->query(
            "SELECT 
                u.uploader_ref,
                u2.name,
                COUNT(u.id) AS volume,
                SUM(CASE WHEN u.status='R' THEN 1 ELSE 0 END) AS rejected
            FROM uploads u
            LEFT JOIN users u2 ON u2.uploader_ref = u.uploader_ref
            WHERE 1=1 $dateFilter
            GROUP BY u.uploader_ref, u2.name
            ORDER BY volume DESC
            LIMIT 10"
        );
        if ($topResult) {
            while ($row = $topResult->fetch_assoc()) {
                $volume = (int)($row['volume'] ?? 0);
                $rejected = (int)($row['rejected'] ?? 0);
                $rejectionRate = $volume > 0 ? round(($rejected / $volume) * 100, 1) : 0;
                $topContributors[] = [
                    'name' => $row['name'] ?? 'Anonyme',
                    'volume' => $volume,
                    'rejection_rate' => $rejectionRate
                ];
            }
        }

        // Alerts
        $alerts = [];

        // Old pending audios
        $oldPendingResult = $this->conn->query(
            "SELECT COUNT(*) AS cnt FROM uploads 
            WHERE status IN ('E','R') AND date_creation <= DATE_SUB(NOW(), INTERVAL 14 DAY)"
        );
        if ($oldPendingResult) {
            $oldRow = $oldPendingResult->fetch_assoc();
            $oldCount = (int)($oldRow['cnt'] ?? 0);
            if ($oldCount > 0) {
                $alerts[] = [
                    'type' => 'pending_old',
                    'message' => "$oldCount audios en attente depuis 14+ jours",
                    'count' => $oldCount,
                    'severity' => 'warning'
                ];
            }
        }

        // Inactive validators/controllers
        $inactiveResult = $this->conn->query(
            "SELECT 
                a.id, a.name, a.role,
                MAX(u.last_modified_at) AS last_activity
            FROM admins a
            LEFT JOIN uploads u ON u.last_modified_by = a.id
            WHERE a.role IN ('validator', 'controller')
            GROUP BY a.id, a.name, a.role
            HAVING last_activity <= DATE_SUB(NOW(), INTERVAL 7 DAY) 
                   OR last_activity IS NULL"
        );
        if ($inactiveResult) {
            while ($row = $inactiveResult->fetch_assoc()) {
                $alerts[] = [
                    'type' => 'inactive_admin',
                    'message' => "{$row['name']} ({$row['role']}) inactif depuis 7+ jours",
                    'admin_id' => $row['id'],
                    'severity' => 'info'
                ];
            }
        }

        return [
            'kpis' => $kpis,
            'daily_stats' => $dailyStats,
            'team_productivity' => $teamStats,
            'top_contributors' => $topContributors,
            'alerts' => $alerts
        ];
    }

    private function columnExists(string $table, string $column): bool
    {
        $res = $this->conn->query(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$table' AND COLUMN_NAME='$column'"
        );
        if (!$res) return false;
        $row = $res->fetch_assoc();
        return (int)($row['cnt'] ?? 0) > 0;
    }
}
?>