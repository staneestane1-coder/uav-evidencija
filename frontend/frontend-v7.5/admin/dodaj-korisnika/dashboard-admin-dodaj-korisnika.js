document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addUserForm');
    const formError = document.getElementById('formError');
    const submitBtn = form.querySelector('button[type="submit"], .btn-primary');
    const passwordGroup = document.getElementById('passwordGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');

    function clearFieldErrors() {
        passwordGroup.classList.remove('error');
        confirmPasswordGroup.classList.remove('error');
    }

    document.getElementById('password').addEventListener('input', clearFieldErrors);
    document.getElementById('confirmPassword').addEventListener('input', clearFieldErrors);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';
        clearFieldErrors();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        const passwordError = window.PasswordPolicy.validate(password);
        if (passwordError) {
            passwordGroup.classList.add('error');
            passwordGroup.querySelector('.field-error').textContent = passwordError;
            return;
        }

        if (password !== confirmPassword) {
            confirmPasswordGroup.classList.add('error');
            return;
        }

        const payload = {
            userName: document.getElementById('userName').value.trim(),
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            role: document.getElementById('role').value,
            status: document.getElementById('status').value,
            password: password
        };

        if (submitBtn) { submitBtn.disabled = true; }

        try {
            await apiFetch('/korisnici', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            window.location.href = '../korisnici/dashboard-admin-korisnici.html';
        } catch (err) {
            formError.textContent = err.message;
            if (submitBtn) { submitBtn.disabled = false; }
        }
    });
});
