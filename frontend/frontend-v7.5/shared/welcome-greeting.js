/* =====================================================
   POZDRAV NA DASHBOARDU (ime ulogovanog korisnika)
   -----------------------------------------------------
   Cita 'displayName' iz sessionStorage (postavlja ga
   login.js pri prijavi) i upisuje ime u element sa
   id="welcomeName". Ako iz nekog razloga vrijednost ne
   postoji (npr. direktan pristup bez prijave - auth.js ce
   ionako preusmjeriti na login), ostaje postojeci tekst
   iz HTML-a kao rezervna vrijednost.
   ===================================================== */
document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('welcomeName');
    if (!el) return;

    var displayName = sessionStorage.getItem('displayName');
    if (displayName) {
        el.textContent = displayName.split(' ')[0];
    }
});
