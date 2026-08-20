const MAX_DURATION = 15; 

document.addEventListener("DOMContentLoaded", () => {
  const form            = document.getElementById("dataForm");
  const audioInput      = document.getElementById("audioInput");
  const recorderCircle  = document.getElementById("recorderCircle");
  const recorderText    = document.getElementById("recorderText");
  const fallbackBtn     = document.getElementById("fallbackUploadBtn");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const audioPreview    = document.getElementById("audioPreview");
  const previewPlayer   = document.getElementById("previewPlayer");
  const reRecordBtn     = document.getElementById("reRecordBtn");
  const submitBtn       = document.getElementById("submitBtn");
  const submitBtnLabel  = submitBtn ? submitBtn.querySelector(".submit-btn__label") : null;
  const SUBMIT_LABEL    = "Envoyer pour validation";

  // Éléments du modal d'enregistrement
  const recordingModal = document.getElementById("recordingModal");
  const timerFill      = document.getElementById("timerFill");
  const recElapsed     = document.getElementById("recElapsed");
  const waveCanvas     = document.getElementById("waveformCanvas");
  const stopBtn        = document.getElementById("stopBtn");
  const waveCtx        = waveCanvas ? waveCanvas.getContext("2d") : null;

  let mediaRecorder  = null;
  let audioChunks    = [];
  let activeStream   = null;
  let timerInterval  = null;
  let elapsedSeconds = 0;
  let isPaused       = false;
  let analyser       = null;
  let animFrameId    = null;
  const STORAGE_KEY = 'pendingUserUpload';

  fileNameDisplay.className  = "file-name-display";
  fileNameDisplay.textContent = "Aucun fichier sélectionné";

  const recentHistoryContainer = document.getElementById('recentHistory');
  restorePendingUpload();
  loadRecentHistory();

  function savePendingUploadAndRedirect() {
    const transcription = (document.getElementById("transcription").value || "").trim();
    const traduction    = (document.getElementById("traduction").value || "").trim();
    const file          = audioInput.files[0];
    const state = {
      transcription,
      traduction,
      audioName: file ? file.name : '',
      audioType: file ? file.type : 'audio/wav',
      audioDataUrl: ''
    };

    if (!file) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.location.href = 'login-user';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      state.audioDataUrl = reader.result;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.location.href = 'login-user';
    };
    reader.onerror = () => {
      console.error('Erreur lecture fichier pour restauration');
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.location.href = 'login-user';
    };
    reader.readAsDataURL(file);
  }

  function restorePendingUpload() {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    let state;
    try {
      state = JSON.parse(saved);
    } catch (err) {
      console.error('Impossible de lire l état stocké', err);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (!state) return;

    if (state.transcription) {
      document.getElementById("transcription").value = state.transcription;
    }
    if (state.traduction) {
      document.getElementById("traduction").value = state.traduction;
    }
    if (state.audioDataUrl) {
      previewPlayer.src = state.audioDataUrl;
      audioPreview.classList.remove("hidden");
      fileNameDisplay.textContent = state.audioName || "Fichier sélectionné";
      if (state.audioName) {
        fetch(state.audioDataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], state.audioName, { type: state.audioType || 'audio/wav' });
            const dt = new DataTransfer();
            dt.items.add(file);
            audioInput.files = dt.files;
          })
          .catch(err => console.error('Erreur restauration audio:', err));
      }
    }
  }

  // Fonction pour mesurer la durée réelle même en cas de bug Infinity sur Chrome
  function getSafeAudioDuration(file) {
    return new Promise((resolve) => {
      const tempUrl = URL.createObjectURL(file);
      const tempAudio = new Audio(tempUrl);

      tempAudio.addEventListener("loadedmetadata", () => {
        if (tempAudio.duration && tempAudio.duration !== Infinity && !isNaN(tempAudio.duration)) {
          URL.revokeObjectURL(tempUrl);
          resolve(tempAudio.duration);
          return;
        }

        // Force la tête de lecture pour récupérer la durée réelle
        tempAudio.currentTime = 1e101;
        tempAudio.addEventListener("timeupdate", function onTimeUpdate() {
          tempAudio.removeEventListener("timeupdate", onTimeUpdate);
          tempAudio.currentTime = 0;
          const realDuration = tempAudio.duration;
          URL.revokeObjectURL(tempUrl);
          resolve(realDuration === Infinity || isNaN(realDuration) ? 0 : realDuration);
        });
      });

      tempAudio.addEventListener("error", () => {
        URL.revokeObjectURL(tempUrl);
        resolve(0);
      });
    });
  }

  // ===== Upload fichier =====
  audioInput.addEventListener("change", async () => {
    const file = audioInput.files[0];
    if (!file) {
      fileNameDisplay.textContent = "Aucun fichier sélectionné";
      return;
    }

    const allowedExtensions = [".wav", ".mp3", ".webm", ".ogg", ".m4a"];
    const fileName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExt) {
      showPopup("Seuls les fichiers WAV, MP3, WEBM ou OGG sont acceptés.", "error");
      audioInput.value = "";
      fileNameDisplay.textContent = "Aucun fichier sélectionné";
      return;
    }

    const duration = await getSafeAudioDuration(file);

    if (duration > MAX_DURATION) {
      showPopup(`Fichier trop long (${Math.round(duration)}s). Maximum : ${MAX_DURATION}s.`, "error");
      audioInput.value = "";
      fileNameDisplay.textContent = "Aucun fichier sélectionné";
      return;
    }

    fileNameDisplay.textContent = `Fichier choisi : ${file.name}`;
    const audioUrl = URL.createObjectURL(file);
    previewPlayer.src = audioUrl;
    audioPreview.classList.remove("hidden");
  });

  fallbackBtn.addEventListener("click", () => audioInput.click());

  // ===== Clic sur le cercle mic → ouvre modal =====
  recorderCircle.addEventListener("click", startRecording);

  async function startRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStream   = stream;
      audioChunks    = [];
      elapsedSeconds = 0;
      isPaused       = false;

      // Analyser pour visualisation waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaStreamSource(stream);
      analyser       = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = onRecordingStop;
      mediaRecorder.start(100);

      recorderCircle.classList.add("recording");
      recorderText.textContent = "Enregistrement en cours";
      openRecordingModal();
      startTimer();
      drawWaveform();

    } catch (err) {
      console.error("Erreur accès microphone:", err);
      showPopup("Impossible d'accéder au microphone. Vérifiez les permissions.", "error");
    }
  }

  function openRecordingModal() {
    timerFill.style.width   = "0%";
    recElapsed.textContent  = "0s";
    recordingModal.style.display = "flex";
  }

  function closeRecordingModal() {
    recordingModal.style.display = "none";
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrameId);
    if (waveCtx && waveCanvas) {
      waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    }
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      if (isPaused) return;
      elapsedSeconds++;
      const pct = Math.min((elapsedSeconds / MAX_DURATION) * 100, 100);
      timerFill.style.width  = pct + "%";
      recElapsed.textContent = elapsedSeconds + "s";
      if (elapsedSeconds >= MAX_DURATION) {
        clearInterval(timerInterval);
        stopAndSave();
      }
    }, 1000);
  }

  function drawWaveform() {
    if (!analyser || !waveCtx || !waveCanvas) return;
    const bufLen    = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);
    const W = waveCanvas.width, H = waveCanvas.height;
    function draw() {
      animFrameId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      waveCtx.clearRect(0, 0, W, H);
      waveCtx.lineWidth   = 2.5;
      waveCtx.strokeStyle = isPaused ? "rgba(255,255,255,0.3)" : "#10b981";
      waveCtx.beginPath();
      const slice = W / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const y = (dataArray[i] / 128.0) * H / 2;
        i === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
        x += slice;
      }
      waveCtx.lineTo(W, H / 2);
      waveCtx.stroke();
    }
    draw();
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      if (elapsedSeconds < 2) {
        showPopup("Enregistrement trop court (minimum 2 secondes).", "error");
        return;
      }
      stopAndSave();
    });
  }

  function stopAndSave() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }

  function stopAndDiscard() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    analyser    = null;
    audioChunks = [];
    closeRecordingModal();
    recorderCircle.classList.remove("recording");
    recorderText.textContent = "Cliquez pour enregistrer";
  }

  function onRecordingStop() {
    // Copié de la version qui marchait + ajout de la durée dans le nom
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    analyser = null;
    closeRecordingModal();

    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    const file      = new File([audioBlob], "enregistrement.wav", { type: "audio/wav" });

    // Assigner au champ input sans déclencher la vérification de durée
    const dt = new DataTransfer();
    dt.items.add(file);
    audioInput.files = dt.files;
    // Ne pas dispatchEvent("change") pour éviter la vérification de durée

    // Afficher le player directement
    const audioUrl = URL.createObjectURL(audioBlob);
    previewPlayer.src = audioUrl;
    audioPreview.classList.remove("hidden");

    recorderCircle.classList.remove("recording");
    recorderText.textContent = "Enregistrement terminé !";
    fileNameDisplay.textContent = `enregistrement.wav (${elapsedSeconds}s)`;

    showPopup("Enregistrement terminé. Remplissez les champs de transcription et de traduction.", "success");
  }

  // ===== Recommencer =====
  reRecordBtn.addEventListener("click", () => {
    audioPreview.classList.add("hidden");
    previewPlayer.src = "";
    audioInput.value  = "";
    fileNameDisplay.textContent = "Aucun fichier sélectionné";
    recorderText.textContent    = "Cliquez pour enregistrer";
    recorderCircle.classList.remove("recording");
    document.getElementById("transcription").value = "";
    document.getElementById("traduction").value    = "";
    setTimeout(() => window.location.reload(), 10);
  });

  // ===== Soumission formulaire (même logique que la version qui marchait) =====
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. Vérifier connexion (identique à la version qui marchait)
    try {
      const statusRes = await fetch('auth-status');
      const statusTxt = await statusRes.text();
      const status    = JSON.parse(statusTxt);

      if (!status.logged) {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';

        const box = document.createElement('div');
        box.className = 'popup-box';
        box.style.backgroundColor = '#1a3a52';
        box.innerHTML = `
          <div style="display:flex;align-items:center;gap:15px;margin-bottom:20px;">
            <div style="font-size:28px;">🔒</div>
            <div style="text-align:left;flex:1;color:white;font-weight:600;">
              Vous devez être connecté pour envoyer un audio
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
            <button id="toLoginBtn"
              style="background:#10b981;color:white;border:none;padding:10px 25px;border-radius:10px;font-weight:600;cursor:pointer;">
              Se connecter
            </button>
            <button id="cancelLoginBtn"
              style="background:rgba(255,255,255,0.2);color:white;border:none;padding:10px 25px;border-radius:10px;font-weight:600;cursor:pointer;">
              Annuler
            </button>
          </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('visible'), 50);

        document.getElementById('toLoginBtn').addEventListener('click', () => {
          savePendingUploadAndRedirect();
        });
        document.getElementById('cancelLoginBtn').addEventListener('click', () => {
          overlay.classList.remove('visible');
          setTimeout(() => overlay.remove(), 300);
        });
        return;
      }
    } catch (err) {
      console.error('Erreur vérification auth:', err);
      showPopup('Impossible de vérifier la connexion. Réessayez.', 'error');
      return;
    }

    // 2. Valider les champs
    const formData      = new FormData(form);
    const audioFile     = formData.get("audio");
    const transcription = (formData.get("transcription") || "").trim();
    const traduction    = (formData.get("traduction")    || "").trim();

    if (!audioFile || audioFile.size === 0) {
      showPopup("Veuillez enregistrer ou uploader un fichier audio.", "error");
      return;
    }
    if (!transcription || !traduction) {
      showPopup("Tous les champs sont obligatoires.", "error");
      return;
    }

    // 3. Envoyer
    submitBtn.disabled = true;
    if (submitBtnLabel) submitBtnLabel.textContent = "Envoi en cours…";
    showPopup("Envoi en cours...", "info");

    try {
      const response = await fetch("upload", {
        method: "POST",
        body:   formData,
        cache:  "no-store"
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.error("Réponse serveur invalide:", text);
        showPopup("Le serveur a renvoyé une réponse invalide. Veuillez réessayer.", "error");
        submitBtn.disabled    = false;
        if (submitBtnLabel) submitBtnLabel.textContent = SUBMIT_LABEL;
        return;
      }

      if (result && result.status === "success") {
        sessionStorage.removeItem(STORAGE_KEY);
        showPopup(result.message || "Formulaire enregistré avec succès !", "success");
        setTimeout(() => {
          form.reset();
          audioPreview.classList.add("hidden");
          previewPlayer.src           = "";
          fileNameDisplay.textContent = "Aucun fichier sélectionné";
          recorderText.textContent    = "Cliquez pour enregistrer";
          recorderCircle.classList.remove("recording");
          submitBtn.disabled          = false;
          if (submitBtnLabel) submitBtnLabel.textContent = SUBMIT_LABEL;
          loadRecentHistory();
        }, 2000);
      } else {
        const userMsg = result && result.message
          ? result.message
          : "Une erreur est survenue. Veuillez réessayer.";
        showPopup(userMsg, "error");
        submitBtn.disabled = false;
        if (submitBtnLabel) submitBtnLabel.textContent = SUBMIT_LABEL;
      }
    } catch (networkErr) {
      console.error("Erreur réseau:", networkErr);
      showPopup("Erreur de connexion au serveur. Vérifiez votre connexion internet.", "error");
      submitBtn.disabled = false;
      if (submitBtnLabel) submitBtnLabel.textContent = SUBMIT_LABEL;
    }
  });
});

async function loadRecentHistory() {
  const recentHistoryContainer = document.getElementById('recentHistory');
  if (!recentHistoryContainer) return;

  try {
    const authRes = await fetch('auth-status');
    const authData = await authRes.json();
    if (!authData.logged) {
      recentHistoryContainer.innerHTML = `
        <div class="history-placeholder">
          <p class="history-empty">Connectez-vous pour consulter votre historique d'uploads et continuer l'envoi.</p>
          <button id="connectNowBtn" class="history-action-btn">Se connecter</button>
        </div>
      `;
      const connectBtn = document.getElementById('connectNowBtn');
      if (connectBtn) {
        connectBtn.addEventListener('click', () => {
          window.location.href = 'login-user';
        });
      }
      return;
    }

    const res = await fetch('user-history?limit=10');
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'Erreur chargement historique');
    }

    if (!data.data || data.data.length === 0) {
      recentHistoryContainer.innerHTML = `<p class="history-empty">Vous n'avez pas encore uploadé d'audio.</p>`;
      return;
    }

    const items = data.data.slice(0, 5);
    recentHistoryContainer.innerHTML = items.map(item => {
      const status = item.status || 'E';
      const label = {
        E: 'En attente',
        V: 'Validé',
        R: 'Rejeté',
        C: 'Contrôlé',
        A: 'Archivé'
      }[status] || status;
      const title = truncateTitle(item.transcription || item.traduction || `Contribution #${item.id}`);
      const dateLabel = formatContributionDate(item.date_creation);
      return `
        <button type="button" class="contribution-row" data-id="${escapeHtml(item.id)}">
          <span class="contribution-row__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 15h8v2H8v-2zm0-4h8v2H8v-2z"/>
            </svg>
          </span>
          <span class="contribution-row__body">
            <span class="contribution-row__title">${escapeHtml(title)}</span>
            <span class="contribution-row__date">${escapeHtml(dateLabel)}</span>
          </span>
          <span class="contribution-row__meta">
            <span class="status-badge status-badge--${escapeHtml(status)}">${escapeHtml(label)}</span>
            <span class="contribution-row__chevron" aria-hidden="true">›</span>
          </span>
        </button>
      `;
    }).join('');

    recentHistoryContainer.querySelectorAll('.contribution-row').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        window.location.href = 'history.html?selectedId=' + encodeURIComponent(id);
      });
    });
  } catch (err) {
    console.error('Erreur historique utilisateur:', err);
    recentHistoryContainer.innerHTML = `<p class="history-empty">Impossible de charger l'historique.</p>`;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncateTitle(text, maxLen = 42) {
  const t = String(text).trim();
  if (t.length <= maxLen) return t || 'Sans titre';
  return t.slice(0, maxLen - 1) + '…';
}

function formatContributionDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Aujourd'hui, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Hier, ${time}`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + time;
}


// ===== showPopup — identique à la version qui marchait =====
function showPopup(message, type = "info", autoClose = 3500) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  let bgColor   = "#1a3a52";
  if (type === "error")   { bgColor = "#e74c3c";  }
  if (type === "success") { bgColor = "#10b981";  }
  if (type === "warning") { bgColor = "#f59e0b";  }

  const box = document.createElement("div");
  box.className = "popup-box";
  box.style.backgroundColor = bgColor;
  box.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="flex:1;text-align:left;">${message}</div>
      <button class="popup-close"
        style="background:none;border:none;color:white;cursor:pointer;font-size:20px;padding:0;margin-left:10px;">
        ✕
      </button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("visible"), 50);

  box.querySelector(".popup-close").addEventListener("click", () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 300);
  });

  if (autoClose > 0) {
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.classList.remove("visible");
        setTimeout(() => overlay.remove(), 300);
      }
    }, autoClose);
  }
}