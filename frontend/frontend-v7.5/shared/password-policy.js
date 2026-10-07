/* =====================================================
   Validacija jačine lozinke (frontend).
   NAPOMENA: ovo je samo za bolje korisničko iskustvo (odmah
   javi grešku bez čekanja na server). Prava provjera - ona
   koja se ne može zaobići - postoji na backend-u
   (DronBackend/Util/PasswordPolicy.cs) i mora ostati ISTA
   kao ovo pravilo, jer frontend provjera sama po sebi ne
   sprječava direktan poziv API-ja.
   ===================================================== */
window.PasswordPolicy = {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,

    // Vraća null ako je lozinka OK, ili poruku greške ako nije.
    validate: function (password) {
        if (!password) {
            return 'Lozinka je obavezna.';
        }
        if (password.length < this.MIN_LENGTH) {
            return 'Lozinka mora imati najmanje ' + this.MIN_LENGTH + ' karaktera.';
        }
        if (password.length > this.MAX_LENGTH) {
            return 'Lozinka ne smije imati više od ' + this.MAX_LENGTH + ' karaktera.';
        }
        if (!/[A-Za-z]/.test(password)) {
            return 'Lozinka mora sadržavati bar jedno slovo.';
        }
        if (!/[0-9]/.test(password)) {
            return 'Lozinka mora sadržavati bar jedan broj.';
        }
        return null;
    }
};
