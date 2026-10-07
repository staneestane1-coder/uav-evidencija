namespace DronBackend.Dto
{
    public class LoginRequest
    {
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    // Samostalna promjena SOPSTVENE lozinke (bilo koja uloga) - za razliku od
    // KorisniciController.Update, gdje administrator mijenja lozinku DRUGOM korisniku.
    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    // "Zaboravljena lozinka" - korak 1 (zahtjev za reset preko emaila). Vidi
    // AuthController.ForgotPassword. Trazi se i korisnicko ime, ne samo email - link
    // se salje SAMO ako uneseni email pripada bas tom korisnickom imenu (ne bilo kojem
    // nalogu u sistemu koji ima taj email, sto ovdje i tako ne bi bio slucaj jer je Email
    // jedinstven, ali princip je: ne dovoljno pogoditi samo email, mora se znati i uz koji
    // nalog ide).
    public class ForgotPasswordRequest
    {
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }

    // "Zaboravljena lozinka" - korak 2 (postavljanje nove lozinke pomoću tokena iz emaila).
    // Vidi AuthController.ResetPassword.
    public class ResetPasswordRequest
    {
        public string Token { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}
