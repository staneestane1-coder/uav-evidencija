document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('id');

    const form = document.getElementById('editUserForm');
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

    if (!userId) {
        formError.textContent = 'Nije naveden korisnik za izmjenu.';
        form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
        return;
    }

    try {
        const user = await apiFetch('/korisnici/' + userId);
        document.getElementById('userNameDisplay').value = user.userName || '';
        document.getElementById('firstName').value = user.firstName || '';
        document.getElementById('lastName').value = user.lastName || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('role').value = user.role || '';
        document.getElementById('status').value = user.status || 'aktivan';
    } catch (err) {
        formError.textContent = 'Greška pri učitavanju korisnika: ' + err.message;
        form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';
        clearFieldErrors();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password) {
            const passwordError = window.PasswordPolicy.validate(password);
            if (passwordError) {
                passwordGroup.classList.add('error');
                passwordGroup.querySelector('.field-error').textContent = passwordError;
                return;
            }
        }

        if (password && password !== confirmPassword) {
            confirmPasswordGroup.classList.add('error');
            return;
        }

        const payload = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            role: document.getElementById('role').value,
            status: document.getElementById('status').value,
            newPassword: password || null
        };

        if (submitBtn) { submitBtn.disabled = true; }

        try {
            await apiFetch('/korisnici/' + userId, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            window.location.href = '../korisnici/dashboard-admin-korisnici.html';
        } catch (err) {
            formError.textContent = err.message;
            if (submitBtn) { submitBtn.disabled = false; }
        }
    });
});
