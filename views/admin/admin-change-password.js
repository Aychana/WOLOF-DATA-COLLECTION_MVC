document.addEventListener('DOMContentLoaded', () => {
  loadAdminInfo();
  setupPasswordValidation();
  setupForm();
  setupToggleButtons();
});

async function loadAdminInfo() {
  try {
    const response = await fetch('auth-status-admin');
    const data = await response.json();
    if (!data.logged) {
      window.location.href = 'loginAdmin';
      return;
    }
    if (data.admin_name) {
      document.getElementById('adminName').textContent = data.admin_name;
    }
  } catch (error) {
    console.error('Error loading admin info:', error);
    window.location.href = 'loginAdmin';
  }
}

function setupToggleButtons() {
  document.querySelectorAll('.input-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = document.getElementById(btn.dataset.target);
      if (!field) return;
      field.type = field.type === 'password' ? 'text' : 'password';
    });
  });
}

function setupPasswordValidation() {
  document.getElementById('newPassword')?.addEventListener('input', () => {
    validatePasswordStrength(document.getElementById('newPassword').value);
  });
  document.getElementById('confirmPassword')?.addEventListener('input', checkPasswordMatch);
}

function setupForm() {
  const form = document.getElementById('changePasswordForm');
  const submitBtn = document.getElementById('submitBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('Veuillez remplir tous les champs.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      showToast('Le mot de passe ne respecte pas les critères.', 'error');
      return;
    }

    submitBtn.disabled = true;

    try {
      const body = `old_password=${encodeURIComponent(oldPassword)}&new_password=${encodeURIComponent(newPassword)}`;
      const response = await fetch('admin-Change-Password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Réponse serveur invalide.');
      }

      if (data.success) {
        showToast(data.message || 'Mot de passe changé avec succès !', 'success');
        setTimeout(() => {
          window.location.href = data.redirect || 'admin.html';
        }, 1500);
      } else {
        showToast(data.error || 'Erreur lors du changement.', 'error');
        submitBtn.disabled = false;
      }
    } catch (error) {
      console.error('Erreur:', error);
      showToast(error.message || 'Erreur réseau.', 'error');
      submitBtn.disabled = false;
    }
  });
}

function validatePasswordStrength(password) {
  const requirements = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password)
  };

  updateRequirement('req-length', requirements.length);
  updateRequirement('req-upper', requirements.upper);
  updateRequirement('req-lower', requirements.lower);
  updateRequirement('req-number', requirements.number);

  const metCount = Object.values(requirements).filter(Boolean).length;
  const strength = metCount <= 1 ? 'weak' : metCount === 2 ? 'fair' : metCount === 3 ? 'good' : 'strong';
  updateStrengthBar(strength);

  return { valid: Object.values(requirements).every(Boolean), strength };
}

function updateRequirement(id, met) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.toggle('met', met);
  const check = element.querySelector('.requirement-check');
  if (check) check.textContent = met ? '✓' : '✗';
}

function updateStrengthBar(strength) {
  const bar = document.getElementById('strengthBar');
  const text = document.getElementById('strengthText');
  if (!bar || !text) return;

  bar.className = 'strength-bar ' + strength;
  text.className = 'strength-text ' + strength;
  const labels = { weak: 'Très faible', fair: 'Moyen', good: 'Bon', strong: 'Très fort' };
  text.textContent = labels[strength] || 'Très faible';
}

function checkPasswordMatch() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const matchMessage = document.getElementById('matchMessage');

  if (!confirmPassword) {
    matchMessage.hidden = true;
    return;
  }

  matchMessage.hidden = false;
  if (newPassword === confirmPassword) {
    matchMessage.className = 'match-message match-message--success';
    matchMessage.textContent = '✓ Les mots de passe correspondent';
  } else {
    matchMessage.className = 'match-message match-message--error';
    matchMessage.textContent = '✗ Les mots de passe ne correspondent pas';
  }
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
