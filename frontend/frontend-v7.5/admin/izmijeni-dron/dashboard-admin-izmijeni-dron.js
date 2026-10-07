document.addEventListener('DOMContentLoaded', async () => {

    const form = document.getElementById('editDroneForm');
    const formError = document.getElementById('formError');

    // Dron se ucitava SVJEZ sa servera po ID-u iz URL-a (isti obrazac kao izmijeni-korisnika),
    // ne iz "snapshot-a" sacuvanog na listi - zastarjeli snapshot bi mogao prepisati tudju
    // medjuvremenu izmjenu (vidi izvjestaj testiranja, nalaz #10).
    const params = new URLSearchParams(window.location.search);
    const droneId = params.get('id');
    if (!droneId) {
        window.location.href = '../dronovi/dashboard-admin-dronovi.html';
        return;
    }

    let drone;
    try {
        drone = await apiFetch('/dronovi/' + droneId);
    } catch (err) {
        formError.textContent = 'Greška pri učitavanju drona: ' + err.message;
        form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
        return;
    }

    // ===== OPERATER - kucaj i biraj (isti obrazac kao svugdje drugdje) =====
    let operateri = [];
    try {
        const korisnici = await apiFetch('/korisnici');
        operateri = korisnici.filter(k => k.role === 'operater');
    } catch (err) {
        console.warn('Nije moguće učitati operatere:', err.message);
    }

    const operatorAutocomplete = initAutocomplete({
        searchInput: document.getElementById('operatorSearch'),
        hiddenInput: document.getElementById('operator'),
        suggestionsList: document.getElementById('operatorSuggestions'),
        items: operateri,
        getLabel: op => op.firstName + ' ' + op.lastName,
        getId: op => op.id
    });

    // ===== POPUNI FORMU =====
    document.getElementById('droneName').value = drone.name || '';
    document.getElementById('droneModel').value = drone.model || '';
    document.getElementById('manufacturer').value = drone.manufacturer || '';
    document.getElementById('serialNumber').value = drone.serialNumber || '';
    document.getElementById('status').value = drone.status || 'aktivan';
    document.getElementById('notes').value = drone.notes || '';
    if (drone.operatorId) {
        const currentOperator = operateri.find(op => op.id === drone.operatorId);
        operatorAutocomplete.setValue(currentOperator || null);
    }

    // ===== SUBMIT – IZMIJENI DRON =====
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Čuvanje...';

        const operatorValue = document.getElementById('operator').value;

        const payload = {
            name: document.getElementById('droneName').value.trim(),
            model: document.getElementById('droneModel').value.trim(),
            manufacturer: document.getElementById('manufacturer').value.trim(),
            serialNumber: document.getElementById('serialNumber').value.trim(),
            operatorId: operatorValue ? parseInt(operatorValue) : null,
            status: document.getElementById('status').value,
            notes: document.getElementById('notes').value.trim()
        };

        try {
            await apiFetch(`/dronovi/${drone.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            window.location.href = '../dronovi/dashboard-admin-dronovi.html';
        } catch (err) {
            formError.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sačuvaj izmjene';
        }
    });
});
