document.addEventListener('DOMContentLoaded', () => {
    // Predpopunjava korisnicko ime ako je proslijedjeno kroz URL sa login stranice
    // (vidi login.js - link "Zaboravili ste lozinku?" prenosi vec upisano korisnicko
    // ime kroz ?username=...). U tom slucaju polje se SAKRIVA (korisnik ga je vec
    // upisao na login strani, ne treba da ga gleda/kuca ponovo) - i dalje se salje
    // sa formom, samo vizuelno nije prikazano. Ako korisnik dodje DIREKTNO na ovu
    // stranicu (bez parametra - npr. otvori je kao bookmark), polje ostaje vidljivo
    // jer nema drugog nacina da unese korisnicko ime.
    const usernameInput = document.getElementById('username');
    const prefillUsername = new URLSearchParams(window.location.search).get('username');
    if (prefillUsername) {
        usernameInput.value = prefillUsername;
        usernameInput.closest('.form-group').style.display = 'none';
    }
});

async function handleForgotPassword(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');
    const submitBtn = document.getElementById('submitBtn');

    errorMsg.classList.remove('visible');
    successMsg.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Slanje...';

    try {
        const data = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ userName: username, email: email })
        });

        // Backend namjerno uvijek vraća istu generičku poruku (bez obzira da li email postoji
        // u bazi) - ne otkrivamo koji nalozi su registrovani. Vidi AuthController.ForgotPassword.
        successMsg.textContent = data.message;
        successMsg.classList.add('visible');
        document.getElementById('forgotPasswordForm').querySelectorAll('input').forEach(function (el) {
            el.disabled = true;
        });
        submitBtn.textContent = 'Poslato';
    } catch (err) {
        errorMsg.textContent = err.message || 'Greška prilikom slanja zahtjeva. Pokušajte ponovo.';
        errorMsg.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pošalji link za reset';
    }
}
