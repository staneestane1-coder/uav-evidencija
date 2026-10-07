document.addEventListener('DOMContentLoaded', async () => {

    const form = document.getElementById('addDroneForm');
    const formError = document.getElementById('formError');

    // ===== FOTOGRAFIJA DRONA (odvojena od opšte dokumentacije - vidi se odmah na kartici) =====
    const dronePhotoInput = document.getElementById('dronePhotoInput');
    const dronePhotoPreview = document.getElementById('dronePhotoPreview');
    let dronePhotoFile = null;

    function renderDronePhotoPreview() {
        if (dronePhotoFile) {
            const url = URL.createObjectURL(dronePhotoFile);
            dronePhotoPreview.classList.remove('empty');
            dronePhotoPreview.innerHTML = `
                <img src="${url}" alt="Fotografija drona">
                <div class="drone-photo-actions">
                    <button type="button" class="icon-btn" id="dronePhotoChangeBtn" title="Promijeni fotografiju" aria-label="Promijeni fotografiju">✎</button>
                    <button type="button" class="icon-btn danger" id="dronePhotoRemoveBtn" title="Ukloni fotografiju" aria-label="Ukloni fotografiju">🗑</button>
                </div>`;
            dronePhotoPreview.querySelector('#dronePhotoChangeBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                dronePhotoInput.click();
            });
            dronePhotoPreview.querySelector('#dronePhotoRemoveBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                dronePhotoFile = null;
                dronePhotoInput.value = '';
                renderDronePhotoPreview();
            });
        } else {
            dronePhotoPreview.classList.add('empty');
            dronePhotoPreview.innerHTML = '<div class="drone-photo-placeholder">🛰</div>';
        }
    }

    dronePhotoPreview.addEventListener('click', () => {
        if (!dronePhotoFile) dronePhotoInput.click();
    });

    dronePhotoInput.addEventListener('change', () => {
        if (dronePhotoInput.files && dronePhotoInput.files[0]) {
            dronePhotoFile = dronePhotoInput.files[0];
            renderDronePhotoPreview();
        }
    });

    // ===== OPERATER - POLJE ZA KUCANJE SA PRIJEDLOZIMA (autocomplete) =====
    // Umjesto padajuce liste, korisnik kuca ime - ali se prihvata SAMO ime koje se
    // tacno poklapa sa postojecim operaterom (isto pravilo koje backend vec provjerava
    // u DronoviController - vidi komentar "&& u.Role == operater"). #operator (hidden)
    // nosi stvarni ID koji se salje na backend; #operatorSearch je ono sto korisnik vidi/kuca.
    const operatorSearchInput = document.getElementById('operatorSearch');
    const operatorIdInput = document.getElementById('operator');
    const operatorSuggestions = document.getElementById('operatorSuggestions');
    let operateri = [];

    try {
        const korisnici = await apiFetch('/korisnici');
        operateri = korisnici.filter(k => k.role === 'operater');
    } catch (err) {
        console.warn('Nije moguće učitati operatere:', err.message);
    }

    function operatorFullName(op) {
        return op.firstName + ' ' + op.lastName;
    }

    function renderOperatorSuggestions(query) {
        const q = query.trim().toLowerCase();

        operatorSuggestions.innerHTML = '';
        // Prazan upit ne prikazuje kompletnu listu operatera (suvisno prije nego
        // korisnik uopste pocne kucati) - prijedlozi se pojavljuju tek na prvo slovo.
        if (q === '') {
            operatorSuggestions.classList.remove('visible');
            return;
        }

        const matches = operateri.filter(op => operatorFullName(op).toLowerCase().includes(q));
        if (matches.length === 0) {
            operatorSuggestions.classList.remove('visible');
            return;
        }

        matches.forEach(op => {
            const li = document.createElement('li');
            li.textContent = operatorFullName(op);
            // mousedown (ne click) - izvrsava se PRIJE blur eventa na inputu, inace bi
            // blur stigao prvi i sakrio listu prije nego se klik na stavku registruje.
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                operatorSearchInput.value = operatorFullName(op);
                operatorIdInput.value = op.id;
                operatorSuggestions.classList.remove('visible');
            });
            operatorSuggestions.appendChild(li);
        });
        operatorSuggestions.classList.add('visible');
    }

    operatorSearchInput.addEventListener('input', () => {
        operatorIdInput.value = ''; // ponistava dok se ponovo ne odabere validno ime
        renderOperatorSuggestions(operatorSearchInput.value);
    });

    operatorSearchInput.addEventListener('focus', () => renderOperatorSuggestions(operatorSearchInput.value));

    operatorSearchInput.addEventListener('blur', () => {
        // Da klik na prijedlog (mousedown handler iznad) stigne prije ovoga.
        setTimeout(() => {
            operatorSuggestions.classList.remove('visible');
            const typed = operatorSearchInput.value.trim();
            const match = operateri.find(op => operatorFullName(op) === typed);
            if (match) {
                operatorIdInput.value = match.id;
            } else {
                // Otkucano ime ne postoji medju operaterima - ne dozvoljavamo
                // proizvoljan/izmisljen unos, polje se prazni.
                operatorSearchInput.value = '';
                operatorIdInput.value = '';
            }
        }, 150);
    });

    // ===== SUBMIT – DODAJ DRON =====
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
            const createdDrone = await apiFetch('/dronovi', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Fotografija drona ide u ZASEBAN, RANIJI poziv (prije opšte dokumentacije) da bi
            // njen uploadedAt pouzdano bio najraniji - kartica drona uzima najraniju sliku kao cover.
            if (dronePhotoFile) {
                const photoData = new FormData();
                photoData.append('files', dronePhotoFile);
                try {
                    await apiFetch('/snimci/dron/' + createdDrone.id, {
                        method: 'POST',
                        body: photoData
                    });
                } catch (photoErr) {
                    alert('Dron je sačuvan, ali otpremanje fotografije nije uspjelo: ' + photoErr.message +
                        '\n\nFotografiju možete naknadno dodati preko dugmeta „📎" na kartici.');
                }
            }

            const files = window.UploadWidget.getFiles('upload-newDrone');
            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(file => formData.append('files', file));
                try {
                    await apiFetch('/snimci/dron/' + createdDrone.id, {
                        method: 'POST',
                        body: formData
                    });
                } catch (uploadErr) {
                    // Dron je uspješno sačuvan - greška pri otpremanju dokumentacije se javlja
                    // odvojeno da ne bi ostavila korisnika u nejasnoj situaciji. Prikazano
                    // vidljivo (ne samo u konzoli) da administrator zna da dokumentaciju treba
                    // naknadno dodati (vidi izvještaj testiranja, nalaz #4).
                    alert('Dron je sačuvan, ali otpremanje dokumentacije nije uspjelo: ' + uploadErr.message +
                        '\n\nDokumentaciju možete naknadno dodati preko dugmeta „📎“ na listi dronova.');
                }
            }

            window.location.href = '../dronovi/dashboard-admin-dronovi.html';
        } catch (err) {
            formError.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sačuvaj dron';
        }
    });
});
