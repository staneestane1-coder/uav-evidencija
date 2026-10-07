document.addEventListener('DOMContentLoaded', async () => {

    const form = document.getElementById('editFlightForm');
    const formError = document.getElementById('formError');
    const operatorInput = document.getElementById('operator');
    const lokacijaInput = document.getElementById('lokacija');
    const flightDateTimeInput = document.getElementById('flightDateTime');
    const trajanjeInput = document.getElementById('trajanje');
    const statusSelect = document.getElementById('status');
    const napomenaInput = document.getElementById('napomena');
    const droneGroup = document.getElementById('droneGroup');

    // Let se ucitava SVJEZ sa servera po ID-u iz URL-a (isti obrazac kao izmijeni-korisnika/
    // izmijeni-dron), ne iz "snapshot-a" sacuvanog na listi (vidi izvjestaj testiranja, nalaz #10).
    const params = new URLSearchParams(window.location.search);
    const flightId = params.get('id');
    if (!flightId) {
        window.location.href = '../letovi/dashboard-admin-letovi.html';
        return;
    }

    let flight;
    try {
        flight = await apiFetch('/letovi/' + flightId);
    } catch (err) {
        formError.textContent = 'Greška pri učitavanju leta: ' + err.message;
        form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
        return;
    }

    // ISO string (UTC, npr. "2026-07-20T14:30:00Z") -> vrijednost za <input type="datetime-local">
    // u LOKALNOM vremenu korisnika (format "YYYY-MM-DDTHH:mm")
    function toDatetimeLocalValue(iso) {
        const d = new Date(iso);
        const pad = n => n < 10 ? '0' + n : '' + n;
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function droneLabel(d) {
        return d.name + ' (' + d.model + ')';
    }

    // ===== DRON - kucaj i biraj (isti obrazac kao svugdje drugdje) =====
    let dronovi = [];
    try {
        dronovi = await apiFetch('/dronovi');
    } catch (err) {
        console.warn('Nije moguće učitati dronove:', err.message);
    }

    const droneAutocomplete = initAutocomplete({
        searchInput: document.getElementById('droneSearch'),
        hiddenInput: document.getElementById('drone'),
        suggestionsList: document.getElementById('droneSuggestions'),
        items: dronovi,
        getLabel: droneLabel,
        getId: d => d.id,
        onSelect: () => droneGroup.classList.remove('error')
    });

    // ===== POPUNI FORMU =====
    const currentDrone = dronovi.find(d => d.id === flight.droneId);
    droneAutocomplete.setValue(currentDrone || null);
    operatorInput.value = flight.operatorName || '—';
    lokacijaInput.value = flight.location || '';
    flightDateTimeInput.value = toDatetimeLocalValue(flight.flightDateTime);
    trajanjeInput.value = flight.durationMinutes != null ? flight.durationMinutes : '';
    statusSelect.value = flight.status || 'planiran';
    napomenaInput.value = flight.note || '';

    // ===== SUBMIT – IZMIJENI LET =====
    const flightDateTimeGroup = document.getElementById('flightDateTimeGroup');
    flightDateTimeInput.addEventListener('input', () => flightDateTimeGroup.classList.remove('error'));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';
        droneGroup.classList.remove('error');
        flightDateTimeGroup.classList.remove('error');

        const droneId = document.getElementById('drone').value;

        if (!droneId) {
            droneGroup.classList.add('error');
            return;
        }
        if (!flightDateTimeInput.value) {
            flightDateTimeGroup.classList.add('error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Čuvanje...';

        // datetime-local vrijednost se tumači kao LOKALNO vrijeme; new Date(...) je ispravno
        // konvertuje, a toISOString() je pretvara u UTC - isti princip kao pri prijavi leta.
        const payload = {
            droneId: parseInt(droneId, 10),
            location: lokacijaInput.value.trim() || null,
            flightDateTime: new Date(flightDateTimeInput.value).toISOString(),
            durationMinutes: trajanjeInput.value ? parseInt(trajanjeInput.value, 10) : null,
            status: statusSelect.value,
            note: napomenaInput.value.trim() || null
        };

        try {
            await apiFetch(`/letovi/${flight.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            window.location.href = '../letovi/dashboard-admin-letovi.html';
        } catch (err) {
            formError.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sačuvaj izmjene';
        }
    });
});
