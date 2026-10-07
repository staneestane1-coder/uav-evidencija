using System.Text.RegularExpressions;

namespace DronBackend.Util
{
    // Minimalna politika jačine lozinke. Provjerava se i na frontend-u (shared/password-policy.js)
    // radi bolje korisničke iskustva, ali PRAVA provjera - ona koju se ne može zaobići - mora postojati
    // ovdje na backend-u, jer frontend validacija sama po sebi ne sprječava npr. direktan poziv API-ja.
    public static class PasswordPolicy
    {
        public const int MinLength = 8;

        // Gornja granica dužine - bez nje bi neko mogao poslati ekstremno dugačak string kao
        // lozinku, što nepotrebno opterećuje PBKDF2 heširanje (blaga DoS površina po zahtjevu).
        public const int MaxLength = 128;

        public static bool IsValid(string? password, out string error)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                error = "Lozinka je obavezna.";
                return false;
            }

            if (password.Length < MinLength)
            {
                error = $"Lozinka mora imati najmanje {MinLength} karaktera.";
                return false;
            }

            if (password.Length > MaxLength)
            {
                error = $"Lozinka ne smije imati više od {MaxLength} karaktera.";
                return false;
            }

            if (!Regex.IsMatch(password, "[A-Za-z]"))
            {
                error = "Lozinka mora sadržavati bar jedno slovo.";
                return false;
            }

            if (!Regex.IsMatch(password, "[0-9]"))
            {
                error = "Lozinka mora sadržavati bar jedan broj.";
                return false;
            }

            error = string.Empty;
            return true;
        }
    }
}
