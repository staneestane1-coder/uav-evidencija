using Data.EF;
using Data.EF.Models;
using DronBackend.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DronBackend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // sve tri uloge mogu da vide dronove
    public class DronoviController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public DronoviController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        private static DroneResponse ToDto(Drone d) => new()
        {
            Id = d.Id,
            Name = d.Name,
            Model = d.Model,
            Manufacturer = d.Manufacturer,
            SerialNumber = d.SerialNumber,
            OperatorId = d.OperatorId,
            OperatorName = d.Operator != null ? $"{d.Operator.FirstName} {d.Operator.LastName}" : null,
            Status = d.Status,
            Notes = d.Notes,
            MediaFiles = d.MediaFiles.Select(m => new MediaResponse
            {
                Id = m.Id,
                FlightId = m.FlightId,
                DroneId = m.DroneId,
                FileName = m.FileName,
                Url = $"/api/snimci/{m.Id}/file", // fajl se sada servira kroz autentifikovanu rutu (vidi SnimciController)
                ContentType = m.ContentType,
                UploadedAt = m.UploadedAt
            }).ToList()
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DroneResponse>>> GetAll()
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            var query = _db.Drones.Include(d => d.Operator).Include(d => d.MediaFiles).AsQueryable();

            // operater vidi samo dronove koji su mu dodijeljeni
            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                query = query.Where(d => d.OperatorId == userId);
            }

            var drones = await query.OrderBy(d => d.Name).ToListAsync();
            return Ok(drones.Select(ToDto));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<DroneResponse>> GetById(int id)
        {
            var drone = await _db.Drones.Include(d => d.Operator).Include(d => d.MediaFiles).FirstOrDefaultAsync(d => d.Id == id);
            if (drone is null) return NotFound(new { message = "Dron nije pronađen" });

            // operater smije vidjeti samo dronove koji su mu dodijeljeni (isto pravilo kao u GetAll)
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                if (drone.OperatorId != userId)
                    return Forbid();
            }

            return Ok(ToDto(drone));
        }

        [HttpPost]
        [Authorize(Roles = "administrator")]
        public async Task<ActionResult<DroneResponse>> Create(CreateDroneRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Model)
                || string.IsNullOrWhiteSpace(request.Manufacturer) || string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                return BadRequest(new { message = "Sva obavezna polja moraju biti popunjena" });
            }

            if (await _db.Drones.AnyAsync(x => x.SerialNumber == request.SerialNumber))
                return BadRequest(new { message = "Serijski broj već postoji" });

            if (request.OperatorId.HasValue && !await _db.Users.AnyAsync(u => u.Id == request.OperatorId && u.Role == "operater"))
                return BadRequest(new { message = "Odabrani operater ne postoji" });

            var drone = new Drone
            {
                Name = request.Name.Trim(),
                Model = request.Model.Trim(),
                Manufacturer = request.Manufacturer.Trim(),
                SerialNumber = request.SerialNumber.Trim(),
                OperatorId = request.OperatorId,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "aktivan" : request.Status,
                Notes = request.Notes
            };

            _db.Drones.Add(drone);
            await _db.SaveChangesAsync();
            await _db.Entry(drone).Reference(d => d.Operator).LoadAsync();

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "dron", "Dodan novi dron", drone.Name, "novo");

            return CreatedAtAction(nameof(GetById), new { id = drone.Id }, ToDto(drone));
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "administrator")]
        public async Task<IActionResult> Update(int id, UpdateDroneRequest request)
        {
            var drone = await _db.Drones.Include(d => d.Operator).FirstOrDefaultAsync(d => d.Id == id);
            if (drone is null) return NotFound(new { message = "Dron nije pronađen" });

            // Iste obavezne provjere kao kod Create - PUT ranije nije provjeravao prazne vrijednosti.
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Model)
                || string.IsNullOrWhiteSpace(request.Manufacturer) || string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                return BadRequest(new { message = "Sva obavezna polja moraju biti popunjena" });
            }

            var allowedStatuses = new[] { "aktivan", "servis", "neaktivan" };
            if (!string.IsNullOrWhiteSpace(request.Status) && !allowedStatuses.Contains(request.Status))
                return BadRequest(new { message = "Nevažeći status drona" });

            if (request.OperatorId.HasValue && !await _db.Users.AnyAsync(u => u.Id == request.OperatorId && u.Role == "operater"))
                return BadRequest(new { message = "Odabrani operater ne postoji" });

            if (await _db.Drones.AnyAsync(x => x.SerialNumber == request.SerialNumber && x.Id != id))
                return BadRequest(new { message = "Serijski broj već postoji" });

            drone.Name = request.Name.Trim();
            drone.Model = request.Model.Trim();
            drone.Manufacturer = request.Manufacturer.Trim();
            drone.SerialNumber = request.SerialNumber.Trim();
            drone.OperatorId = request.OperatorId;
            if (!string.IsNullOrWhiteSpace(request.Status)) drone.Status = request.Status;
            drone.Notes = request.Notes;

            await _db.SaveChangesAsync();
            await _db.Entry(drone).Reference(d => d.Operator).LoadAsync();

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "dron", "Izmijenjen dron", drone.Name, "novo");

            return Ok(ToDto(drone));
        }

        // DELETE api/dronovi/{id}                 -> ako dron ima letove, vraca 409 sa brojem letova (bez brisanja)
        // DELETE api/dronovi/{id}?potvrdi=true     -> brise dron i (kaskadno) sve njegove letove i snimke
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrator")]
        public async Task<IActionResult> Delete(int id, [FromQuery] bool potvrdi = false)
        {
            var drone = await _db.Drones.FindAsync(id);
            if (drone is null) return NotFound(new { message = "Dron nije pronađen" });

            var droneName = drone.Name;

            var brojLetova = await _db.Flights.CountAsync(f => f.DroneId == id);
            if (brojLetova > 0 && !potvrdi)
            {
                // Poseban naglasak ako je let TRENUTNO u toku ("u-letu") - admin i dalje ima puno
                // diskreciono pravo da obriše dron (uz potvrdu), ali poruka mu mora eksplicitno
                // reći da će time prekinuti let koji se odvija upravo sada, ne samo generički
                // ukupan broj evidentiranih (uglavnom već završenih) letova.
                var imaAktivanLet = await _db.Flights.AnyAsync(f => f.DroneId == id && f.Status == "u-letu");
                var upozorenjeAktivnogLeta = imaAktivanLet
                    ? " UPOZORENJE: jedan od tih letova je TRENUTNO U TOKU (status 'u letu')."
                    : "";

                return Conflict(new
                {
                    message = $"Ovaj dron ima {brojLetova} evidentiran(og/ih) let(a).{upozorenjeAktivnogLeta} Brisanjem drona trajno će biti obrisani i svi njegovi letovi i snimci. Da li ste sigurni?",
                    flightCount = brojLetova,
                    hasActiveFlight = imaAktivanLet,
                    requiresConfirmation = true
                });
            }

            // Skupi putanje SVIH fajlova koji ce biti kaskadno obrisani iz baze zajedno sa
            // dronom (njegova dokumentacija + snimci svih njegovih letova) PRIJE brisanja -
            // EF Core kaskadno brise redove u Media tabeli, ali ne i fizicke fajlove na disku
            // (vidi izvjestaj testiranja, nalaz #1). Bez ovoga bi fajlovi ostajali "osiroteli".
            var filePaths = await _db.MediaFiles
                .Where(m => m.DroneId == id || (m.FlightId != null && m.Flight!.DroneId == id))
                .Select(m => m.FilePath)
                .ToListAsync();

            _db.Drones.Remove(drone);
            await _db.SaveChangesAsync();

            DronBackend.Util.MediaFileCleaner.DeleteFiles(_env, filePaths);

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "dron", "Obrisan dron", droneName, "upozorenje");

            return NoContent();
        }
    }
}
