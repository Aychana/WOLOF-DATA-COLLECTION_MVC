document.addEventListener('DOMContentLoaded', () => {
  loadProfileData();
  setupEventListeners();
});

async function loadProfileData() {
  const profileName = document.getElementById('profileName');
  try {
    const res = await fetch('user-profile');
    const data = await res.json();

    if (data.status !== 'success' || !data.logged) {
      profileName.textContent = 'Non connecté';
      showLoginPrompt();
      return;
    }

    const user = data.user;
    const stats = data.stats;

    profileName.textContent = user.name || 'Contributeur';
    document.getElementById('profileEmail').textContent = user.email || '—';
    document.getElementById('profileDate').textContent = formatDate(user.created_at);
    document.getElementById('profileLanguage').textContent = user.language || 'Wolof';

    setAvatarInitials(user.name);

    const total = stats.total || 0;
    const validated = stats.validated || 0;
    document.getElementById('statsSubmitted').textContent = total;
    document.getElementById('statsValidated').textContent = validated;
    document.getElementById('statsPending').textContent = stats.pending || 0;
    document.getElementById('statsRejected').textContent = stats.rejected || 0;

    const pct = total > 0 ? Math.round((validated / total) * 100) : 0;
    document.getElementById('statsValidatedPct').textContent = `${pct} % validés`;
  } catch (err) {
    console.error('Erreur chargement profil:', err);
    profileName.textContent = 'Erreur de chargement';
  }
}

function showLoginPrompt() {
  const card = document.querySelector('.profile-card');
  if (!card) return;
  const actions = document.querySelector('.profile-actions');
  if (actions) {
    actions.innerHTML = `
      <a href="login-user" class="btn btn-primary" style="width:100%;justify-content:center;">
        Se connecter
      </a>`;
  }
}

function setAvatarInitials(name) {
  const el = document.getElementById('profileAvatar');
  if (!el) return;
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  let initials = '?';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts[0]) {
    initials = parts[0].slice(0, 2).toUpperCase();
  }
  el.textContent = initials;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function setupEventListeners() {
  const passwordModal = document.getElementById('passwordModal');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const newPasswordInput = document.getElementById('newPassword');

  changePasswordBtn?.addEventListener('click', () => {
    passwordModal.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('passwordMessage').textContent = '';
  });

  document.querySelectorAll('[data-close="password"]').forEach(el => {
    el.addEventListener('click', closePasswordModal);
  });

  document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await changePassword();
  });

  newPasswordInput?.addEventListener('input', checkPasswordStrength);

  logoutBtn?.addEventListener('click', async () => {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
    try {
      const res = await fetch('user-logout', { method: 'POST' });
      const data = await res.json();
      window.location.href = data.redirect || 'login-user';
    } catch (err) {
      console.error('Erreur déconnexion:', err);
      window.location.href = 'login-user';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePasswordModal();
  });
}

function closePasswordModal() {
  const passwordModal = document.getElementById('passwordModal');
  passwordModal.hidden = true;
  document.body.style.overflow = '';
}

function checkPasswordStrength() {
  const password = document.getElementById('newPassword')?.value || '';
  const fill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  if (!fill || !strengthText) return;

  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[0-9]/.test(password)) strength += 25;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 25;

  const color = strength < 50 ? '#ef4444' : strength < 75 ? '#f59e0b' : '#10b981';
  fill.style.width = strength + '%';
  fill.style.background = color;
  strengthText.textContent = strength < 50 ? 'Faible' : strength < 75 ? 'Moyen' : 'Fort';
  strengthText.style.color = color;
}

async function changePassword() {
  const messageEl = document.getElementById('passwordMessage');
  try {
    const res = await fetch('user-change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: document.getElementById('currentPassword')?.value,
        new_password: document.getElementById('newPassword')?.value
      })
    });
    const data = await res.json();
    messageEl.textContent = data.message || 'Action non disponible.';
    messageEl.className = 'message message--error';
  } catch (err) {
    console.error(err);
    messageEl.textContent = 'Une erreur est survenue.';
    messageEl.className = 'message message--error';
  }
}
