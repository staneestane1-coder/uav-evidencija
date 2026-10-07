// Broj zahtjeva za let "na čekanju" na sidebar stavci "Letovi na čekanju" (kontrola uloga) -
// jedini vizuelni signal da postoji novi zahtjev, bez da kontrola sama otvori stranicu da
// provjeri. Isti <span id="pendingFlightsBadge"> postoji u sidebaru na svih 8 kontrola
// stranica (vidi kontrola/letovi-na-cekanju/), pa se ovaj skript učitava svuda tamo.
document.addEventListener('DOMContentLoaded', async () => {
    const badge = document.getElementById('pendingFlightsBadge');
    if (!badge) return;

    try {
        const flights = await apiFetch('/letovi');
        const count = flights.filter(f => f.status === 'na-cekanju').length;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.classList.add('visible');
        }
    } catch (err) {
        // Sidebar ne smije pući zbog ovoga - broj jednostavno ostaje sakriven.
        console.warn('Nije moguće učitati broj letova na čekanju:', err.message);
    }
});
