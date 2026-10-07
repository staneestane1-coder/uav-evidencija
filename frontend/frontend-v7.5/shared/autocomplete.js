/* =====================================================
   ZAJEDNICKA "KUCAJ I BIRAJ" AUTOCOMPLETE KOMPONENTA
   -----------------------------------------------------
   Koristi se svugdje gdje se bira JEDAN entitet (operater/dron) iz potencijalno
   duge/nepoznate liste - za razliku od <select>, koji ostaje rezervisan za mala,
   fiksna polja (npr. Status). Isti obrazac ranije ponavljan rucno na vise mjesta
   (dodaj-dron, karta filter, prijavi-let) - ovdje objedinjen da ponasanje ostane
   bit-za-bit identicno svugdje gdje se koristi.

   Trazi <ul class="autocomplete-list"> i tekstualni input unutar
   ".autocomplete-wrapper" (stilovi u admin/dodaj-dron/dashboard-admin-dodaj-dron.css).

   config:
     searchInput     - vidljivi tekstualni <input>
     hiddenInput      - skriveni <input type="hidden"> koji nosi stvarni ID
     suggestionsList  - <ul> u koji se upisuju prijedlozi
     items            - pocetni niz stavki (moze se kasnije promijeniti sa setItems)
     getLabel(item)   - tekst koji se prikazuje i po kojem se pretrazuje
     getId(item)      - vrijednost koja ide u hiddenInput
     onSelect(item)   - poziva se kad je stavka odabrana (klikom ili tacnim tekstom pri blur-u)
     onClear()        - poziva se kad polje ostane prazno/neprepoznato
   ===================================================== */
function initAutocomplete(config) {
    var items = config.items || [];

    function renderSuggestions(query) {
        var q = query.trim().toLowerCase();

        config.suggestionsList.innerHTML = '';
        // Prazan upit ne prikazuje kompletnu listu (suvisno prije nego korisnik
        // uopste pocne kucati) - prijedlozi se pojavljuju tek na prvo slovo.
        if (q === '') {
            config.suggestionsList.classList.remove('visible');
            return;
        }

        var matches = items.filter(function (item) {
            return config.getLabel(item).toLowerCase().indexOf(q) !== -1;
        });
        if (matches.length === 0) {
            config.suggestionsList.classList.remove('visible');
            return;
        }

        matches.forEach(function (item) {
            var li = document.createElement('li');
            li.textContent = config.getLabel(item);
            // mousedown (ne click) - izvrsava se PRIJE blur eventa na inputu, inace bi
            // blur stigao prvi i sakrio listu prije nego se klik na stavku registruje.
            li.addEventListener('mousedown', function (e) {
                e.preventDefault();
                config.searchInput.value = config.getLabel(item);
                config.hiddenInput.value = config.getId(item);
                config.suggestionsList.classList.remove('visible');
                if (config.onSelect) config.onSelect(item);
            });
            config.suggestionsList.appendChild(li);
        });
        config.suggestionsList.classList.add('visible');
    }

    config.searchInput.addEventListener('input', function () {
        config.hiddenInput.value = '';
        renderSuggestions(config.searchInput.value);
    });

    config.searchInput.addEventListener('focus', function () {
        renderSuggestions(config.searchInput.value);
    });

    config.searchInput.addEventListener('blur', function () {
        // Da klik na prijedlog (mousedown handler iznad) stigne prije ovoga.
        setTimeout(function () {
            config.suggestionsList.classList.remove('visible');
            var typed = config.searchInput.value.trim();
            if (typed === '') {
                config.hiddenInput.value = '';
                if (config.onClear) config.onClear();
                return;
            }
            var match = items.filter(function (item) { return config.getLabel(item) === typed; })[0];
            if (match) {
                config.hiddenInput.value = config.getId(match);
                if (config.onSelect) config.onSelect(match);
            } else {
                // Otkucano ime ne postoji medju ponudjenim stavkama - ne dozvoljavamo
                // proizvoljan unos, polje se prazni.
                config.searchInput.value = '';
                config.hiddenInput.value = '';
                if (config.onClear) config.onClear();
            }
        }, 150);
    });

    return {
        // Mijenja skup stavki iz kojih se predlaze (npr. dronovi filtrirani po
        // novoodabranom operateru) - ne dira trenutnu vrijednost polja.
        setItems: function (newItems) { items = newItems; },
        // Postavlja pocetnu/postojecu vrijednost (npr. pri ucitavanju forme za izmjenu).
        setValue: function (item) {
            if (item) {
                config.searchInput.value = config.getLabel(item);
                config.hiddenInput.value = config.getId(item);
            } else {
                config.searchInput.value = '';
                config.hiddenInput.value = '';
            }
        }
    };
}
