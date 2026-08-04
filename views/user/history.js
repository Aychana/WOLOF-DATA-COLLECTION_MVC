const PAGE_SIZE = 10;

const STATUS_LABELS = {
  E: 'Envoyé',
  V: 'Validé',
  R: 'Rejeté',
  C: 'Contrôlé',
  A: 'Archivé'
};

const STATUS_ORDER = { E: 0, R: 1, C: 2, V: 3, A: 4 };

document.addEventListener('DOMContentLoaded', () => {
  const tableBody        = document.getElementById('historyTableBody');
  const refreshBtn       = document.getElementById('refreshHistory');
  const searchInput      = document.getElementById('searchInput');
  const sortSelect       = document.getElementById('sortBy');
  const filterTabs       = document.querySelectorAll('.filter-tab');
  const prevBtn          = document.getElementById('prevBtn');
  const nextBtn          = document.getElementById('nextBtn');
  const pageNumbers      = document.getElementById('pageNumbers');
  const paginationInfo   = document.getElementById('paginationInfo');

  const detailsModal     = document.getElementById('detailsModal');
  const editModal        = document.getElementById('editModal');
  const editForm         = document.getElementById('editForm');
  const editAudioId      = document.getElementById('editAudioId');
  const editTranscription = document.getElementById('editTranscription');
  const editTraduction   = document.getElementById('editTraduction');
  const editMessage      = document.getElementById('editMessage');

  const detailId         = document.getElementById('detailId');
  const detailDate       = document.getElementById('detailDate');
  const detailAudio      = document.getElementById('detailAudio');
  const detailTranscription = document.getElementById('detailTranscription');
  const detailTraduction = document.getElementById('detailTraduction');
  const detailStatus     = document.getElementById('detailStatus');
  const rejectionReasonField = document.getElementById('rejectionReasonField');
  const detailRejectionReason = document.getElementById('detailRejectionReason');
  const editDetailBtn    = document.getElementById('editDetailBtn');
  const deleteDetailBtn  = document.getElementById('deleteDetailBtn');

  let allItems = [];
  let filteredItems = [];
  let currentPage = 1;
  let activeFilter = '';
  let selectedItem = null;

  const urlParams = new URLSearchParams(window.location.search);
  const urlSelectedId = urlParams.get('selectedId');
  const urlAction = urlParams.get('action');

  refreshBtn.addEventListener('click', loadHistory);
  searchInput.addEventListener('input', () => {
    currentPage = 1;
    applyFiltersAndSort();
  });
  sortSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndSort();
  });
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.filter || '';
      currentPage = 1;
      applyFiltersAndSort();
    });
  });
  prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

  editForm.addEventListener('submit', submitEdit);

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.close;
      if (target === 'details') closeDetailsModal();
      if (target === 'edit') closeEditModal();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDetailsModal();
    }
  });

  editDetailBtn.addEventListener('click', () => {
    if (selectedItem) openEditModal(selectedItem.id);
  });
  deleteDetailBtn.addEventListener('click', () => {
    if (selectedItem) deleteAudio(selectedItem.id);
  });

  loadHistory();

  async function loadHistory() {
    setTableLoading(true);
    try {
      const authRes = await fetch('auth-status');
      const authData = await authRes.json();
      if (!authData.logged) {
        renderNotLoggedIn();
        return;
      }

      const res = await fetch('user-history');
      const data = await res.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Erreur chargement historique');
      }

      allItems = data.data || [];
      applyFiltersAndSort();

      if (urlSelectedId) {
        const item = allItems.find(entry => entry.id === urlSelectedId);
        if (item) {
          openDetailsModal(item);
          if (urlAction === 'edit' && canEdit(item)) {
            openEditModal(item.id);
          }
          if (urlAction === 'delete' && canDelete(item)) {
            deleteAudio(item.id);
          }
        }
      }
    } catch (err) {
      console.error('Erreur historique:', err);
      tableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">Impossible de charger votre historique.</td>
        </tr>`;
      updatePagination(0);
    }
  }

  function renderNotLoggedIn() {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">
          <p class="history-empty">Vous devez être connecté pour consulter votre historique.</p>
          <a href="login-user" class="history-action-btn">Se connecter</a>
        </td>
      </tr>`;
    updatePagination(0);
  }

  function setTableLoading(loading) {
    if (loading) {
      tableBody.innerHTML = `
        <tr class="loading-row">
          <td colspan="5">Chargement de l'historique…</td>
        </tr>`;
    }
  }

  function applyFiltersAndSort() {
    const query = searchInput.value.trim().toLowerCase();

    filteredItems = allItems.filter(item => {
      if (activeFilter && item.status !== activeFilter) return false;
      if (!query) return true;
      const haystack = [
        item.id,
        item.transcription,
        item.traduction,
        item.audio_name,
        item.original_name,
        formatDisplayId(item.id)
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    const sortBy = sortSelect.value;
    filteredItems.sort((a, b) => {
      if (sortBy === 'status') {
        const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (diff !== 0) return diff;
      }
      const da = new Date(a.date_creation).getTime();
      const db = new Date(b.date_creation).getTime();
      if (sortBy === 'old') return da - db;
      return db - da;
    });

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    renderTable();
    updatePagination(filteredItems.length);
  }

  function renderTable() {
    if (filteredItems.length === 0) {
      tableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">
            ${allItems.length === 0
              ? 'Vous n\'avez pas encore uploadé d\'audio. <a href="index.html">Contribuer</a>'
              : 'Aucun résultat pour cette recherche ou ce filtre.'}
          </td>
        </tr>`;
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredItems.slice(start, start + PAGE_SIZE);

    tableBody.innerHTML = pageItems.map(item => {
      const status = item.status || 'E';
      const label = STATUS_LABELS[status] || status;
      const preview = truncatePreview(item.transcription || item.traduction || '—');
      const dateLabel = formatTableDate(item.date_creation);
      const displayId = formatDisplayId(item.id);
      const editable = canEdit(item);
      return `
        <tr class="history-row" data-id="${escapeHtml(item.id)}">
          <td class="col-id" data-label="ID">${escapeHtml(displayId)}</td>
          <td class="col-date" data-label="Date">${escapeHtml(dateLabel)}</td>
          <td class="col-preview" data-label="Transcription">${escapeHtml(preview)}</td>
          <td class="col-status" data-label="Statut">
            <span class="table-badge table-badge--${escapeHtml(status)}">${escapeHtml(label)}</span>
          </td>
          <td class="col-actions" data-label="Actions">
            <div class="row-actions">
              <button type="button" class="row-action-btn view-action" data-id="${escapeHtml(item.id)}" aria-label="Voir les détails" title="Voir">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              ${editable ? `
              <button type="button" class="row-action-btn edit-action" data-id="${escapeHtml(item.id)}" aria-label="Modifier" title="Modifier">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    tableBody.querySelectorAll('.history-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.row-action-btn')) return;
        const id = row.dataset.id;
        const item = allItems.find(entry => entry.id === id);
        if (item) openDetailsModal(item);
      });
    });

    tableBody.querySelectorAll('.view-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = allItems.find(entry => entry.id === btn.dataset.id);
        if (item) openDetailsModal(item);
      });
    });

    tableBody.querySelectorAll('.edit-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      });
    });
  }

  function updatePagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    paginationInfo.textContent = `Affichage ${start}-${end} sur ${total} contribution${total !== 1 ? 's' : ''}`;

    prevBtn.disabled = currentPage <= 1 || total === 0;
    nextBtn.disabled = currentPage >= totalPages || total === 0;

    pageNumbers.innerHTML = '';
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);

    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(p);
      btn.className = p === currentPage ? 'active' : '';
      btn.setAttribute('aria-label', `Page ${p}`);
      btn.setAttribute('aria-current', p === currentPage ? 'page' : 'false');
      btn.addEventListener('click', () => goToPage(p));
      pageNumbers.appendChild(btn);
    }
  }

  function goToPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page), totalPages);
    renderTable();
    updatePagination(filteredItems.length);
    document.querySelector('.history-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openDetailsModal(item) {
    selectedItem = item;
    const status = item.status || 'E';
    const label = STATUS_LABELS[status] || status;

    detailId.textContent = formatDisplayId(item.id);
    detailDate.textContent = new Date(item.date_creation).toLocaleString('fr-FR');
    detailAudio.src = item.audio_path || item.audio_url || '';
    detailTranscription.textContent = item.transcription || '—';
    detailTraduction.textContent = item.traduction || '—';
    detailStatus.textContent = label;
    detailStatus.className = `table-badge table-badge--${status}`;

    if (item.rejection_reason) {
      rejectionReasonField.hidden = false;
      detailRejectionReason.textContent = item.rejection_reason;
    } else {
      rejectionReasonField.hidden = true;
      detailRejectionReason.textContent = '';
    }

    editDetailBtn.hidden = !canEdit(item);
    deleteDetailBtn.hidden = !canDelete(item);

    detailsModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDetailsModal() {
    detailsModal.hidden = true;
    document.body.style.overflow = '';
    if (detailAudio) {
      detailAudio.pause();
      detailAudio.removeAttribute('src');
      detailAudio.load();
    }
  }

  function openEditModal(id) {
    const item = allItems.find(entry => entry.id === id);
    if (!item) return;
    if (!canEdit(item)) {
      showEditMessage('Modification non autorisée pour ce statut.', 'error');
      return;
    }
    editAudioId.value = item.id;
    editTranscription.value = item.transcription || '';
    editTraduction.value = item.traduction || '';
    editMessage.textContent = '';
    editMessage.className = 'message';
    editModal.hidden = false;
    document.body.style.overflow = 'hidden';
    closeDetailsModal();
  }

  function closeEditModal() {
    editModal.hidden = true;
    if (detailsModal.hidden) {
      document.body.style.overflow = '';
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    const id = editAudioId.value;
    const transcription = editTranscription.value.trim();
    const traduction = editTraduction.value.trim();

    if (!transcription || !traduction) {
      showEditMessage('Les deux champs sont obligatoires.', 'error');
      return;
    }

    try {
      const fd = new FormData();
      fd.append('id', id);
      fd.append('transcription', transcription);
      fd.append('traduction', traduction);
      const res = await fetch('update-user-upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        showEditMessage(data.message || 'Mis à jour.', 'success');
        await loadHistory();
        setTimeout(() => closeEditModal(), 700);
      } else {
        showEditMessage(data.message || 'Erreur mise à jour.', 'error');
      }
    } catch (err) {
      console.error('Erreur mise à jour:', err);
      showEditMessage('Erreur réseau.', 'error');
    }
  }

  async function deleteAudio(id) {
    if (!id || !confirm('Voulez-vous vraiment supprimer cet enregistrement ?')) return;
    try {
      const fd = new FormData();
      fd.append('id', id);
      const res = await fetch('delete-audio', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        closeDetailsModal();
        closeEditModal();
        await loadHistory();
      } else {
        alert(data.message || 'Erreur de suppression.');
      }
    } catch (err) {
      console.error('Erreur de suppression:', err);
      alert('Erreur réseau lors de la suppression.');
    }
  }

  function canEdit(item) {
    return item && ['E', 'R'].includes(item.status);
  }

  function canDelete(item) {
    return item && item.status === 'E' || item.status === 'R';
  }

  function showEditMessage(message, type) {
    editMessage.textContent = message;
    editMessage.className = `message message--${type}`;
  }
});

function formatDisplayId(id) {
  const compact = String(id || '').replace(/-/g, '').toUpperCase();
  const short = compact.slice(0, 6) || '0000';
  return `#SB-${short}`;
}

function formatTableDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function truncatePreview(text, maxLen = 48) {
  const t = String(text || '').trim();
  if (!t) return '—';
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + '…';
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
