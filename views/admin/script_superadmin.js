/* script_superadmin.js — Tableau de bord Super Admin */

const CHART_COLORS = {
  primary: '#1a3a52',
  secondary: '#10b981',
  warning: '#f59e0b',
  error: '#e74c3c',
  muted: '#c2c7cd'
};

const TAB_HEADERS = {
  dashboard: {
    title: "Vue d'ensemble stratégique",
    subtitle: 'Supervision globale de la collecte de sagesse.'
  },
  admins: {
    title: 'Administrateurs',
    subtitle: 'Gérez les validateurs et contrôleurs.'
  },
  users: {
    title: 'Utilisateurs',
    subtitle: 'Contributeurs enregistrés sur la plateforme.'
  },
  audios: {
    title: 'Audios',
    subtitle: 'Supervision et édition des contributions.'
  }
};

let currentData = { admins: [], users: [], audios: [] };
let dashboardData = null;
let dashboardCharts = {};
let currentPeriod = 30;

document.addEventListener('DOMContentLoaded', () => {
  initSuperAdmin();
});

async function initSuperAdmin() {
  const ok = await checkAuth();
  if (!ok) return;

  setupSidebar();
  setupTabs();
  setupPeriodButtons();
  setupModals();
  setupFilters();
  setupActions();

  await loadAllData();
}

async function checkAuth() {
  try {
    const response = await fetch('auth-status-admin');
    const data = await response.json();

    if (!data.logged) {
      window.location.href = 'loginAdmin';
      return false;
    }
    if (!data.is_superadmin) {
      window.location.href = 'admin.html';
      return false;
    }

    const name = data.admin_name || 'Super Admin';
    document.getElementById('superAdminName').textContent = name;
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    document.getElementById('superAdminAvatar').textContent = initials || 'SA';
    return true;
  } catch (e) {
    console.error(e);
    window.location.href = 'loginAdmin';
    return false;
  }
}

function setupSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('saSidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
}

function setupTabs() {
  document.querySelectorAll('.sa-nav__item').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.kpi-card[data-goto-status]').forEach((card) => {
    card.addEventListener('click', () => {
      const status = card.dataset.gotoStatus;
      if (!status) return;
      switchTab('audios');
      const filter = document.getElementById('filterStatus');
      if (filter) filter.value = status;
      filterAudios();
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.sa-panel').forEach((panel) => {
    const isActive = panel.id === tabName;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  document.querySelectorAll('.sa-nav__item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const meta = TAB_HEADERS[tabName] || TAB_HEADERS.dashboard;
  document.getElementById('headerTitle').textContent = meta.title;
  document.getElementById('headerSubtitle').textContent = meta.subtitle;
  document.getElementById('saSidebar')?.classList.remove('open');
}

function setupPeriodButtons() {
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentPeriod = parseInt(e.currentTarget.dataset.days, 10);
      loadDashboard();
    });
  });
}

function setupModals() {
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const modal = el.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  document.getElementById('openCreateAdminBtn')?.addEventListener('click', openCreateAdminModal);
  document.getElementById('createAdminForm')?.addEventListener('submit', submitCreateAdmin);
  document.getElementById('editAdminForm')?.addEventListener('submit', submitEditAdmin);
  document.getElementById('editAudioForm')?.addEventListener('submit', submitEditAudio);
  document.getElementById('copyTempPwdBtn')?.addEventListener('click', () => {
    const val = document.getElementById('tempPasswordValue')?.textContent;
    if (val) copyToClipboard(val);
  });
  document.getElementById('confirmExportBtn')?.addEventListener('click', confirmExport);
}

function setupFilters() {
  document.getElementById('searchAdmins')?.addEventListener('input', filterAdmins);
  document.getElementById('filterAdminRole')?.addEventListener('change', filterAdmins);
  document.getElementById('searchUsers')?.addEventListener('input', filterUsers);
  document.getElementById('searchAudios')?.addEventListener('input', filterAudios);
  document.getElementById('filterStatus')?.addEventListener('change', filterAudios);
}

function setupActions() {
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('exportDashboardBtn')?.addEventListener('click', showExportModal);
  document.getElementById('exportDatasetBtn')?.addEventListener('click', exportDataset);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = false;
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = true;
}

