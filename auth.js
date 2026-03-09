/* ===== AUTH PAGE SCRIPT ===== */

(function () {
  'use strict';

  const tabLogin  = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const indicator = document.getElementById('tabIndicator');
  const panelLogin  = document.getElementById('panelLogin');
  const panelSignup = document.getElementById('panelSignup');

  function switchTab(target) {
    const goLogin = target === 'login';

    tabLogin.classList.toggle('auth-tab--active', goLogin);
    tabSignup.classList.toggle('auth-tab--active', !goLogin);
    tabLogin.setAttribute('aria-selected', goLogin ? 'true' : 'false');
    tabSignup.setAttribute('aria-selected', goLogin ? 'false' : 'true');

    indicator.classList.toggle('right', !goLogin);

    if (goLogin) {
      panelSignup.classList.add('auth-panel--hidden');
      panelLogin.classList.remove('auth-panel--hidden');
    } else {
      panelLogin.classList.add('auth-panel--hidden');
      panelSignup.classList.remove('auth-panel--hidden');
    }
  }

  tabLogin.addEventListener('click',  () => switchTab('login'));
  tabSignup.addEventListener('click', () => switchTab('signup'));

  document.querySelectorAll('.auth-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.goto));
  });

  // Check URL hash for initial tab
  if (window.location.hash === '#signup') switchTab('signup');

  /* ---- Password visibility toggles ---- */
  document.querySelectorAll('.form-toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.querySelector('.eye-show').style.display = isHidden ? 'none'  : '';
      btn.querySelector('.eye-hide').style.display = isHidden ? ''      : 'none';
    });
  });

  /* ---- Password strength meter ---- */
  const pwInput = document.getElementById('signupPassword');
  const pwFill  = document.getElementById('pwFill');
  const pwLabel = document.getElementById('pwLabel');

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  function scorePassword(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(4, score);
  }

  if (pwInput) {
    pwInput.addEventListener('input', () => {
      const score = scorePassword(pwInput.value);
      pwFill.className = 'pw-strength-fill' + (score ? ` strength-${score}` : '');
      pwLabel.className = 'pw-strength-label' + (score ? ` strength-${score}` : '');
      pwLabel.textContent = score ? strengthLabels[score] : 'Enter a password';
    });
  }

  /* ---- Form validation helpers ---- */
  function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function markInput(inputEl, hasError) {
    inputEl.classList.toggle('input-error', hasError);
  }

  function clearErrors(ids) {
    ids.forEach(id => setError(id, ''));
  }

  /* ---- Login form ---- */
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email    = loginForm.elements.email;
    const password = loginForm.elements.password;
    let valid = true;

    clearErrors(['loginEmailErr', 'loginPasswordErr']);
    markInput(email, false);
    markInput(password, false);

    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      setError('loginEmailErr', 'Please enter a valid email address.');
      markInput(email, true);
      valid = false;
    }

    if (!password.value || password.value.length < 6) {
      setError('loginPasswordErr', 'Password must be at least 6 characters.');
      markInput(password, true);
      valid = false;
    }

    if (valid) {
      const btn = loginForm.querySelector('.auth-submit');
      btn.textContent = 'Signing in…';
      btn.disabled = true;
      // Placeholder — wire up your real auth logic here
      setTimeout(() => {
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }, 2000);
    }
  });

  /* ---- Signup form ---- */
  const signupForm = document.getElementById('signupForm');
  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const first    = signupForm.elements.first_name;
    const last     = signupForm.elements.last_name;
    const email    = signupForm.elements.email;
    const password = signupForm.elements.password;
    const confirm  = signupForm.elements.confirm_password;
    const terms    = signupForm.elements.terms;
    let valid = true;

    clearErrors(['signupFirstErr','signupLastErr','signupEmailErr','signupPasswordErr','signupConfirmErr','termsErr']);
    [first, last, email, password, confirm].forEach(f => markInput(f, false));

    if (!first.value.trim()) {
      setError('signupFirstErr', 'First name is required.');
      markInput(first, true);
      valid = false;
    }

    if (!last.value.trim()) {
      setError('signupLastErr', 'Last name is required.');
      markInput(last, true);
      valid = false;
    }

    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      setError('signupEmailErr', 'Please enter a valid email address.');
      markInput(email, true);
      valid = false;
    }

    if (!password.value || password.value.length < 8) {
      setError('signupPasswordErr', 'Password must be at least 8 characters.');
      markInput(password, true);
      valid = false;
    }

    if (confirm.value !== password.value) {
      setError('signupConfirmErr', 'Passwords do not match.');
      markInput(confirm, true);
      valid = false;
    }

    if (!terms.checked) {
      setError('termsErr', 'You must agree to the Terms of Service.');
      valid = false;
    }

    if (valid) {
      const btn = signupForm.querySelector('.auth-submit');
      btn.textContent = 'Creating account…';
      btn.disabled = true;
      // Placeholder — wire up your real auth logic here
      setTimeout(() => {
        btn.textContent = 'Create Account';
        btn.disabled = false;
      }, 2000);
    }
  });

})();
