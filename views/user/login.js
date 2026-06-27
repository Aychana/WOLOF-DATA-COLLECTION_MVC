document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const submitBtn = document.getElementById('submitBtn');
  const identifierInput = document.getElementById('identifier');
  const messageEl = document.getElementById('message');
  const btnText = submitBtn?.querySelector('.btn-text');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifier = identifierInput.value.trim();
    if (!identifier) {
      showToast('Veuillez entrer votre email ou votre téléphone.', 'error');
      showMessage('Veuillez entrer votre email ou votre téléphone.', 'error');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('identifier', identifier);

      const response = await fetch('request-verification', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        if (result.otp) {
          localStorage.setItem('verificationCode', result.otp);
          localStorage.setItem('verificationIdentifier', identifier);
        }

        showToast('Code envoyé ! Redirection en cours…', 'success');
        showMessage('Code envoyé ! Redirection…', 'success');

        const redirectUrl = `verify.html?identifier=${encodeURIComponent(identifier)}`;
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1200);
      } else {
        const errMsg = result.error || 'Erreur lors de la connexion.';
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
    if (btnText) {
      btnText.textContent = loading ? 'Envoi en cours…' : 'Soumettre';
    }
  }

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.hidden = false;
    messageEl.textContent = text;
    messageEl.className = `message message--${type}`;
  }
});

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
