using Data.EF;
using Data.EF.Models;
using DronBackend.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace DronBackend.Controllers
{
    // Citanje liste korisnika: administrator i kontrola leta (potrebno za stranicu Operateri).
    // Kreiranje/izmjena/brisanje korisnika: samo administrator.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "administrator,kontrola_leta")]
    public class KorisniciController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly PasswordHasher<User> _passwordHasher;

        public KorisniciController(AppDbContext db, PasswordHasher<User> passwordHasher)
        {
            _db = db;
            _passwordHasher = passwordHasher;
        }

        private static UserResponse ToDto(User u) => new()
        {
            Id = u.Id,
            UserName = u.UserName,
            FirstName = u.FirstName,
            LastName = u.LastName,
            Email = u.Email,
            Role = u.Role,
            Status = u.Status
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserResponse>>> GetAll()
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            var query = _db.Users.AsQueryable();

            // Kontrola leta koristi ovu listu samo za stranicu "Operateri" - nema potrebe (ni ovlaštenja)
            // da vidi administratorske naloge ili naloge drugih članova kontrole leta.
            if (role == "kontrola_leta")
            {
                query = query.Where(u => u.Role == "operater");
            }

            var users = await query.OrderBy(u => u.FirstName).ToListAsync();
            return Ok(users.Select(ToDto));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<UserResponse>> GetById(int id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user is null) return NotFound(new { message = "Korisnik nije pronađen" });

            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role == "kontrola_leta" && user.Role != "operater")
                return Forbid();

            return Ok(ToDto(user));
        }

        [HttpPost]
        [Authorize(Roles = "administrator")]
        public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.Password)
                || string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName)
                || string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "Sva obavezna polja moraju biti popunjena" });
            }

            var allowedRoles = new[] { "administrator", "kontrola_leta", "operater" };
            if (!allowedRoles.Contains(request.Role))
                return BadRequest(new { message = "Nevažeća uloga" });

            if (!new EmailAddressAttribute().IsValid(request.Email))
                return BadRequest(new { message = "Email adresa nije ispravnog formata." });

            if (!DronBackend.Util.PasswordPolicy.IsValid(request.Password, out var passwordError))
                return BadRequest(new { message = passwordError });

            if (await _db.Users.AnyAsync(x => x.UserName == request.UserName))
                return BadRequest(new { message = "Korisničko ime već postoji" });

            if (await _db.Users.AnyAsync(x => x.Email == request.Email))
                return BadRequest(new { message = "Email već postoji" });

            var user = new User
            {
                UserName = request.UserName.Trim(),
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                Email = request.Email.Trim(),
                Role = request.Role,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "aktivan" : request.Status
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
            user.PasswordChangedAt = DateTime.UtcNow;

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "korisnik", "Kreiran korisnički nalog", $"{user.FirstName} {user.LastName}", "novo");

            return CreatedAtAction(nameof(GetById), new { id = user.Id }, ToDto(user));
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "administrator")]
        public async Task<IActionResult> Update(int id, UpdateUserRequest request)
        {
            var user = await _db.Users.FindAsync(id);
            if (user is null) return NotFound(new { message = "Korisnik nije pronađen" });

            // Ista obavezna polja kao kod Create - PUT ranije nije provjeravao prazne vrijednosti,
            // pa se moglo "izbrisati" ime/prezime/email admin naloga slanjem prazne vrijednosti.
            if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName)
                || string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "Ime, prezime i email su obavezni." });
            }

            if (!new EmailAddressAttribute().IsValid(request.Email))
                return BadRequest(new { message = "Email adresa nije ispravnog formata." });

            var allowedRoles = new[] { "administrator", "kontrola_leta", "operater" };
            if (string.IsNullOrWhiteSpace(request.Role) || !allowedRoles.Contains(request.Role))
                return BadRequest(new { message = "Nevažeća uloga." });

            var allowedStatuses = new[] { "aktivan", "neaktivan" };
            if (string.IsNullOrWhiteSpace(request.Status) || !allowedStatuses.Contains(request.Status))
                return BadRequest(new { message = "Nevažeći status naloga." });

            if (await _db.Users.AnyAsync(x => x.Email == request.Email && x.Id != id))
                return BadRequest(new { message = "Email već postoji" });

            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var willLoseAdminRole = !string.IsNullOrWhiteSpace(request.Role) && request.Role != "administrator";
            var willBeDeactivated = !string.IsNullOrWhiteSpace(request.Status) && request.Status != "aktivan";

            if (user.Role == "administrator" && (willLoseAdminRole || willBeDeactivated))
            {
                if (user.Id == currentUserId)
                    return BadRequest(new { message = "Ne možete sami sebi ukinuti administratorsku ulogu ili se deaktivirati." });

                var otherActiveAdmins = await _db.Users.CountAsync(
                    u => u.Id != user.Id && u.Role == "administrator" && u.Status == "aktivan");
                if (otherActiveAdmins == 0)
                    return BadRequest(new { message = "Ovo je posljednji aktivni administrator - ne može mu se ukinuti uloga niti se deaktivirati." });
            }

            user.FirstName = request.FirstName.Trim();
            user.LastName = request.LastName.Trim();
            user.Email = request.Email.Trim();
            if (!string.IsNullOrWhiteSpace(request.Role)) user.Role = request.Role;
            if (!string.IsNullOrWhiteSpace(request.Status)) user.Status = request.Status;

            // Svaka administratorska izmjena naloga odmah otklanja eventualno automatsko
            // zakljucavanje (vidi AuthController.Login - 5 neuspjelih pokusaja zakljucava nalog
            // na 15 minuta). Bez ovoga administrator nije imao NACIN da odmah vrati pristup
            // zakljucanom korisniku - morao je cekati da istekne vrijeme, cak i poslije
            // resetovanja lozinke (vidi izvjestaj testiranja, nalaz #3).
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;

            if (!string.IsNullOrWhiteSpace(request.NewPassword))
            {
                if (!DronBackend.Util.PasswordPolicy.IsValid(request.NewPassword, out var passwordError))
                    return BadRequest(new { message = passwordError });

                user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
                user.PasswordChangedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "korisnik", "Izmijenjen korisnički nalog", $"{user.FirstName} {user.LastName}", "novo");

            return Ok(ToDto(user));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrator")]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user is null) return NotFound(new { message = "Korisnik nije pronađen" });

            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (user.Id == currentUserId)
                return BadRequest(new { message = "Ne možete obrisati sopstveni nalog." });

            if (user.Role == "administrator")
            {
                var otherActiveAdmins = await _db.Users.CountAsync(
                    u => u.Id != user.Id && u.Role == "administrator" && u.Status == "aktivan");
                if (otherActiveAdmins == 0)
                    return BadRequest(new { message = "Ovo je posljednji administrator u sistemu i ne može biti obrisan." });
            }

            var fullName = $"{user.FirstName} {user.LastName}";

            _db.Users.Remove(user);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return BadRequest(new
                {
                    message = "Korisnik ima evidentirane letove i zbog toga ne može biti obrisan. " +
                               "Prebacite/obrišite njegove letove ili mu umjesto brisanja promijenite status na 'neaktivan'."
                });
            }

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "korisnik", "Obrisan korisnički nalog", fullName, "upozorenje");

            return NoContent();
        }
    }
}
