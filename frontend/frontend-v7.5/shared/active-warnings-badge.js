// Broj letova (ovog operatera) koje operater treba da pogleda i potvrdi na sidebar stavci
// "Moji letovi" - isti princip kao shared/pending-flights-badge.js (koji broji letove
// "na-cekanju" za kontrolu). Zbraja DVA izvora istog signala (Zadatak 2 i Zadatak 4):
// nepotvrđena upozorenja tokom leta i nepotvrđena odbijanja - namjerno JEDAN broj, ne
// zaseban brojač po tipu (isti koncept "stvari za pregled"). <span id="activeWarningsBadge">
// postoji u sidebaru na svih 5 operater stranica, pa se ovaj skript učitava svuda tamo.
// GET /letovi operateru vraća samo njegove letove (LetoviController.GetAll), pa nije
// potrebno dodatno filtriranje po vlasniku.
document.addEventListener('DOMContentLoaded', async () => {
    const badge = document.getElementById('activeWarningsBadge');
    if (!badge) return;

    try {
        const flights = await apiFetch('/letovi');
        const unacknowledgedWarnings = flights.filter(f => f.warning && !f.warningAcknowledged).length;
        const unacknowledgedRejections = flights.filter(f => f.status === 'odbijen' && !f.rejectionAcknowledged).length;
        const count = unacknowledgedWarnings + unacknowledgedRejections;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.classList.add('visible');
        }
    } catch (err) {
        // Sidebar ne smije pući zbog ovoga - broj jednostavno ostaje sakriven.
        console.warn('Nije moguće učitati broj notifikacija za pregled:', err.message);
    }
});
