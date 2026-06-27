const OTP_TIMER = 10 * 60;

let timerInterval = null;
let remainingTime = OTP_TIMER;

document.addEventListener('DOMContentLoaded', () => {
  initializeOTP();
  loadIdentifier();
  startTimer();
  setupEventListeners();
});

function initializeOTP() {
  const otpInputs = document.querySelectorAll('.otp-input');

  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      if (e.target.value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
      updateHiddenOTPInput();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pastedData.replace(/[^0-9]/g, '').split('');

      digits.forEach((digit, i) => {
        if (index + i < otpInputs.length) {
          otpInputs[index + i].value = digit;
        }
      });

      const nextIndex = Math.min(index + digits.length, otpInputs.length - 1);
      otpInputs[nextIndex].focus();
      updateHiddenOTPInput();
    });
  });
}

function updateHiddenOTPInput() {
  const otpInputs = document.querySelectorAll('.otp-input');
  const code = Array.from(otpInputs).map((input) => input.value).join('');
  const codeInput = document.getElementById('codeInput');
  if (codeInput) codeInput.value = code;
}

function loadIdentifier() {
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get('identifier');
  const fromStorage = localStorage.getItem('verificationIdentifier');
  const identifier = fromUrl ? decodeURIComponent(fromUrl) : fromStorage;

  if (!identifier) {
    showToast('Identifiant manquant. Retour à la connexion.', 'error');
    setTimeout(() => { window.location.href = 'login-user'; }, 2000);
    return;
  }

  document.getElementById('userIdentifier').textContent = identifier;
  document.getElementById('identifierInput').value = identifier;

  const storedCode = localStorage.getItem('verificationCode');
  const storedId = localStorage.getItem('verificationIdentifier');
  const codeHint = document.getElementById('codeHint');

  if (storedCode && storedId === identifier && codeHint) {
    codeHint.hidden = false;
    codeHint.textContent = `Code de test (environnement local) : ${storedCode}`;
    codeHint.className = 'code-hint code-hint--dev';
  }
}

function startTimer() {
  const timerText = document.getElementById('timerText');
  const verifyBtn = document.getElementById('verifyBtn');
  remainingTime = OTP_TIMER;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    remainingTime--;

    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    timerText.classList.remove('expired');

    if (remainingTime <= 0) {
      clearInterval(timerInterval);
      timerText.classList.add('expired');
      timerText.textContent = 'Code expiré';
      if (verifyBtn) verifyBtn.disabled = true;
    }
  }, 1000);
}

function setupEventListeners() {
  const verifyForm = document.getElementById('verifyForm');
  const resendBtn = document.getElementById('resendBtn');
  const verifyBtn = document.getElementById('verifyBtn');

  verifyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const code = document.getElementById('codeInput').value;
    if (code.length !== 6) {
      showToast('Veuillez entrer un code de 6 chiffres.', 'error');
      showMessage('Veuillez entrer un code de 6 chiffres.', 'error');
      return;
    }

    verifyBtn.disabled = true;

    try {
      const formData = new FormData(verifyForm);
      const response = await fetch('verify-user', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        localStorage.removeItem('verificationCode');
        localStorage.removeItem('verificationIdentifier');

        showToast('Code vérifié ! Redirection…', 'success');
        showMessage('Connexion réussie !', 'success');

        setTimeout(() => {
          const target = result.redirect && result.redirect !== './'
            ? result.redirect.replace(/^\.\//, '')
            : 'index.html';
          window.location.href = target === '/' ? 'index.html' : target;
        }, 1400);
      } else {
        const errMsg = result.error || 'Code invalide ou expiré.';
        showToast(errMsg, 'error');
        showMessage(errMsg, 'error');
        verifyBtn.disabled = false;
      }
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur de connexion au serveur.', 'error');
      showMessage('Erreur de connexion au serveur.', 'error');
      verifyBtn.disabled = false;
    }
  });

  resendBtn?.addEventListener('click', async () => {
    const identifier = document.getElementById('identifierInput').value;
    if (!identifier) return;

    resendBtn.disabled = true;

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
          const codeHint = document.getElementById('codeHint');
          if (codeHint) {
            codeHint.hidden = false;
            codeHint.textContent = `Nouveau code de test : ${result.otp}`;
            codeHint.className = 'code-hint code-hint--dev';
          }
        }

        showToast('Nouveau code envoyé !', 'success');
        clearInterval(timerInterval);
        document.getElementById('timerText').classList.remove('expired');
        if (verifyBtn) verifyBtn.disabled = false;
        startTimer();

        document.querySelectorAll('.otp-input').forEach((input) => { input.value = ''; });
        updateHiddenOTPInput();
        document.querySelector('.otp-input')?.focus();
      } else {
        showToast(result.error || 'Erreur lors de l\'envoi du code.', 'error');
      }
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur de connexion au serveur.', 'error');
    } finally {
      resendBtn.disabled = false;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return;
  });
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
