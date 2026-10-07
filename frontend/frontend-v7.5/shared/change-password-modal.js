/* =====================================================
   PROMIJENI LOZINKU (samostalna komponenta, sve uloge)
   -----------------------------------------------------
   Ubrizgava svoju stavku u sidebar meni ("Promijeni lozinku",
   iznad Odjave) i svoj modal, isti obrazac kao shared/drone-docs-modal.js.
   Dostupno administratoru, kontroli leta i operateru podjednako -
   za razliku od admin-ovog resetovanja TUĐE lozinke (KorisniciController),
   ovo je promjena SOPSTVENE lozinke i zahtijeva poznavanje trenutne.

   Ucitava se jednom po stranici:
   <script src=".../shared/change-password-modal.js"></script>
   (poslije shared/api.js i shared/password-policy.js)
   ===================================================== */
(function () {

    function injectStylesOnce() {
        if (document.getElementById('cpm-styles')) return;
        var style = document.createElement('style');
        style.id = 'cpm-styles';
        style.textContent = [
            '.cpm-overlay{position:fixed;inset:0;background:rgba(8,14,24,0.72);display:none;align-items:center;justify-content:center;z-index:2000;}',
            '.cpm-overlay.show{display:flex;}',
            '.cpm-panel{background:#16293d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;width:min(420px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.45);}',
            '.cpm-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.08);}',
            '.cpm-header h3{margin:0;font-size:17px;font-weight:700;color:#fff;}',
            '.cpm-close{background:transparent;border:1px solid transparent;border-radius:6px;color:#7a9bbf;font-size:16px;cursor:pointer;line-height:1;padding:4px 8px;transition:background 0.2s,color 0.2s,border-color 0.2s;}',
            '.cpm-close:hover{background:rgba(0,120,212,0.12);border-color:rgba(0,120,212,0.3);color:#5eb3f5;}',
            '.cpm-body{padding:18px 22px 22px;}',
            '.cpm-field{margin-bottom:14px;}',
            '.cpm-field label{display:block;font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:#7a9bbf;margin-bottom:6px;}',
            '.cpm-field input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:11px 14px;color:#e8f1fb;font-size:14px;transition:border-color 0.2s,background 0.2s;}',
            '.cpm-field input:focus{outline:none;border-color:#0078d4;background:rgba(0,120,212,0.06);}',
            '.cpm-error{color:#ff6b6b;font-size:13px;margin:0 0 14px;min-height:0;}',
            '.cpm-success{color:#7de3a8;font-size:13px;margin:0 0 14px;}',
            '.cpm-actions{display:flex;justify-content:flex-end;gap:10px;}',
            '.cpm-btn{border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;}',
            '.cpm-btn-cancel{background:rgba(255,255,255,0.06);color:#e8f1fb;}',
            '.cpm-btn-cancel:hover{background:rgba(255,255,255,0.1);}',
            '.cpm-btn-submit{background:#0078d4;color:#fff;}',
            '.cpm-btn-submit:hover{background:#006abc;}',
            '.cpm-btn-submit:disabled{background:#3a5a78;cursor:not-allowed;}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function ensureModal() {
        injectStylesOnce();
        var overlay = document.getElementById('cpmOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'cpm-overlay';
        overlay.id = 'cpmOverlay';
        overlay.innerHTML =
            '<div class="cpm-panel">' +
                '<div class="cpm-header">' +
                    '<h3>Promijeni lozinku</h3>' +
                    '<button type="button" class="cpm-close" id="cpmClose" aria-label="Zatvori">✕</button>' +
                '</div>' +
                '<form class="cpm-body" id="cpmForm" novalidate>' +
                    '<div class="cpm-field">' +
                        '<label for="cpmCurrent">Trenutna lozinka</label>' +
                        '<input type="password" id="cpmCurrent" autocomplete="current-password">' +
                    '</div>' +
                    '<div class="cpm-field">' +
                        '<label for="cpmNew">Nova lozinka</label>' +
                        '<input type="password" id="cpmNew" autocomplete="new-password" maxlength="128">' +
                    '</div>' +
                    '<div class="cpm-field">' +
                        '<label for="cpmConfirm">Potvrdi novu lozinku</label>' +
                        '<input type="password" id="cpmConfirm" autocomplete="new-password" maxlength="128">' +
                    '</div>' +
                    '<p class="cpm-error" id="cpmError"></p>' +
                    '<div class="cpm-actions">' +
                        '<button type="button" class="cpm-btn cpm-btn-cancel" id="cpmCancel">Otkaži</button>' +
                        '<button type="submit" class="cpm-btn cpm-btn-submit" id="cpmSubmit">Promijeni lozinku</button>' +
                    '</div>' +
                '</form>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        document.getElementById('cpmClose').addEventListener('click', closeModal);
        document.getElementById('cpmCancel').addEventListener('click', closeModal);
        document.getElementById('cpmForm').addEventListener('submit', onSubmit);

        // ESC zatvara modal - isti obrazac kao shared/media-carousel.js.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('show')) closeModal();
        });

        return overlay;
    }

    function closeModal() {
        var overlay = document.getElementById('cpmOverlay');
        if (overlay) overlay.classList.remove('show');
    }

    function showError(msg) {
        var el = document.getElementById('cpmError');
        if (el) el.textContent = msg || '';
    }

    function loginRedirectPath() {
        var authScript = document.querySelector('script[data-login-path]');
        return authScript ? authScript.getAttribute('data-login-path') : '../login/login.html';
    }

    function onSubmit(e) {
        e.preventDefault();
        showError('');

        var current = document.getElementById('cpmCurrent').value;
        var novaLozinka = document.getElementById('cpmNew').value;
        var potvrda = document.getElementById('cpmConfirm').value;

        if (!current || !novaLozinka || !potvrda) {
            showError('Sva polja su obavezna.');
            return;
        }

        var policyError = window.PasswordPolicy ? window.PasswordPolicy.validate(novaLozinka) : null;
        if (policyError) {
            showError(policyError);
            return;
        }

        if (novaLozinka !== potvrda) {
            showError('Nova lozinka i potvrda se ne poklapaju.');
            return;
        }

        var submitBtn = document.getElementById('cpmSubmit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mijenjam...';

        apiFetch('/auth/lozinka', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword: current, newPassword: novaLozinka })
        }).then(function () {
            submitBtn.textContent = 'Uspješno! Preusmjeravanje...';
            var body = document.getElementById('cpmForm');
            body.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; });
            var success = document.createElement('p');
            success.className = 'cpm-success';
            success.textContent = 'Lozinka je promijenjena. Prijavite se ponovo sa novom lozinkom.';
            document.getElementById('cpmError').after(success);

            setTimeout(function () {
                clearAuthSession();
                window.location.href = loginRedirectPath();
            }, 1800);
        }).catch(function (err) {
            showError(err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Promijeni lozinku';
        });
    }

    function openModal() {
        var overlay = ensureModal();
        showError('');
        document.getElementById('cpmForm').reset();
        var submitBtn = document.getElementById('cpmSubmit');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Promijeni lozinku';
        var oldSuccess = overlay.querySelector('.cpm-success');
        if (oldSuccess) oldSuccess.remove();
        overlay.classList.add('show');
        document.getElementById('cpmCurrent').focus();
    }

    function injectNavLink() {
        var navList = document.querySelector('.nav-list');
        if (!navList || document.getElementById('changePasswordNavLink')) return;

        var li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML =
            '<a href="#" id="changePasswordNavLink">' +
                '<span class="nav-icon" aria-hidden="true">🔑</span> Promijeni lozinku' +
            '</a>';
        navList.appendChild(li);

        li.querySelector('a').addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    document.addEventListener('DOMContentLoaded', injectNavLink);

    window.ChangePasswordModal = { open: openModal };
})();
