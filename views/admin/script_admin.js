const ITEMS_PER_PAGE = 10;

document.addEventListener('DOMContentLoaded', async () => {
  const tableBody     = document.querySelector('#audioTable tbody');
  const searchInput   = document.getElementById('searchInput');
  const exportBtn     = document.getElementById('exportBtn');
  const archiveAllBtn = document.getElementById('archiveAllBtn');

  let allAudios           = [];
  let filteredList        = [];
  let adminPermissions    = [];
  let adminRole           = '';
  let myAdminId           = '';
  let adminName           = '';
  let currentStatusFilter = '';
  let currentPage         = 1;
  let validationStats     = {};

  let info = {};
  try {
    const r = await fetch('auth-status-admin');
    info = await r.json();
  } catch (e) {
    window.location.href = 'loginAdmin';
    return;
  }

  if (!info.logged) {
    window.location.href = 'loginAdmin';
    return;
  }
  if (info.is_superadmin) {
    window.location.href = 'superadmin-dashboard';
    return;
  }
  if (!['validator', 'controller'].includes(info.admin_role)) {
    window.location.href = 'loginAdmin';
    return;
  }

  adminRole        = info.admin_role || '';
  adminPermissions = info.permissions || [];
  myAdminId        = info.admin_id || '';
  adminName        = info.admin_name || 'Admin';

  const roleLabels = { validator: 'Validateur', controller: 'Contrôleur' };
  document.getElementById('roleTag').textContent = roleLabels[adminRole] || adminRole;
  document.getElementById('roleTag').className = `role-tag role-${adminRole}`;
  document.getElementById('adminGreeting').textContent = `Bonjour, ${adminName}`;
  document.getElementById('sidebarAdminName').textContent = adminName;
  document.getElementById('sidebarRoleLabel').textContent = (roleLabels[adminRole] || adminRole).toUpperCase();

  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    pageTitle.textContent = adminRole === 'validator' ? 'Queue de validation' : 'Contrôle des audios';
  }

  applyRoleUI();
  setupEventListeners();
  loadAudios();

  function applyRoleUI() {
    const statsRow = document.getElementById('statsRow');
    const thTraduction = document.getElementById('thTraduction');

    const sidebarLabel = document.getElementById('sidebarNavLabel');
    if (adminRole === 'controller') {
      if (sidebarLabel) sidebarLabel.textContent = 'Contrôle des audios';
      if (document.getElementById('controllerActions')) {
        document.getElementById('controllerActions').style.display = 'flex';
      }
      document.getElementById('thAssigned').style.display = '';
      document.getElementById('tabArchived').style.display = '';
      document.querySelectorAll('.tab-btn[data-status="E"]').forEach((b) => { b.style.display = 'none'; });
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      const stabV = document.querySelector('.tab-btn[data-status="V"]');
      if (stabV) {
        stabV.classList.add('active');
        currentStatusFilter = 'V';
      }
      if (statsRow) statsRow.style.display = 'none';
    } else {
      if (sidebarLabel) sidebarLabel.textContent = 'Queue de validation';
      document.querySelectorAll('.tab-btn[data-status="V"], .tab-btn[data-status="A"]').forEach((b) => {
        b.style.display = 'none';
      });
      const availBtn = document.createElement('button');
      availBtn.type = 'button';
      availBtn.className = 'tab-btn tab-btn--avail';
      availBtn.dataset.status = '__available__';
      availBtn.innerHTML = 'Disponibles';
      document.getElementById('statusTabs').appendChild(availBtn);
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      const tabE = document.querySelector('.tab-btn[data-status="E"]');
      if (tabE) {
        tabE.classList.add('active');
        currentStatusFilter = 'E';
      }
      if (thTraduction) thTraduction.style.display = 'none';
      if (statsRow) statsRow.style.display = '';
    }
  }

  function setupEventListeners() {
    document.getElementById('statusTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.status || '';
      currentPage = 1;
      filterAndRender();
    });

    searchInput?.addEventListener('input', () => {
      currentPage = 1;
      filterAndRender();
    });

    document.getElementById('passwordBtn')?.addEventListener('click', () => {
      window.location.href = 'adminChangePassword';
    });

    document.getElementById('logoutBtn')?.addEventListener('click', logoutAdmin);
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', logoutAdmin);

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.getElementById('adminSidebar')?.classList.toggle('open');
    });

    document.getElementById('prevBtn')?.addEventListener('click', () => goPage(currentPage - 1));
    document.getElementById('nextBtn')?.addEventListener('click', () => goPage(currentPage + 1));

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('export-dataset');
          const result = await res.json();
          if (result.status === 'success' && result.file) {
            showToast(`Export terminé : ${result.total || 0} audio(s). Téléchargement en cours...`, 'success');
            setTimeout(() => {
              window.location.href = 'dataset.json';
            }, 500);
          } else {
            showToast(result.message || 'Erreur export.', 'error');
          }
        } catch (e) {
          console.error('Export error:', e);
          showToast("Erreur lors de l'export.", 'error');
        }
      });
    }

    if (archiveAllBtn) {
      archiveAllBtn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Archiver tous vos audios contrôlés pris en charge ?');
        if (!confirmed) return;
        try {
          const res = await fetch('archive-all-validated', { method: 'POST' });
          const result = await res.json();
          showToast(result.message || 'Archivage effectué.', result.status === 'success' ? 'success' : 'error');
          if (result.status === 'success') loadAudios();
        } catch (e) {
          showToast('Erreur réseau.', 'error');
        }
      });
    }
  }

  async function loadAudios() {
    try {
      const res = await fetch('get-audios-role');
      const data = await res.json();
      if (data.status === 'success') {
        allAudios = data.data || [];
        validationStats = data.stats || {};
        updateBadges();
        updateStats(validationStats);
        filterAndRender();
      } else {
        throw new Error(data.message || 'Erreur serveur');
      }
    } catch (err) {
      console.error('Erreur chargement:', err);
      showToast('Erreur lors du chargement des audios : ' + err.message, 'error');
      tableBody.innerHTML = `<tr><td colspan="7" class="table-error">Erreur de chargement</td></tr>`;
    }
  }

  function filterAndRender() {
    const q = (searchInput?.value || '').toLowerCase();
    let list = allAudios;

    if (currentStatusFilter === '__available__') {
      list = list.filter((a) => a.status === 'E' && (!a.assigned_to || a.assigned_to === myAdminId));
    } else if (currentStatusFilter) {
      list = list.filter((a) => a.status === currentStatusFilter);
    }

    if (q) {
      list = list.filter((a) =>
        (a.id || '').toLowerCase().includes(q) ||
        (a.transcription || '').toLowerCase().includes(q) ||
        (a.traduction || '').toLowerCase().includes(q) ||
        (a.audio_name || '').toLowerCase().includes(q)
      );
    }

    filteredList = list;
    const totalPages = Math.max(1, Math.ceil(filteredList.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    renderTable();
    updatePaginationUI();
  }

  function renderTable() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filteredList.slice(start, start + ITEMS_PER_PAGE);
    const showControlCol = adminRole === 'controller';
    const showTraduction = adminRole === 'controller';

    if (pageItems.length === 0) {
      tableBody.innerHTML = '';
      document.getElementById('emptyMsg').style.display = 'block';
      document.getElementById('paginationBar').style.display = 'none';
      return;
    }

    document.getElementById('emptyMsg').style.display = 'none';

    tableBody.innerHTML = pageItems.map((a) => {
      const s = a.status || 'E';
      const preview = truncate(a.transcription || a.traduction || '—', 56);
      return `
        <tr data-id="${escapeHtml(a.id)}" data-status="${s}">
          <td class="col-id" title="${escapeHtml(a.id)}">audio - ${escapeHtml(formatId(a.id))}</td>
          <td class="col-audio">
            <audio controls preload="metadata" class="table-audio">
              <source src="${escapeHtml(audioSrc(a.audio_path))}" type="audio/wav">
            </audio>
          </td>
          <td class="col-preview" title="${escapeHtml(a.transcription || '')}">${escapeHtml(preview)}</td>
          ${showTraduction ? `<td class="col-preview" title="${escapeHtml(a.traduction || '')}">${escapeHtml(truncate(a.traduction, 40))}</td>` : ''}
          <td>${statusBadge(s)}</td>
          ${showControlCol ? `<td>${controlCell(a)}</td>` : ''}
          <td class="col-actions">${buildActions(a, s)}</td>
        </tr>`;
    }).join('');
  }

  function updatePaginationUI() {
    const total = filteredList.length;
    const bar = document.getElementById('paginationBar');
    if (!bar) return;

    if (total === 0) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(currentPage * ITEMS_PER_PAGE, total);
    document.getElementById('paginationInfo').textContent =
      `Affichage de ${start}-${end} sur ${total} audio${total > 1 ? 's' : ''}`;

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
  }

  function goPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredList.length / ITEMS_PER_PAGE));
    currentPage = Math.min(Math.max(1, page), totalPages);
    renderTable();
    updatePaginationUI();
  }

  function updateBadges() {
    const counts = { E: 0, V: 0, R: 0, A: 0, C: 0 };
    allAudios.forEach((a) => {
      if (counts.hasOwnProperty(a.status)) counts[a.status]++;
    });
    ['E', 'V', 'R', 'A'].forEach((key) => {
      const el = document.getElementById(`badge-${key}`);
      if (el) el.textContent = counts[key] || 0;
    });
  }

  function updateStats(stats = {}) {
    if (adminRole !== 'validator') return;
    const pending = allAudios.filter((a) => a.status === 'E').length;
    const validated = allAudios.filter((a) => a.status === 'V').length;
    const elPending = document.getElementById('statPending');
    const elValidated = document.getElementById('statValidatedToday');
    if (elPending) elPending.textContent = pending;
    if (elValidated) elValidated.textContent = validated;
    const elAvg = document.getElementById('statAvgTime');
    if (elAvg) elAvg.textContent = stats.avg_label || '—';
  }

  function statusBadge(s) {
    const labels = { E: 'Envoyé', V: 'Validé', R: 'Rejeté', C: 'Contrôlé', A: 'Archivé' };
    return `<span class="badge badge-${s}">${labels[s] || s}</span>`;
  }

  function controlCell(a) {
    if (!a.controlled_by) {
      return `<button type="button" class="action-btn secondary" onclick="takeControl('${a.id}')">Prendre en charge</button>`;
    }
    if (a.controlled_by === myAdminId) return '<span class="control-mine">Vous</span>';
    return '<span class="control-other">Autre</span>';
  }

  function buildActions(a, s) {
    const id = a.id;
    let btns = '';

    btns += `<button type="button" class="action-btn icon-btn" onclick="openDetailsModal('${id}')" title="Voir" aria-label="Voir">👁</button>`;

    if (adminRole === 'validator') {
      if (s === 'E') {
        const takenByOther = a.assigned_to && a.assigned_to !== myAdminId;
        if (takenByOther) {
          btns += `<span class="claimed-badge">Pris</span>`;
        } else {
          btns += `<button type="button" class="action-btn secondary" onclick="openEditModal('${id}')">✎</button>`;
          btns += `<button type="button" class="action-btn primary" onclick="changeStatus('${id}','V')">✓</button>`;
          btns += `<button type="button" class="action-btn danger" onclick="openRejectModal('${id}')">✕</button>`;
        }
      }
    } else if (adminRole === 'controller') {
      const isMyControl = a.controlled_by === myAdminId;
      const isFree = !a.controlled_by;
      if (s === 'V' || s === 'R') {
        if (isMyControl) {
          btns += `<button type="button" class="action-btn secondary" onclick="openEditModal('${id}')">✎</button>`;
          btns += `<button type="button" class="action-btn primary" onclick="changeStatus('${id}','C')">Contrôlé</button>`;
          btns += `<button type="button" class="action-btn danger" onclick="deleteSingle('${id}')">🗑</button>`;
        } else if (isFree) {
          btns += `<span class="muted-hint">—</span>`;
        }
      }
      if (s === 'C' && isMyControl) {
        btns += `<button type="button" class="action-btn secondary" onclick="openEditModal('${id}')">✎</button>`;
        btns += `<button type="button" class="action-btn danger" onclick="deleteSingle('${id}')">🗑</button>`;
      }
    }

    return `<div class="table-actions">${btns}</div>`;
  }

  async function logoutAdmin() {
    const confirmed = await confirmModal('Se déconnecter ?');
    if (!confirmed) return;
    try {
      const res = await fetch('admin-logout', { method: 'POST' });
      const data = await res.json();
      window.location.href = data.redirect || 'loginAdmin';
    } catch (e) {
      window.location.href = 'loginAdmin';
    }
  }

  window.takeControl = async (id) => {
    const confirmed = await confirmModal('Prendre en charge cet audio ?');
    if (!confirmed) return;
    const fd = new FormData();
    fd.append('id', id);
    try {
      const res = await fetch('take-control', { method: 'POST', body: fd });
      const result = await res.json();
      showToast(result.message || 'OK', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') loadAudios();
    } catch (e) {
      showToast('Erreur réseau.', 'error');
    }
  };

  window.changeStatus = async (id, newStatus) => {
    const labels = { V: 'valider', C: 'contrôler', A: 'archiver', R: 'rejeter' };
    const confirmed = await confirmModal(`Voulez-vous <strong>${labels[newStatus] || 'modifier'}</strong> cet audio ?`);
    if (!confirmed) return;
    const fd = new FormData();
    fd.append('id', id);
    fd.append('status', newStatus);
    try {
      const res = await fetch('update-audio-status', { method: 'POST', body: fd });
      const result = await res.json();
      showToast(result.message || 'Statut mis à jour.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') loadAudios();
    } catch (e) {
      showToast('Erreur réseau.', 'error');
    }
  };

  window.deleteSingle = async (id) => {
    const confirmed = await confirmModal('Supprimer cet audio ?<br><small>Action irréversible.</small>');
    if (!confirmed) return;
    const fd = new FormData();
    fd.append('id', id);
    try {
      const res = await fetch('delete-audio', { method: 'POST', body: fd });
      const result = await res.json();
      showToast(result.message || 'Supprimé.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') loadAudios();
    } catch (e) {
      showToast('Erreur réseau.', 'error');
    }
  };

  window.openEditModal = (id) => {
    const audio = allAudios.find((a) => a.id === id);
    if (!audio) return;
    document.getElementById('editId').value = id;
    document.getElementById('editTranscription').value = audio.transcription || '';
    document.getElementById('editTraduction').value = audio.traduction || '';
    document.getElementById('editModal').style.display = 'flex';
  };

  window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
  };

  window.submitEdit = async () => {
    const id = document.getElementById('editId').value;
    const transcription = document.getElementById('editTranscription').value.trim();
    const traduction = document.getElementById('editTraduction').value.trim();
    if (!transcription || !traduction) {
      showToast('Les champs ne peuvent pas être vides.', 'error');
      return;
    }
    const fd = new FormData();
    fd.append('id', id);
    fd.append('transcription', transcription);
    fd.append('traduction', traduction);
    try {
      const res = await fetch('update-audio-content', { method: 'POST', body: fd });
      const result = await res.json();
      showToast(result.message || 'Modifié.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') {
        closeEditModal();
        loadAudios();
      }
    } catch (e) {
      showToast('Erreur réseau.', 'error');
    }
  };

  window.openRejectModal = (id) => {
    document.getElementById('rejectId').value = id;
    document.getElementById('rejectReason').value = '';
    document.getElementById('rejectModal').style.display = 'flex';
  };

  window.closeRejectModal = () => {
    document.getElementById('rejectModal').style.display = 'none';
  };

  window.submitReject = async () => {
    const id = document.getElementById('rejectId').value;
    const reason = document.getElementById('rejectReason').value.trim();
    const fd = new FormData();
    fd.append('id', id);
    fd.append('status', 'R');
    fd.append('rejection_reason', reason);
    try {
      const res = await fetch('update-audio-status', { method: 'POST', body: fd });
      const result = await res.json();
      showToast(result.message || 'Rejeté.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') {
        closeRejectModal();
        loadAudios();
      }
    } catch (e) {
      showToast('Erreur réseau.', 'error');
    }
  };

  window.openDetailsModal = (id) => {
    const audio = allAudios.find((a) => a.id === id);
    if (!audio) return;
    document.getElementById('detailId').textContent = audio.id;
    document.getElementById('detailDate').textContent = audio.date_creation
      ? new Date(audio.date_creation).toLocaleString('fr-FR')
      : '—';
    document.getElementById('detailStatus').innerHTML = statusBadge(audio.status || 'E');
    document.getElementById('detailAudio').src = audioSrc(audio.audio_path);
    document.getElementById('detailTranscription').textContent = audio.transcription || '—';
    document.getElementById('detailTraduction').textContent = audio.traduction || '—';
    const rejSec = document.getElementById('rejectionSection');
    if (audio.status === 'R' && audio.rejection_reason) {
      rejSec.style.display = 'block';
      document.getElementById('detailRejectionReason').textContent = audio.rejection_reason;
    } else {
      rejSec.style.display = 'none';
    }
    document.getElementById('detailsModal').style.display = 'flex';
  };

  window.closeDetailsModal = () => {
    document.getElementById('detailsModal').style.display = 'none';
    const audio = document.getElementById('detailAudio');
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  };
  window.copyDetailId = () => {
    const detailId = document.getElementById('detailId');
    if (!detailId) return;
    const text = detailId.textContent.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('ID copié dans le presse-papiers.', 'success');
    }).catch(() => {
      showToast('Impossible de copier l\'ID.', 'error');
    });
  };});

function audioSrc(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return path.replace(/^\//, '');
}

function formatId(id) {
  const raw = String(id || '').trim();
  const cleaned = raw.replace(/^#?([A-Za-z]{2}-)?/, '');
  return cleaned || raw.replace(/^#/, '');
}

function truncate(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return t || '—';
  return t.slice(0, max - 1) + '…';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = message;
  toast.setAttribute('role', 'alert');
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast--exit');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function confirmModal(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-overlay-dynamic';
    overlay.style.display = 'flex';
    const box = document.createElement('div');
    box.className = 'modal-content modal-medium';
    box.innerHTML = `
      <div class="modal-header"><h2>Confirmation</h2></div>
      <div class="modal-body"><p>${message}</p></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary confirm-no">Non</button>
        <button type="button" class="btn btn-primary confirm-yes">Oui</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector('.confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    box.querySelector('.confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}
