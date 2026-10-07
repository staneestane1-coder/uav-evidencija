/* =====================================================
   AUTH GUARD (frontend nivo)
   -----------------------------------------------------
   Provjerava da li postoji aktivan token + odgovarajuca
   uloga (sessionStorage 'token' i 'role') prije nego sto
   se stranica prikaze. Ako ne postoji ili ne odgovara
   sekciji, korisnik se odmah preusmjerava na login.

   VAZNO: Ovo je frontend provjera i sprecava SLUCAJAN
   pristup (kucanje URL-a, otvaranje linka, itd). Pravu
   autorizaciju radi backend - svaki API poziv nezavisno
   provjerava JWT token na serverskoj strani ([Authorize]
   / [Authorize(Roles = "...")] na kontrolerima), pa i
   ako se sessionStorage rucno izmijeni kroz DevTools,
   API pozivi ce svejedno biti odbijeni (401/403).

   Skripta se poziva ovako, sa dva data-atributa na <script> tagu:
   <script src=".../shared/auth.js"
           data-required-role="administrator"
           data-login-path="../login/login.html"></script>
   ===================================================== */
(function () {
    var thisScript = document.currentScript;
    var requiredRole = thisScript.getAttribute('data-required-role');
    var loginPath = thisScript.getAttribute('data-login-path') || 'login.html';

    var token = sessionStorage.getItem('token');
    var role = sessionStorage.getItem('role');

    if (!token || !role || (requiredRole && role !== requiredRole)) {
        window.location.replace(loginPath);
    }
})();
