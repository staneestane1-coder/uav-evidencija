using Data.EF;
using Data.EF.Models;
using DronBackend.Dto;
using DronBackend.Services;
using DronBackend.Util;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace DronBackend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;
        private readonly PasswordHasher<User> _passwordHasher;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            AppDbContext appDbContext,
            PasswordHasher<User> passwordHasher,
            IConfiguration configuration,
            IEmailService emailService,
            ILogger<AuthController> logger)
        {
            _appDbContext = appDbContext;
            _passwordHasher = passwordHasher;
            _configuration = configuration;
            _emailService = emailService;
            _logger = logger;
        }

        // Rok trajanja reset linka - vidi ForgotPassword/ResetPassword.
        private static readonly TimeSpan PasswordResetTokenLifetime = TimeSpan.FromHours(1);

        // Nakon ovoliko neuspješnih pokušaja zaredom, nalog se privremeno blokira.
        private const int MaxFailedAttempts = 5;
        private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

        // Unaprijed izračunat hash "lažne" lozinke - koristi se kad korisničko ime ne postoji,
        // da bismo ipak izvršili PBKDF2 verifikaciju iste složenosti kao za stvarnog korisnika
        // (vidi ispod). Bez ovoga je odgovor za nepostojeće korisničko ime primjetno brži nego
        // za pogrešnu lozinku postojećeg naloga - timing side-channel koji otkriva koja
        // korisnička imena postoje u sistemu, i pored identične poruke greške (vidi izvjestaj
        // testiranja, nalaz #8).
        private static readonly string DummyPasswordHash =
            new PasswordHasher<User>().HashPassword(new User(), "Dummy-Password-Za-Ujednacavanje-Vremena-Odgovora");

        [HttpPost("login")]
        [EnableRateLimiting("login")]
        public async Task<IActionResult> Login(LoginRequest loginRequest)
        {
            if (string.IsNullOrWhiteSpace(loginRequest.UserName)
                || string.IsNullOrWhiteSpace(loginRequest.Password))
            {
                return BadRequest(new { message = "Sva polja su obavezna" });
            }

            var userName = loginRequest.UserName.Trim();

            var user = await _appDbContext.Users.SingleOrDefaultAsync(x => x.UserName == userName);
            if (user is null)
            {
                // Izvrši "lažnu" verifikaciju iste složenosti kao za stvarnog korisnika (vidi
                // DummyPasswordHash iznad) - ne otkrivamo da korisničko ime ne postoji, ni kroz
                // poruku (ista kao za pogrešnu lozinku) ni kroz vrijeme odgovora.
                _passwordHasher.VerifyHashedPassword(new User(), DummyPasswordHash, loginRequest.Password);
                return Unauthorized(new { message = "Pogrešno korisničko ime ili lozinka" });
            }

            // Nalog je privremeno zaključan zbog previše neuspješnih pokušaja prijave (brute-force zaštita).
            if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
            {
                var preostaloMinuta = Math.Ceiling((user.LockedUntil.Value - DateTime.UtcNow).TotalMinutes);
                return StatusCode(423, new
                {
                    message = $"Nalog je privremeno zaključan zbog više neuspješnih pokušaja prijave. " +
                               $"Pokušajte ponovo za oko {preostaloMinuta} minuta."
                });
            }

            if (user.Status != "aktivan")
            {
                return Unauthorized(new { message = "Nalog je deaktiviran. Obratite se administratoru." });
            }

            var verify = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, loginRequest.Password);
            if (verify == PasswordVerificationResult.Failed)
            {
                user.FailedLoginAttempts += 1;

                if (user.FailedLoginAttempts >= MaxFailedAttempts)
                {
                    user.LockedUntil = DateTime.UtcNow.Add(LockoutDuration);
                    user.FailedLoginAttempts = 0;
                    await _appDbContext.SaveChangesAsync();

                    await ActivityLogger.LogAsync(_appDbContext, user, "sigurnost", "Nalog zaključan (previše neuspješnih prijava)", null, "greska");
                    return StatusCode(423, new
                    {
                        message = $"Nalog je zaključan na {LockoutDuration.TotalMinutes} minuta zbog previše neuspješnih pokušaja prijave."
                    });
                }

                await _appDbContext.SaveChangesAsync();
                await ActivityLogger.LogAsync(_appDbContext, user, "sigurnost", "Neuspješan pokušaj prijave", null, "greska");
                return Unauthorized(new { message = "Pogrešno korisničko ime ili lozinka" });
            }

            // Uspješna prijava - resetuj brojač neuspjelih pokušaja i eventualno zaključavanje.
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;
            await _appDbContext.SaveChangesAsync();

            var token = JwtTokenHelper.GenerateToken(user, _configuration);

            await ActivityLogger.LogAsync(_appDbContext, user, "sigurnost", "Prijava na sistem", null, "uspjesno");

            return Ok(new
            {
                token,
                userName = user.UserName,
                displayName = $"{user.FirstName} {user.LastName}",
                role = user.Role
            });
        }

        // Samostalna promjena SOPSTVENE lozinke - dostupna svakoj ulozi (administrator,
        // kontrola_leta, operater), za razliku od KorisniciController.Update gdje SAMO
        // administrator moze promijeniti lozinku DRUGOM korisniku. Zahtijeva poznavanje
        // trenutne lozinke (za razliku od admin-ovog resetovanja) - sesija sama po sebi
        // ne bi trebala biti dovoljna da neko ko je nakratko dosao do otkljucanog racunara
        // preuzme trajni pristup nalogu mijenjajuci lozinku bez da je zna.
        [HttpPut("lozinka")]
        [Authorize]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userIdClaim is null || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var user = await _appDbContext.Users.FindAsync(userId);
            if (user is null) return Unauthorized();

            var verify = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
            if (verify == PasswordVerificationResult.Failed)
                return BadRequest(new { message = "Trenutna lozinka nije ispravna." });

            if (!DronBackend.Util.PasswordPolicy.IsValid(request.NewPassword, out var passwordError))
                return BadRequest(new { message = passwordError });

            user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
            user.PasswordChangedAt = DateTime.UtcNow;
            await _appDbContext.SaveChangesAsync();

            // Ovo odmah ponistava trenutni JWT (vidi Program.cs OnTokenValidated, nalaz #7) -
            // frontend nakon ovog poziva mora korisnika odjaviti i vratiti na login.
            await ActivityLogger.LogAsync(_appDbContext, User, "sigurnost", "Samostalno promijenjena lozinka", null, "uspjesno");

            return Ok(new { message = "Lozinka je uspješno promijenjena. Molimo prijavite se ponovo." });
        }

        // "Zaboravljena lozinka" - korak 1. Dostupno bez prijave (anoniman korisnik po definiciji
        // nema token). Namjerno UVIJEK vraća isti generički odgovor, bez obzira da li email
        // postoji u bazi - isti princip kao DummyPasswordHash u Login: ne otkrivamo koji emailovi
        // su registrovani u sistemu. Iz istog razloga se generička poruka vraća i ako slanje
        // emaila samo po sebi pukne (npr. SMTP privremeno nedostupan) - greška se samo loguje
        // server-side (vidi _logger.LogError ispod), nikad klijentu.
        [HttpPost("forgot-password")]
        [EnableRateLimiting("password-reset")]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
        {
            const string genericResponse = "Ako podaci odgovaraju postojećem nalogu, poslat je email sa uputstvima za reset lozinke.";

            if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new { message = "Korisničko ime i email su obavezni." });

            var userName = request.UserName.Trim();
            var email = request.Email.Trim();
            var user = await _appDbContext.Users.SingleOrDefaultAsync(x => x.UserName == userName);

            // Link se šalje SAMO ako se uneseni email poklapa sa emailom BAŠ TOG korisničkog
            // imena - nije dovoljno pogoditi/znati samo email (npr. iz nekog curenja podataka
            // van sistema), mora se znati i tačno korisničko ime uz koje taj email ide u OVOM
            // sistemu. Deaktiviran nalog i dalje ne dobija reset link (isto kao sto ne moze ni
            // da se uloguje - vidi Login), ali odgovor ostaje isti generički u svim slucajevima
            // (pogresno korisnicko ime, pogresan email, neaktivan nalog) da se ne otkrije ni
            // postojanje naloga ni njegov status.
            if (user != null && user.Status == "aktivan" && string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                var token = GenerateSecureToken();
                user.PasswordResetToken = token;
                user.PasswordResetTokenExpiry = DateTime.UtcNow.Add(PasswordResetTokenLifetime);
                await _appDbContext.SaveChangesAsync();

                // Loguje se ODMAH nakon što je token upisan u bazu (zahtjev je stvarno nastao),
                // NE unutar try/catch za slanje emaila ispod - u suprotnom bi neuspješno slanje
                // (npr. SMTP privremeno nedostupan) tiho izbrisalo trag da je reset uopšte
                // zatražen, iako token stvarno postoji u bazi i i dalje je upotrebljiv.
                await ActivityLogger.LogAsync(_appDbContext, user, "sigurnost", "Zatražen reset lozinke (zaboravljena lozinka)", null, "novo");

                var resetBaseUrl = _configuration["Frontend:ResetPasswordUrl"];
                var resetLink = $"{resetBaseUrl}?token={Uri.EscapeDataString(token)}";

                try
                {
                    await _emailService.SendPasswordResetEmailAsync(user.Email, $"{user.FirstName} {user.LastName}", resetLink);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Slanje emaila za reset lozinke nije uspjelo za korisnika {UserId}", user.Id);
                }
            }

            return Ok(new { message = genericResponse });
        }

        // "Zaboravljena lozinka" - korak 2. Postavlja novu lozinku na osnovu tokena iz emaila.
        // Dostupno bez prijave - token sam po sebi (dovoljno dugačak, jednokratan, sa rokom od
        // 1h) igra ulogu autentifikacije za ovu radnju.
        [HttpPost("reset-password")]
        [EnableRateLimiting("password-reset")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Token))
                return BadRequest(new { message = "Nevažeći ili istekao link za reset lozinke. Zatražite novi." });

            var user = await _appDbContext.Users.SingleOrDefaultAsync(x => x.PasswordResetToken == request.Token);
            if (user is null || user.PasswordResetTokenExpiry is null || user.PasswordResetTokenExpiry < DateTime.UtcNow)
                return BadRequest(new { message = "Nevažeći ili istekao link za reset lozinke. Zatražite novi." });

            if (!DronBackend.Util.PasswordPolicy.IsValid(request.NewPassword, out var passwordError))
                return BadRequest(new { message = passwordError });

            user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
            user.PasswordChangedAt = DateTime.UtcNow;
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiry = null;

            // Isto kao kod admin-ovog resetovanja tuđe lozinke (KorisniciController.Update) -
            // uspješan reset odmah otklanja eventualno automatsko zaključavanje naloga, umjesto
            // da korisnik čeka da ono isteknе i pored toga što je upravo dokazao vlasništvo
            // nad nalogom (preko emaila).
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;

            await _appDbContext.SaveChangesAsync();

            await ActivityLogger.LogAsync(_appDbContext, user, "sigurnost", "Lozinka resetovana putem linka poslatog na email", null, "uspjesno");

            return Ok(new { message = "Lozinka je uspješno promijenjena. Sada se možete prijaviti novom lozinkom." });
        }

        // Kriptografski siguran, nasumičan token (256 bita entropije) - jači garantovano nego
        // Guid.NewGuid() (koji nije dokumentovano CSPRNG na svim platformama), a i dalje
        // jednostavan string pogodan za URL query parametar (hex, bez posebnih karaktera).
        private static string GenerateSecureToken()
        {
            return Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        }
    }
}
