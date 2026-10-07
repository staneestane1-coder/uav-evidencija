const REDIRECT_BY_ROLE = {
    administrator: '../admin/dashboard-admin.html',
    kontrola_leta: '../kontrola/dashboard-kontrola.html',
    operater: '../operater/dashboard-operater.html'
};

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('sessionExpired')) {
        sessionStorage.removeItem('sessionExpired');
        const errorMsg = document.getElementById('errorMsg');
        if (errorMsg) {
            errorMsg.textContent = 'Sesija je istekla. Prijavite se ponovo.';
            errorMsg.classList.add('visible');
        }
    }

    // Prenosi vec upisano korisnicko ime na "Zaboravljena lozinka" stranicu (kroz URL
    // query parametar) da ga korisnik ne mora ponovo kucati - vidi forgot-password.js,
    // koji tim parametrom predpopunjava svoje polje za korisnicko ime.
    const usernameInput = document.getElementById('username');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (usernameInput && forgotPasswordLink) {
        const updateForgotPasswordLink = () => {
            const value = usernameInput.value.trim();
            forgotPasswordLink.href = value
                ? `forgot-password.html?username=${encodeURIComponent(value)}`
                : 'forgot-password.html';
        };
        usernameInput.addEventListener('input', updateForgotPasswordLink);
        updateForgotPasswordLink();
    }
});

async function handleLogin(event) {
    event.preventDefault(); // sprijecava osvjezavanje stranice

    const username = document.getElementById('username').value.trim();
    // Lozinka se NE trimuje - razmak na pocetku/kraju je (rijedak, ali) validan dio lozinke,
    // a backend je takodje ne trimuje prije provjere.
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.querySelector('.btn-login');

    errorMsg.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Prijavljivanje...';

    try {
        const response = await fetch(API_BASE_URL + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: username, password: password })
        });

        const data = await response.json();

        if (!response.ok) {
            errorMsg.textContent = data.message || 'Pogrešno korisničko ime ili lozinka.';
            errorMsg.classList.add('visible');
            return;
        }

        setAuthSession(data);

        const redirect = REDIRECT_BY_ROLE[data.role];
        if (redirect) {
            window.location.href = redirect;
        } else {
            errorMsg.textContent = 'Nepoznata uloga korisnika. Obratite se administratoru.';
            errorMsg.classList.add('visible');
        }
    } catch (err) {
        errorMsg.textContent = 'Ne mogu da se povežem sa serverom. Provjerite da li je backend pokrenut.';
        errorMsg.classList.add('visible');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Prijavi se';
    }
}
