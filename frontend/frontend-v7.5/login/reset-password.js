let resetToken = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    resetToken = params.get('token');

    if (!resetToken) {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.textContent = 'Link za reset lozinke nije ispravan (nedostaje token). Zatražite novi link.';
        errorMsg.classList.add('visible');
        document.getElementById('resetPasswordForm').querySelectorAll('input, button[type="submit"]').forEach(function (el) {
            el.disabled = true;
        });
    }
});

async function handleResetPassword(event) {
    event.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');
    const submitBtn = document.getElementById('submitBtn');

    errorMsg.classList.remove('visible');
    successMsg.classList.remove('visible');

    const policyError = window.PasswordPolicy ? window.PasswordPolicy.validate(newPassword) : null;
    if (policyError) {
        errorMsg.textContent = policyError;
        errorMsg.classList.add('visible');
        return;
    }

    if (newPassword !== confirmPassword) {
        errorMsg.textContent = 'Nova lozinka i potvrda se ne poklapaju.';
        errorMsg.classList.add('visible');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Postavljanje...';

    try {
        const data = await apiFetch('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token: resetToken, newPassword: newPassword })
        });

        successMsg.textContent = data.message;
        successMsg.classList.add('visible');
        document.getElementById('resetPasswordForm').querySelectorAll('input, button[type="submit"]').forEach(function (el) {
            el.disabled = true;
        });

        setTimeout(function () {
            window.location.href = 'login.html';
        }, 2000);
    } catch (err) {
        errorMsg.textContent = err.message || 'Greška prilikom postavljanja nove lozinke. Pokušajte ponovo.';
        errorMsg.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Postavi novu lozinku';
    }
}
