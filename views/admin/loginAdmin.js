document.addEventListener('DOMContentLoaded', () => {
  checkAlreadyLogged();
  setupLoginForm();
});

async function checkAlreadyLogged() {
  try {
    const response = await fetch('auth-status-admin');
    const data = await response.json();
    if (!data.logged) return;
    if (data.is_superadmin) {
      window.location.href = 'superadmin-dashboard';
      return;
    }
    window.location.href = 'admin.html';
  } catch (error) {
    console.error('Error checking auth:', error);
  }
}

function setupLoginForm() {
  const loginForm = document.getElementById('loginForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn?.querySelector('.btn-text');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showToast('Veuillez remplir tous les champs.', 'error');
      showMessage('Veuillez remplir tous les champs.', 'error');
      return;
    }

    setLoading(true);

    try {
      const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const response = await fetch('admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      const result = await response.json();

      if (result.success) {
        showToast('Connexion réussie ! Redirection…', 'success');
        setTimeout(() => {
          window.location.href = result.redirect || 'admin.html';
        }, 1200);
      } else {
        const errMsg = result.error || 'Erreur d\'authentification.';
        showToast(errMsg, 'error');
        showMessage(errMsg, 'error');
        setLoading(false);
      }
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur de connexion au serveur.', 'error');
      showMessage('Erreur de connexion au serveur.', 'error');
      setLoading(false);
    }
  });

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('is-loading', loading);
    if (btnText) btnText.textContent = loading ? 'Connexion…' : 'Se connecter';
  }
}

function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message message--${type}`;
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
