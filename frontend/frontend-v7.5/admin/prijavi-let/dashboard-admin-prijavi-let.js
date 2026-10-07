document.addEventListener('DOMContentLoaded', async () => {

    const form = document.getElementById('createFlightForm');
    const formError = document.getElementById('formError');
    const droneHint = document.getElementById('droneHint');
    const lokacijaInput = document.getElementById('lokacija');
    const flightDateTimeInput = document.getElementById('flightDateTime');
    const trajanjeInput = document.getElementById('trajanje');
    const statusSelect = document.getElementById('status');
    const napomenaInput = document.getElementById('napomena');

    const droneGroup = document.getElementById('droneGroup');
    const flightDateTimeGroup = document.getElementById('flightDateTimeGroup');

    let operateri = [];
    let currentUserId = null;
    let dronovi = [];

    try {
        const korisnici = await apiFetch('/korisnici');
        operateri = korisnici.filter(k => k.role === 'operater');
        const me = korisnici.find(k => k.userName === sessionStorage.getItem('username'));
        currentUserId = me ? me.id : null;
    } catch (err) {
        console.warn('Nije moguće učitati operatere:', err.message);
    }

    try {
        dronovi = await apiFetch('/dronovi');
    } catch (err) {
        console.warn('Nije moguće učitati dronove:', err.message);
    }

    function operatorFullName(op) {
        return op.firstName + ' ' + op.lastName;
    }

    function droneLabel(d) {
        return d.name + ' (' + d.model + ')';
    }

    // ===== DRON - SVEDEN SAMO NA ONE DODIJELJENE ODABRANOM OPERATERU =====
    // Isto pravilo kao na operater/prijavi-let (operater tamo vidi samo svoje dronove,
    // kroz role-based filter na /dronovi) - ovdje ADMIN bira operatera, pa se lista dronova
    // svodi na Drone.OperatorId == odabrani operater. Kad je polje "Operater" prazno, let
    // ide na administratorov nalog, pa se prikazuju dronovi dodijeljeni NJEMU (ista logika,
    // ne izuzetak) - ako administrator nema nijedan dodijeljen dron, lista je prazna i to je
    // ocekivano (vidi droneHint), ne biramo proizvoljno "svi dronovi" da ne podmetnemo let
    // na tudju letjelicu.
    const droneAutocomplete = initAutocomplete({
        searchInput: document.getElementById('droneSearch'),
        hiddenInput: document.getElementById('drone'),
        suggestionsList: document.getElementById('droneSuggestions'),
        items: [],
        getLabel: droneLabel,
        getId: d => d.id,
        onSelect: () => droneGroup.classList.remove('error'),
        onClear: () => {}
    });

    function updateDroneOptions(operatorId) {
        const filtered = dronovi.filter(d => d.operatorId === operatorId);
        droneAutocomplete.setItems(filtered);
        droneAutocomplete.setValue(null);
        droneHint.style.display = filtered.length === 0 ? 'block' : 'none';
    }

    const operatorAutocomplete = initAutocomplete({
        searchInput: document.getElementById('operatorSearch'),
        hiddenInput: document.getElementById('operator'),
        suggestionsList: document.getElementById('operatorSuggestions'),
        items: operateri,
        getLabel: operatorFullName,
        getId: op => op.id,
        onSelect: op => updateDroneOptions(op.id),
        onClear: () => updateDroneOptions(currentUserId)
    });

    updateDroneOptions(currentUserId);

    droneGroup.addEventListener('focusin', () => droneGroup.classList.remove('error'));
    flightDateTimeInput.addEventListener('input', () => flightDateTimeGroup.classList.remove('error'));

    // ===== SUBMIT – PRIJAVI LET =====
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';
        droneGroup.classList.remove('error');
        flightDateTimeGroup.classList.remove('error');

        const droneId = document.getElementById('drone').value;
        const operatorId = document.getElementById('operator').value;

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
        submitBtn.textContent = 'Prijavljivanje...';

        const payload = {
            droneId: parseInt(droneId, 10),
            operatorId: operatorId ? parseInt(operatorId, 10) : null,
            location: lokacijaInput.value.trim() || null,
            flightDateTime: new Date(flightDateTimeInput.value).toISOString(),
            durationMinutes: trajanjeInput.value ? parseInt(trajanjeInput.value, 10) : null,
            status: statusSelect.value,
            note: napomenaInput.value.trim() || null
        };

        try {
            await apiFetch('/letovi', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            window.location.href = '../letovi/dashboard-admin-letovi.html';
        } catch (err) {
            formError.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Prijavi let';
        }
    });

    flightDateTimeInput.value = (() => {
        const d = new Date();
        const pad = n => n < 10 ? '0' + n : '' + n;
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    })();
});