async function loadAllData() {
  try {
    const [admins, users, audios] = await Promise.all([
      fetch('superadmin-get-admins').then((r) => r.json()),
      fetch('superadmin-get-users').then((r) => r.json()),
      fetch('superadmin-get-audios').then((r) => r.json())
    ]);

    if (admins?.error || users?.error || audios?.error) {
      showToast('Accès refusé ou session expirée.', 'error');
      return;
    }

    currentData = {
      admins: Array.isArray(admins) ? admins : [],
      users: Array.isArray(users) ? users : [],
      audios: Array.isArray(audios) ? audios : []
    };

    renderAdmins();
    renderUsers();
    renderAudios();
    await loadDashboard();
  } catch (error) {
    console.error('Erreur chargement données:', error);
    showToast('Erreur lors du chargement des données.', 'error');
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(`superadmin-get-dashboard?days=${currentPeriod}`);
    dashboardData = await response.json();
    if (dashboardData?.error) {
      showToast(dashboardData.error, 'error');
      return;
    }
    renderDashboard();
  } catch (error) {
    console.error('Erreur chargement dashboard:', error);
  }
}

function renderDashboard() {
  if (!dashboardData) return;

  const kpis = dashboardData.kpis || {};

  setText('kpi-submitted', formatNum(kpis.total_submitted));
  setText('kpi-pending', formatNum(kpis.total_pending));
  setText('kpi-validated', formatNum(kpis.total_validated));
  setText('kpi-controlled', formatNum(kpis.total_controlled));
  setText('kpi-rejected', formatNum(kpis.total_rejected));
  setText('kpi-contributors', formatNum(kpis.total_contributors));
  setText('kpi-rate', `${(kpis.validation_rate || 0).toFixed(1)}%`);
  setText('kpi-exportable', formatNum(kpis.exportable_volume));

  renderChartTimeline();
  renderChartStatus();
  renderChartProductivity();
  renderChartWorkload();
  renderChartContributors();
  renderAlerts();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

function renderChartTimeline() {
  const dailyStats = dashboardData.daily_stats || [];
  const labels = dailyStats.map((s) => {
    try {
      return new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
      return s.date;
    }
  });

  const ctx = document.getElementById('chart-timeline');
  if (!ctx) return;
  if (dashboardCharts.timeline) dashboardCharts.timeline.destroy();

  dashboardCharts.timeline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Soumis',
          data: dailyStats.map((s) => s.submitted),
          backgroundColor: CHART_COLORS.muted,
          borderRadius: 4
        },
        {
          label: 'Validés',
          data: dailyStats.map((s) => s.validated),
          backgroundColor: CHART_COLORS.secondary,
          borderRadius: 4
        },
        {
          label: 'Contrôlés',
          data: dailyStats.map((s) => s.controlled),
          backgroundColor: CHART_COLORS.primary,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderChartStatus() {
  const kpis = dashboardData.kpis || {};
  const validated = kpis.total_validated || 0;
  const pending = kpis.total_pending || 0;
  const rejected = kpis.total_rejected || 0;
  const controlled = kpis.total_controlled || 0;
  const total = validated + pending + rejected + controlled || 1;
  const pctValidated = Math.round((validated / total) * 100);

  setText('chart-status-center', `${pctValidated}%`);

  const legend = document.getElementById('chart-status-legend');
  if (legend) {
    const items = [
      { label: 'Validés', value: validated, color: CHART_COLORS.secondary },
      { label: 'En attente', value: pending, color: CHART_COLORS.warning },
      { label: 'Rejetés', value: rejected, color: CHART_COLORS.error },
      { label: 'Contrôlés', value: controlled, color: CHART_COLORS.primary }
    ];
    legend.innerHTML = items
      .map(
        (i) =>
          `<li><span class="chart-legend__dot" style="background:${i.color}"></span>${i.label} <strong>${formatNum(i.value)}</strong></li>`
      )
      .join('');
  }

  const ctx = document.getElementById('chart-status');
  if (!ctx) return;
  if (dashboardCharts.status) dashboardCharts.status.destroy();

  dashboardCharts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Validés', 'En attente', 'Rejetés', 'Contrôlés'],
      datasets: [
        {
          data: [validated, pending, rejected, controlled],
          backgroundColor: [
            CHART_COLORS.secondary,
            CHART_COLORS.warning,
            CHART_COLORS.error,
            CHART_COLORS.primary
          ],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: { legend: { display: false } }
    }
  });
}

function renderChartProductivity() {
  const teamStats = dashboardData.team_productivity || [];
  const ctx = document.getElementById('chart-productivity');
  if (!ctx) return;
  if (dashboardCharts.productivity) dashboardCharts.productivity.destroy();

  dashboardCharts.productivity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: teamStats.map((t) => t.name),
      datasets: [
        {
          label: 'Traités',
          data: teamStats.map((t) => t.completed),
          backgroundColor: CHART_COLORS.primary,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderChartWorkload() {
  const teamStats = dashboardData.team_productivity || [];
  const ctx = document.getElementById('chart-workload');
  if (!ctx) return;
  if (dashboardCharts.workload) dashboardCharts.workload.destroy();

  dashboardCharts.workload = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: teamStats.map((t) => `${t.name}`),
      datasets: [
        {
          label: 'En attente',
          data: teamStats.map((t) => t.pending),
          backgroundColor: CHART_COLORS.warning,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderChartContributors() {
  const contributors = dashboardData.top_contributors || [];
  const ctx = document.getElementById('chart-contributors');
  if (!ctx) return;
  if (dashboardCharts.contributors) dashboardCharts.contributors.destroy();

  dashboardCharts.contributors = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: contributors.map((c) => (c.name || 'Anonyme').substring(0, 18)),
      datasets: [
        {
          label: 'Soumissions',
          data: contributors.map((c) => c.volume),
          backgroundColor: CHART_COLORS.secondary,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderAlerts() {
  const alerts = dashboardData.alerts || [];
  const container = document.getElementById('alerts-container');
  if (!container) return;
  container.innerHTML = '';

  if (alerts.length === 0) {
    container.innerHTML = '<p class="alerts-empty">✓ Aucune alerte critique</p>';
    return;
  }

  alerts.forEach((alert) => {
    const severity = alert.severity || 'info';
    const el = document.createElement('div');
    el.className = `alert alert-${severity}`;
    const icon = alert.type === 'pending_old' ? '⏳' : '👤';
    el.innerHTML = `<strong>${icon}</strong> ${escHtml(alert.message)}`;
    container.appendChild(el);
  });
}

function showExportModal() {
  const kpis = dashboardData?.kpis || {};
  const controlled = kpis.total_controlled || 0;
  const rejected = kpis.total_rejected || 0;
  const total = kpis.total_submitted || 1;
  const quality = total > 0 ? 100 - (rejected / total) * 100 : 100;

  setText('export-count', formatNum(controlled));
  setText('export-quality', `${quality.toFixed(1)}%`);
  setText('export-volume', `${(controlled * 0.5).toFixed(0)} MB (estimation)`);
  openModal('exportModal');
}

function closeExportModal() {
  closeModal('exportModal');
}

async function confirmExport() {
  try {
    const response = await fetch('export-dataset');
    const result = await response.json();
    if (result.status === 'success') {
      showToast(`Export terminé — ${result.total} audios.`, 'success');
      downloadDataset();
      closeExportModal();
      loadAllData();
    } else {
      showToast(result.message || "Erreur lors de l'export.", 'error');
    }
  } catch {
    showToast('Erreur réseau.', 'error');
  }
}

function downloadDataset() {
  const a = document.createElement('a');
  a.href = 'dataset.json';
  a.download = 'dataset.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* =================== ADMINS =================== */

function renderAdmins(data) {
  const list = data || currentData.admins;
  const tbody = document.getElementById('adminsBody');
  const noData = document.getElementById('adminsNoData');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    if (noData) noData.hidden = false;
    return;
  }
  if (noData) noData.hidden = true;

  list.forEach((admin) => {
    const pwd = admin.temp_password || '';
    const pwdCell = pwd
      ? `<div class="pwd-cell"><span class="pwd-code"></span><button type="button" class="copy-btn-sm">Copier</button></div>`
      : '<span class="muted">—</span>';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escHtml(admin.name)}</strong></td>
      <td>${escHtml(admin.email)}</td>
      <td><code>${escHtml(admin.username)}</code></td>
      <td><span class="role-badge">${escHtml(admin.role || 'validator')}</span></td>
      <td>${pwdCell}</td>
      <td>${fmtDate(admin.created_at)}</td>
      <td>
        <button type="button" class="btn-edit" data-edit-admin="${escHtml(admin.id)}">Éditer</button>
        <button type="button" class="btn-delete" data-delete-admin="${escHtml(admin.id)}" data-name="${escHtml(admin.name)}">Supprimer</button>
      </td>
    `;
    if (pwd) {
      const codeEl = row.querySelector('.pwd-code');
      if (codeEl) {
        codeEl.textContent = pwd;
        codeEl.title = pwd;
      }
      row.querySelector('.copy-btn-sm')?.addEventListener('click', () => copyToClipboard(pwd));
    }
    tbody.appendChild(row);
  });

  tbody.querySelectorAll('[data-edit-admin]').forEach((btn) => {
    btn.addEventListener('click', () => openEditAdminModal(btn.dataset.editAdmin));
  });
  tbody.querySelectorAll('[data-delete-admin]').forEach((btn) => {
    btn.addEventListener('click', () => deleteAdminConfirm(btn.dataset.deleteAdmin, btn.dataset.name));
  });
}

function filterAdmins() {
  const q = (document.getElementById('searchAdmins')?.value || '').toLowerCase();
  const roleFilter = document.getElementById('filterAdminRole')?.value || '';
  const filtered = currentData.admins.filter((a) => {
    const matchesText =
      (a.name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.username || '').toLowerCase().includes(q);
    const matchesRole = !roleFilter || (a.role || '').toLowerCase() === roleFilter;
    return matchesText && matchesRole;
  });
  renderAdmins(filtered);
}

function openCreateAdminModal() {
  document.getElementById('createAdminForm')?.reset();
  document.getElementById('createAdminForm').hidden = false;
  document.getElementById('tempPasswordMsg').hidden = true;
  openModal('createAdminModal');
}

function closeCreateAdminModal() {
  closeModal('createAdminModal');
}

async function submitCreateAdmin(e) {
  e.preventDefault();
  const formData = new FormData();
  formData.append('name', document.getElementById('adminName').value);
  formData.append('email', document.getElementById('adminEmail').value);
  formData.append('username', document.getElementById('adminUsername').value);
  formData.append('role', document.getElementById('adminRole').value);

  try {
    const response = await fetch('superadmin-create-admin', { method: 'POST', body: formData });
    const data = await response.json();

    if (data.success) {
      document.getElementById('tempPasswordValue').textContent = data.temp_password;
      document.getElementById('createAdminForm').hidden = true;
      document.getElementById('tempPasswordMsg').hidden = false;
      showToast('Administrateur créé.', 'success');
      setTimeout(() => {
        loadAllData();
        closeCreateAdminModal();
      }, 2500);
    } else {
      showMessage('adminsMessage', data.error || 'Erreur création', 'error');
    }
  } catch {
    showMessage('adminsMessage', 'Erreur réseau', 'error');
  }
}

function openEditAdminModal(adminId) {
  const admin = currentData.admins.find((a) => a.id === adminId);
  if (!admin) return;

  document.getElementById('editAdminId').value = adminId;
  document.getElementById('editAdminName').value = admin.name || '';
  document.getElementById('editAdminEmail').value = admin.email || '';
  document.getElementById('editAdminRole').value = admin.role || 'validator';
  openModal('editAdminModal');
}

async function submitEditAdmin(e) {
  e.preventDefault();
  const formData = new FormData();
  formData.append('id', document.getElementById('editAdminId').value);
  formData.append('name', document.getElementById('editAdminName').value);
  formData.append('email', document.getElementById('editAdminEmail').value);
  formData.append('role', document.getElementById('editAdminRole').value);

  try {
    const response = await fetch('superadmin-update-admin', { method: 'POST', body: formData });
    const data = await response.json();

    if (data.success) {
      showMessage('adminsMessage', 'Admin mis à jour.', 'success');
      closeModal('editAdminModal');
      loadAllData();
    } else {
      showMessage('adminsMessage', data.error || 'Erreur mise à jour', 'error');
    }
  } catch {
    showMessage('adminsMessage', 'Erreur réseau', 'error');
  }
}

async function deleteAdminConfirm(adminId, adminName) {
  const confirmed = await confirmPopup(`Supprimer l'admin « ${adminName} » ?<br><small>Action irréversible.</small>`);
  if (!confirmed) return;

  const formData = new FormData();
  formData.append('id', adminId);

  try {
    const response = await fetch('superadmin-delete-admin', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) {
      showMessage('adminsMessage', 'Admin supprimé.', 'success');
      loadAllData();
    } else {
      showMessage('adminsMessage', data.error || 'Erreur suppression', 'error');
    }
  } catch {
    showMessage('adminsMessage', 'Erreur réseau', 'error');
  }
}

/* =================== USERS =================== */

function renderUsers(data) {
  const list = data || currentData.users;
  const tbody = document.getElementById('usersBody');
  const noData = document.getElementById('usersNoData');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    if (noData) noData.hidden = false;
    return;
  }
  if (noData) noData.hidden = true;

  list.forEach((user) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escHtml(user.name || '—')}</strong></td>
      <td>${escHtml(user.email || '—')}</td>
      <td><code>${escHtml(user.uploader_ref || '—')}</code></td>
      <td>${fmtDate(user.created_at)}</td>
      <td>
        <button type="button" class="btn-delete" data-delete-user="${escHtml(user.id)}" data-name="${escHtml(user.name || '')}">Supprimer</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll('[data-delete-user]').forEach((btn) => {
    btn.addEventListener('click', () => deleteUserConfirm(btn.dataset.deleteUser, btn.dataset.name));
  });
}

function filterUsers() {
  const q = (document.getElementById('searchUsers')?.value || '').toLowerCase();
  const filtered = currentData.users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.uploader_ref || '').toLowerCase().includes(q)
  );
  renderUsers(filtered);
}

async function deleteUserConfirm(userId, userName) {
  const confirmed = await confirmPopup(`Voulez-vous vraiment supprimer ce contributeur « ${userName} » ?`);
  if (!confirmed) return;

  const formData = new FormData();
  formData.append('id', userId);

  try {
    const response = await fetch('superadmin-delete-user', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) {
      showMessage('usersMessage', 'Utilisateur supprimé.', 'success');
      loadAllData();
    } else {
      showMessage('usersMessage', data.error || 'Erreur', 'error');
    }
  } catch {
    showMessage('usersMessage', 'Erreur réseau', 'error');
  }
}

/* =================== AUDIOS =================== */

const STATUS_LABELS = {
  E: 'Envoyé',
  V: 'Validé',
  C: 'Contrôlé',
  R: 'Rejeté',
  A: 'Archivé',
  S: 'Supprimé'
};

function renderAudios(data) {
  const list = data || currentData.audios;
  const tbody = document.getElementById('audiosBody');
  const noData = document.getElementById('audiosNoData');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    if (noData) noData.hidden = false;
    return;
  }
  if (noData) noData.hidden = true;

  const adminMap = {};
  currentData.admins.forEach((a) => {
    adminMap[a.id] = a.name;
  });

  list.forEach((audio) => {
    const s = audio.status || 'E';
    const assignedName = audio.assigned_to ? adminMap[audio.assigned_to] || audio.assigned_to : '—';
    const controllerName = audio.controlled_admin_name || (audio.controlled_by ? adminMap[audio.controlled_by] || audio.controlled_by : '—');
    const fileName = audio.audio_name || audio.filename || '—';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td title="${escHtml(fileName)}">${escHtml(fileName.length > 28 ? fileName.slice(0, 28) + '…' : fileName)}</td>
      <td>${escHtml(audio.uploader_ref || '—')}</td>
      <td>${escHtml(assignedName)}</td>
      <td>${escHtml(controllerName)}</td>
      <td><span class="status-badge status-${s}">${s} — ${STATUS_LABELS[s] || s}</span></td>
      <td>${fmtDate(audio.date_creation || audio.created_at)}</td>
      <td>
        <button type="button" class="btn-edit" data-edit-audio="${escHtml(audio.id)}">Éditer</button>
        <button type="button" class="btn-delete" data-delete-audio="${escHtml(audio.id)}">Supprimer</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll('[data-edit-audio]').forEach((btn) => {
    btn.addEventListener('click', () => openEditAudioModal(btn.dataset.editAudio));
  });
  tbody.querySelectorAll('[data-delete-audio]').forEach((btn) => {
    btn.addEventListener('click', () => deleteAudioConfirm(btn.dataset.deleteAudio));
  });
}

function filterAudios() {
  const q = (document.getElementById('searchAudios')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  const adminMap = {};
  currentData.admins.forEach((a) => {
    adminMap[a.id] = a.name;
  });

  const filtered = currentData.audios.filter((a) => {
    const assignedName = a.assigned_to ? adminMap[a.assigned_to] || a.assigned_to : '';
    const controllerName = a.controlled_by ? adminMap[a.controlled_by] || a.controlled_by : '';
    const matchesText =
      !q ||
      (a.audio_name || a.filename || '').toLowerCase().includes(q) ||
      (a.uploader_ref || '').toLowerCase().includes(q) ||
      assignedName.toLowerCase().includes(q) ||
      controllerName.toLowerCase().includes(q) ||
      (a.transcription || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || a.status === statusFilter;
    return matchesText && matchesStatus;
  });
  renderAudios(filtered);
}

function openEditAudioModal(audioId) {
  const audio = currentData.audios.find((a) => a.id === audioId);
  if (!audio) return;

  document.getElementById('audioId').value = audioId;
  document.getElementById('audioStatus').value = audio.status || 'E';
  document.getElementById('audioTranscription').value = audio.transcription || '';
  document.getElementById('audioTranslation').value = audio.traduction || audio.translation || '';

  const select = document.getElementById('audioAssignedTo');
  select.innerHTML = '<option value="">Non assigné</option>';
  currentData.admins.forEach((admin) => {
    const opt = document.createElement('option');
    opt.value = admin.id;
    opt.textContent = `${admin.name} (${admin.username})`;
    if (admin.id === audio.assigned_to) opt.selected = true;
    select.appendChild(opt);
  });

  openModal('editAudioModal');
}

async function submitEditAudio(e) {
  e.preventDefault();
  const formData = new FormData();
  formData.append('id', document.getElementById('audioId').value);
  formData.append('assigned_to', document.getElementById('audioAssignedTo').value);
  formData.append('status', document.getElementById('audioStatus').value);
  formData.append('transcription', document.getElementById('audioTranscription').value);
  formData.append('translation', document.getElementById('audioTranslation').value);

  try {
    const response = await fetch('superadmin-update-audio', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) {
      showMessage('audiosMessage', 'Audio mis à jour.', 'success');
      closeModal('editAudioModal');
      loadAllData();
    } else {
      showMessage('audiosMessage', data.error || 'Erreur', 'error');
    }
  } catch {
    showMessage('audiosMessage', 'Erreur réseau', 'error');
  }
}

async function deleteAudioConfirm(audioId) {
  const confirmed = await confirmPopup('Supprimer cet audio ?');
  if (!confirmed) return;

  const formData = new FormData();
  formData.append('id', audioId);

  try {
    const response = await fetch('superadmin-delete-audio', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) {
      showMessage('audiosMessage', 'Audio supprimé.', 'success');
      loadAllData();
    } else {
      showMessage('audiosMessage', data.error || 'Erreur', 'error');
    }
  } catch {
    showMessage('audiosMessage', 'Erreur réseau', 'error');
  }
}

async function exportDataset() {
  showExportModal();
}

/* =================== LOGOUT & UTILS =================== */

async function logout() {
  const confirmed = await confirmPopup('Êtes-vous sûr de vouloir vous déconnecter ?');
  if (!confirmed) return;

  try {
    await fetch('admin-logout', { method: 'POST' });
  } catch {
    /* redirect anyway */
  }
  window.location.href = 'loginAdmin';
}

function showMessage(elementId, message, type) {
  const msgEl = document.getElementById(elementId);
  if (!msgEl) return;
  msgEl.textContent = message;
  msgEl.className = `inline-message ${type}`;
  msgEl.hidden = false;
  setTimeout(() => {
    msgEl.hidden = true;
  }, 5000);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast--exit');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function confirmPopup(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(26,58,82,0.45);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;';

    const box = document.createElement('div');
    box.className = 'confirm-box';
    box.style.cssText =
      'background:#fff;padding:1.5rem;max-width:420px;width:100%;border-radius:1rem;box-shadow:0 20px 60px rgba(0,0,0,0.2);';
    box.innerHTML = `
      <div style="margin-bottom:1rem;font-size:0.9375rem;line-height:1.55;">${message}</div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary confirm-cancel">Annuler</button>
        <button type="button" class="btn btn-primary confirm-accept">Confirmer</button>
      </div>
    `;

    box.querySelector('.confirm-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    box.querySelector('.confirm-accept').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copié !', 'success'));
}
