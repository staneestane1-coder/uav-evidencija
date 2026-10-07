// Zajednicke funkcije za "Snimci" stranice (admin/kontrola/operater) —
// izdvojeno da se izbjegne trostruko dupliranje istog formatiranja/statusa.
const SnimciUtils = (function () {
    // Status leta - dijeli se ovdje (umjesto lokalne kopije po stranici) da uvođenje
    // novih statusa (npr. na-cekanju/odbijen, tok odobrenja leta) ne zahtijeva ručnu
    // izmjenu na svakom mjestu koje prikazuje status leta.
    const STATUS_BADGE = { planiran: 'planned', 'u-letu': 'status-progress', zavrsen: 'success', 'na-cekanju': 'warning', odbijen: 'danger', otkazan: 'neutral' };
    const STATUS_LABELS = { planiran: 'Planiran', 'u-letu': 'U letu', zavrsen: 'Završen', 'na-cekanju': 'Na čekanju', odbijen: 'Odbijen', otkazan: 'Otkazan' };

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function formatDate(iso) {
        const d = new Date(iso);
        return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + '.';
    }

    function formatDateTime(iso) {
        const d = new Date(iso);
        return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function formatTime(iso) {
        const d = new Date(iso);
        return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // Da li je let stvarno zavrsen - koristi "operater/snimci" i "admin/snimci" da odluci koji
    // letovi uopste ulaze u listu prije uploada. Otkad operater sam vodi let kroz stanja
    // (Zadatak 3) i snimke moze otpremiti tek nakon "Oznaci kao zavrsen", "u-letu" vise NIJE
    // dovoljan - let jos uvijek traje, snimci sa terena po definiciji ne mogu postojati dok
    // let nije zavrsen. Namjerna posljedica: upload nije moguc dok je let "u-letu".
    function moglaSeDogoditi(flight) {
        return flight.status === 'zavrsen';
    }

    // Da li let vec ima bar jedan otpremljen snimak - koristi "kontrola/snimci" i
    // "admin/snimci" (iskljucivo pregledne stranice, bez uploada) da sakriju letove bez
    // ijednog snimka, umjesto da prikazu praznu "0 snimak(a)" karticu.
    function imaSnimke(flight) {
        return Array.isArray(flight.mediaFiles) && flight.mediaFiles.length > 0;
    }

    return {
        STATUS_BADGE, STATUS_LABELS, pad, formatDate, formatDateTime, formatTime, escapeHtml, debounce,
        moglaSeDogoditi, imaSnimke
    };
})();
