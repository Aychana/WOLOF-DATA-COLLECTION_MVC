<?php

require_once __DIR__ . '/../models/AudioModel.php';
require_once __DIR__ . '/../models/AdminModel.php';

class AudioController
{
    private AudioModel $model;
    private string     $uploadDir;
    private string     $ffmpegPath;

    public function __construct()
    {
        $this->model      = new AudioModel();
        $this->uploadDir  = __DIR__ . '/../audios/';
       if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $localBin = __DIR__ . '/../bin/ffmpeg.exe';
            $this->ffmpegPath = file_exists($localBin) ? $localBin : 'ffmpeg';
        } else {
            $this->ffmpegPath = 'ffmpeg';
        }
    }

    public function getAll(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "success", "data" => $this->model->getAllAudios()]);
    }

    public function delete(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if ($_SERVER["REQUEST_METHOD"] !== "POST") { 
            $this->jsonError("Requête invalide."); 
            return; 
        }

        if (session_status() !== PHP_SESSION_ACTIVE) session_start();

        // Cas suppression totale (Superadmin uniquement)
        if (isset($_POST["action"]) && $_POST["action"] === "delete_all") {
            if (empty($_SESSION['is_superadmin'])) {
                $this->jsonError("Accès refusé. Action réservée au superadministrateur.");
                return;
            }
            $success = $this->model->deleteAll();
            echo json_encode([
                "status"  => $success ? "success" : "error",
                "message" => $success ? "Tous les audios ont été supprimés." : "Erreur suppression totale.",
            ]);
            return;
        }

        $uploader_ref  = $_SESSION['uploader_ref'] ?? null;
        $admin_id      = $_SESSION['admin_id'] ?? null;
        $admin_role    = $_SESSION['admin_role'] ?? '';
        $is_superadmin = !empty($_SESSION['is_superadmin']);

        if (!$uploader_ref && !$admin_id) {
            $this->jsonError("Non authentifié.");
            return;
        }

        $id = trim($_POST["id"] ?? '');
        if (!$id) { 
            $this->jsonError("ID manquant."); 
            return; 
        }

        $audio = $this->model->getById($id);
        if (!$audio) {
            $this->jsonError("Audio introuvable."); 
            return; 
        }

        $canDelete = false;

        if ($is_superadmin) {
            $canDelete = true;
        } elseif ($admin_role === 'controller') {
            // Le contrôleur ne peut supprimer QUE s'il a pris en charge cet audio
            if (($audio['controlled_by'] ?? '') === $admin_id) {
                $canDelete = true;
            } else {
                $this->jsonError("Vous devez d'abord prendre en charge cet audio pour pouvoir le supprimer.");
                return;
            }
        } elseif ($admin_role === 'validator') {
            // Le validateur ne peut JAMAIS supprimer
            $this->jsonError("Action non autorisée pour le rôle validateur.");
            return;
        } elseif ($uploader_ref && ($audio['uploader_ref'] ?? '') === $uploader_ref) {
            // Le contributeur ne supprime que ses audios au statut 'E'
            if (($audio['status'] ?? '') === 'E') {
                $canDelete = true;
            } else {
                $this->jsonError("Impossible de supprimer : l'audio est déjà en cours de traitement.");
                return;
            }
        }

        if (!$canDelete) {
            $this->jsonError("Accès refusé.");
            return;
        }

        // Traçabilité audit
        $this->model->logAudit(
            $id,
            'delete',
            $admin_id ? 'admin' : 'user',
            $admin_id ?: $uploader_ref,
            [
                'audio_name'    => $audio['audio_name'],
                'transcription' => $audio['transcription'],
                'traduction'    => $audio['traduction'],
                'status'        => $audio['status'],
                'role'          => $admin_role ?: 'contributor'
            ],
            null,
            'Suppression de l\'enregistrement'
        );

        $isStaff = ($is_superadmin || $admin_role === 'controller');
        $result = $this->model->delete($id, $isStaff ? '' : $uploader_ref);
        echo json_encode($result);
        exit;
    }
    public function upload(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        ini_set('display_errors', 0);

        if ($_SERVER["REQUEST_METHOD"] !== "POST") { 
                $this->jsonError("POST requis."); return; 
            }

        if (empty($_POST["transcription"]) || empty($_POST["traduction"])) {
            $this->jsonError("Transcription et traduction obligatoires."); return;
        }
        if (!isset($_FILES["audio"]) || $_FILES["audio"]["error"] !== UPLOAD_ERR_OK) {
            $this->jsonError("Aucun fichier audio reçu (erreur: " . ($_FILES["audio"]["error"] ?? "?") . ")."); return;
        }

        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            $this->jsonError("Vous devez être connecté pour uploader un audio."); return;
        }

        $transcription = trim($_POST["transcription"]);
        $traduction    = trim($_POST["traduction"]);
        $original_name = basename($_FILES["audio"]["name"]);
        $audio_tmp     = $_FILES["audio"]["tmp_name"];

        if (!file_exists($this->uploadDir)) mkdir($this->uploadDir, 0777, true);

        $ext = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
        if (!in_array($ext, ["wav", "mp3", "webm", "ogg", "m4a"], true)) {
            $this->jsonError("Format audio non supporté (WAV, MP3, WEBM, OGG acceptés)."); 
            return;
        }

        $guid       = $this->GUID();
        $final_name = $guid . ".wav";
        $final_path = $this->uploadDir . $final_name;

        // Étape 1 : Sauvegarde temporaire du flux audio brut reçu
        $temp_path = $this->uploadDir . $guid . "_temp." . $ext;
        if (!move_uploaded_file($audio_tmp, $temp_path)) {
            $this->jsonError("Impossible de sauvegarder le fichier temporaire."); 
            return;
        }

        // Étape 2 : Filtrage Acoustique (Mesure du volume sonore maximal)
        $volCmd = escapeshellcmd($this->ffmpegPath) . " -i " . escapeshellarg($temp_path) . " -af volumedetect -f null - 2>&1";
        @exec($volCmd, $volOutput, $volRet);
        $volText = implode(" ", $volOutput);

        // Extraction du max_volume (ex: "max_volume: -42.5 dB")
        if (preg_match('/max_volume:\s*(-?[\d\.]+)\s*dB/i', $volText, $matches)) {
            $maxVolume = (float)$matches[1];
            // Si le volume maximal est sous les -38 dB, l'enregistrement est quasi-muet ou inaudible
            if ($maxVolume < -38.0) {
                @unlink($temp_path);
                $this->jsonError("Volume sonore trop faible ou inaudible. Veuillez parler plus près du micro.");
                return;
            }
        }

        // Étape 3 : Conversion, Nettoyage des silences résiduels et Normalisation sonore (WAV 16kHz Mono 15s)
        $convertCmd = escapeshellcmd($this->ffmpegPath) . " -y -i " . escapeshellarg($temp_path)
                    . " -af \"silenceremove=start_periods=1:start_threshold=-35dB:stop_periods=1:stop_threshold=-35dB:stop_duration=1,loudnorm\""
                    . " -ar 16000 -ac 1 -t 15 " . escapeshellarg($final_path) . " 2>&1";
        
        @exec($convertCmd, $out, $ret);

        // DEBUG 2 : Si la conversion échoue, afficher la commande et le message d'erreur réel de FFmpeg
        if ($ret !== 0 || !file_exists($final_path) || filesize($final_path) === 0) {
            $debugMessage = "DEBUG Étape 3 (Code sortie: $ret) | Commande: " . $convertCmd . " | Message FFmpeg: " . implode(" --- ", $out);
            $this->jsonError($debugMessage);
            return;
        }

        // Nettoyage immédiat du fichier brut temporaire
        if (file_exists($temp_path)) {
            @unlink($temp_path);
        }

        // Vérification de l'intégrité du fichier converti
        if ($ret !== 0 || !file_exists($final_path) || filesize($final_path) === 0) {
            $this->jsonError("Erreur lors de la conversion et du traitement acoustique de l'audio.");
            return;
        }

        // Étape 3.1 : Mesure de la durée exacte du fichier WAV final produit
        $probeCmd = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' && file_exists(__DIR__ . '/../bin/ffprobe.exe'))
                    ? escapeshellcmd(__DIR__ . '/../bin/ffprobe.exe')
                    : 'ffprobe';

        $durCmd = $probeCmd . " -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 " . escapeshellarg($final_path) . " 2>&1";
        @exec($durCmd, $durOutput, $durRet);
        
        $duration = 0.0;
        if (!empty($durOutput) && is_numeric(trim($durOutput[0]))) {
            $duration = round((float)trim($durOutput[0]), 2);
        }

        // Étape 4 : Insertion en base de données
        $audio_path_db = "audios/" . $final_name;
        $success = $this->model->insert(
            $guid, $final_name, $original_name,
            $audio_path_db, $duration, $transcription, $traduction,
            $uploader_ref
        );

        if ($success) {
            // Traçabilité de l'upload initial
            $this->model->logAudit(
                $guid,
                'upload',
                'user',
                $uploader_ref,
                null,
                [
                    'original_name' => $original_name,
                    'transcription' => $transcription,
                    'traduction'    => $traduction
                ]
            );

            $this->jsonSuccess("Enregistrement réussi !");
        } else {
            @unlink($final_path);
            $this->jsonError("Erreur enregistrement en base.");
        }
    }

    public function getUserHistory(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            echo json_encode(["status" => "error", "message" => "Utilisateur non connecté."]); return;
        }

        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 0;
        echo json_encode(["status" => "success", "data" => $this->model->getByUploaderRef($uploader_ref, $limit)]);
    }

    public function updateUserUpload(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            $this->jsonError("POST requis."); return;
        }
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            $this->jsonError("Utilisateur non connecté."); return;
        }

        $id            = trim($_POST['id'] ?? '');
        $transcription = trim($_POST['transcription'] ?? '');
        $traduction    = trim($_POST['traduction'] ?? '');

        if (!$id || !$transcription || !$traduction) {
            $this->jsonError("Champs requis."); return;
        }

        $audio = $this->model->getById($id);
        if (!$audio || ($audio['uploader_ref'] ?? '') !== $uploader_ref) {
            $this->jsonError("Audio introuvable ou accès refusé."); return;
        }

        if (!in_array($audio['status'], ['E','R'], true)) {
            $this->jsonError("Seuls les audios non validés peuvent être modifiés."); return;
        }

        $success = $this->model->updateUserContentAndResetClaim($id, $transcription, $traduction, $uploader_ref);

        if ($success) {
            $this->model->logAudit(
                $id,
                'user_resubmit',
                'user',
                $uploader_ref,
                [
                    'transcription'   => $audio['transcription'],
                    'traduction'      => $audio['traduction'],
                    'status'          => $audio['status'],
                    'rejection_reason'=> $audio['rejection_reason']
                ],
                [
                    'transcription' => $transcription,
                    'traduction'    => $traduction,
                    'status'        => 'E'
                ],
                'Modification et renvoi en validation par le contributeur'
            );
        }
        echo json_encode([
            "status"  => $success ? "success" : "error",
            "message" => $success ? "Audio mis à jour avec et remis en attente de validation." : "Erreur de mise à jour.",
        ]);
    }

    public function export(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        if (empty($_SESSION['is_superadmin'])) {
            echo json_encode(["status" => "error", "message" => "Accès refusé. Export réservé aux superadmins."]);
            return;
        }

        $exportDir = __DIR__ . '/../dataset_creation/audios/';
        $jsonlPath  = __DIR__ . '/../dataset_creation/dataset.jsonl';
        $result    = $this->model->exportDataset($exportDir, $jsonlPath);

        // Si aucun audio n'est au statut Contrôlé ('C')
        if ($result['total'] === 0) {
            echo json_encode([
                "status"  => "error",
                "message" => "Aucun audio contrôlé (statut 'C') disponible pour l'exportation."
            ]);
            return;
        }

        $archived  = $this->model->archiveExportedDataset();

        echo json_encode([
            "status"  => "success",
            "file"    => "dataset.jsonl",
            "total"   => $result['total'],
            "archived" => $archived,
        ]);
    }

    private function GUID(): string
    {
        if (function_exists('com_create_guid')) return trim(com_create_guid(), '{}');
        return sprintf('%04X%04X-%04X-%04X-%04X-%04X%04X%04X',
            mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535),
            mt_rand(16384,20479), mt_rand(32768,49151),
            mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535)
        );
    }

    private function jsonError(string $msg): void  { echo json_encode(["status"=>"error",   "message"=>$msg]); exit; }
    private function jsonSuccess(string $msg): void { echo json_encode(["status"=>"success", "message"=>$msg]); exit; }
}
?>