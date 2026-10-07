document.addEventListener('DOMContentLoaded', function () {

    var drones = [];

    var droneSearchInput = document.getElementById('droneSearch');
    var droneIdInput = document.getElementById('drone');
    var lokacijaInput = document.getElementById('lokacija');
    var trajanjeInput = document.getElementById('trajanje');
    var napomenaInput = document.getElementById('napomena');
    var formError = document.getElementById('formError');
    var form = document.getElementById('letForm');
    var submitBtn = document.getElementById('submitBtn');
    var toast = document.getElementById('successToast');
    var toastText = document.getElementById('toastText');

    var futureDateTimeGroup = document.getElementById('futureDateTimeGroup');
    var futureDateTimeInput = document.getElementById('futureDateTime');

    var summaryDrone = document.getElementById('summaryDrone');
    var summaryDate = document.getElementById('summaryDate');
    var summaryTime = document.getElementById('summaryTime');
    var summaryLocation = document.getElementById('summaryLocation');

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function formatDate(d) {
        return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + '.';
    }

    function formatTime(d) {
        return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function toDatetimeLocalValue(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function droneLabel(d) { return d.name + ' (' + d.model + ')'; }

    function updateSummaryDateTime() {
        if (futureDateTimeInput.value) {
            var chosen = new Date(futureDateTimeInput.value);
            summaryDate.textContent = formatDate(chosen);
            summaryTime.textContent = formatTime(chosen);
        } else {
            summaryDate.textContent = '—';
            summaryTime.textContent = '—';
        }
    }

    function getSelectedDrone() {
        var id = droneIdInput.value;
        return drones.filter(function (d) { return String(d.id) === id; })[0];
    }

    function updateSummary() {
        var drone = getSelectedDrone();
        summaryDrone.textContent = drone ? drone.name : '—';
        summaryLocation.textContent = lokacijaInput.value.trim() || 'Niste unijeli';
    }

    function showError(message) {
        formError.textContent = message;
    }

    function clearError() {
        formError.textContent = '';
        document.getElementById('lokacijaGroup').classList.remove('error');
        futureDateTimeGroup.classList.remove('error');
    }

    function showToast(message) {
        toastText.textContent = message;
        toast.classList.add('show');
    }

    // Dron - polje za kucanje sa prijedlozima (isti obrazac kao svugdje drugdje u
    // aplikaciji). Lista prijedloga je vec svedena na operaterove dronove (backend
    // /dronovi vraca samo dodijeljene njemu - vidi DronoviController.GetAll).
    var droneAutocomplete = initAutocomplete({
        searchInput: droneSearchInput,
        hiddenInput: droneIdInput,
        suggestionsList: document.getElementById('droneSuggestions'),
        items: [],
        getLabel: droneLabel,
        getId: function (d) { return d.id; },
        onSelect: function () { updateSummary(); clearError(); },
        onClear: function () { updateSummary(); }
    });

    lokacijaInput.addEventListener('input', function () {
        updateSummary();
        clearError();
    });

    futureDateTimeInput.addEventListener('input', function () {
        futureDateTimeGroup.classList.remove('error');
        updateSummaryDateTime();
    });

    async function loadDrones() {
        try {
            drones = await apiFetch('/dronovi');
        } catch (err) {
            showError('Greška pri učitavanju dronova: ' + err.message);
            drones = [];
        }

        if (drones.length === 0) {
            droneSearchInput.placeholder = 'Nema dronova dodijeljenih vašem nalogu';
            droneSearchInput.disabled = true;
        } else {
            droneAutocomplete.setItems(drones);
            // Kad operater ima samo jedan dodijeljeni dron, unaprijed ga popuni (ista
            // pogodnost kao ranije - vecina operatera ima tacno jedan dron); sa vise
            // dronova ostaje prazno, operater kuca/bira zeljeni.
            if (drones.length === 1) {
                droneAutocomplete.setValue(drones[0]);
            }
        }
        updateSummary();
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearError();

        var lokacija = lokacijaInput.value.trim();
        var selectedDroneId = droneIdInput.value;

        if (!selectedDroneId) {
            showError('Molimo odaberite dron kojim je let izveden.');
            return;
        }

        if (!lokacija) {
            document.getElementById('lokacijaGroup').classList.add('error');
            lokacijaInput.focus();
            return;
        }

        var chosenDateTime = futureDateTimeInput.value ? new Date(futureDateTimeInput.value) : null;
        if (!chosenDateTime || chosenDateTime <= new Date()) {
            futureDateTimeGroup.classList.add('error');
            futureDateTimeInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Prijavljivanje...';

        var payload = {
            droneId: parseInt(selectedDroneId, 10),
            location: lokacija,
            flightDateTime: chosenDateTime.toISOString(),
            durationMinutes: trajanjeInput.value ? parseInt(trajanjeInput.value, 10) : null,
            status: 'planiran',
            note: napomenaInput.value.trim() || null
        };

        try {
            await apiFetch('/letovi', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            var drone = getSelectedDrone();

            showToast('Zahtjev za let (' + (drone ? drone.name : '') + ', ' + lokacija + ') je poslan na odobrenje Kontroli leta.');

            setTimeout(function () {
                window.location.href = '../dashboard-operater.html';
            }, 1200);
        } catch (err) {
            showError(err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Prijavi let';
        }
    });

    loadDrones();
    futureDateTimeInput.value = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    updateSummaryDateTime();
});
