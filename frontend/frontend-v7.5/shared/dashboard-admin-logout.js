/* =====================================================
   ODJAVA (zajednička skripta za sve dashboard stranice)
   -----------------------------------------------------
   VAZNO: putanja do login stranice NIJE fiksna u skripti,
   nego dolazi iz data-login-path atributa na <script> tagu
   (isti princip kao kod shared/auth.js).

   Skripta se poziva ovako:
   <script src=".../shared/dashboard-admin-logout.js"
           data-login-path="../login/login.html"></script>
   ===================================================== */
(function () {
    var thisScript = document.currentScript;
    var loginPath = thisScript.getAttribute('data-login-path') || 'login.html';

    var btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        // clearAuthSession() je definisana u shared/api.js (učitanom prije ove skripte na
        // svim dashboard stranicama) - koristimo je ovdje umjesto da ručno brišemo iste
        // sessionStorage ključeve na dva mjesta, da ne dođe do razmimoilaženja ako se
        // ikad doda novi podatak u sesiju.
        clearAuthSession();
        window.location.href = loginPath;
    });
})();
