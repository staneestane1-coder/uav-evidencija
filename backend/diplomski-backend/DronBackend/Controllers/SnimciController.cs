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
    // Snimci (fotografije/video) vezani za konkretan let, ILI fotografije/video/tehnička
    // dokumentacija vezani direktno za letjelicu (dron) - vidi Media.FlightId / Media.DroneId.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SnimciController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        // Fotografije i video (letovi i dronovi)
        private static readonly string[] MediaExtensions =
            { ".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".avi" };

        // Tehnička dokumentacija (samo za dronove - atesti, uputstva, servisni izvještaji...)
        private static readonly string[] DocumentExtensions =
            { ".pdf", ".doc", ".docx" };

        private const long MaxFileSizeBytes = 100 * 1024 * 1024; // 100 MB

        public SnimciController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        // Fajlovi se cuvaju van wwwroot (App_Data/uploads), pa se NE serviraju kao javni staticki
        // sadrzaj. Url ovdje pokazuje na autentifikovanu rutu GET api/snimci/{id}/file (ispod),
        // koja prije slanja fajla provjerava ulogu/vlasnistvo isto kao GetAll/GetById.
        private static MediaResponse ToDto(Media m) => new()
        {
            Id = m.Id,
            FlightId = m.FlightId,
            DroneId = m.DroneId,
            FileName = m.FileName,
            Url = $"/api/snimci/{m.Id}/file",
            ContentType = m.ContentType,
            UploadedAt = m.UploadedAt
        };

        private string GetUploadsRoot() => Path.Combine(_env.ContentRootPath, "App_Data", "uploads");

        // Provjerava da prvi bajtovi fajla (magic number) zaista odgovaraju ekstenziji iz
        // naziva - sama ekstenzija u nazivu se lako zaobidje (fajl se preimenuje). Vidi
        // Util/FileSignatureValidator.cs i izvjestaj testiranja, nalaz #5.
        private static async Task<bool> MatchesDeclaredType(IFormFile file, string ext)
        {
            var header = new byte[12];
            await using var stream = file.OpenReadStream();
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length));
            if (read < header.Length)
                Array.Resize(ref header, read);

            return DronBackend.Util.FileSignatureValidator.MatchesExtension(ext, header);
        }

        // Da li trenutno ulogovani korisnik smije PRISTUPITI (vidjeti/preuzeti) ovaj snimak -
        // ista pravila kao filter u GetAll.
        private bool CanAccess(Media media, string? role, int userId)
        {
            if (role == "administrator" || role == "kontrola_leta") return true;
            if (role == "operater")
            {
                if (media.FlightId != null) return media.Flight?.OperatorId == userId;
                if (media.DroneId != null) return media.Drone?.OperatorId == userId;
            }
            return false;
        }

        // GET api/snimci?letId=5          -> snimci za konkretan let
        // GET api/snimci?droneId=3        -> fotografije/video/dokumentacija za konkretan dron
        // GET api/snimci                  -> sve dostupno za ulogu (letovi + dronovi)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MediaResponse>>> GetAll([FromQuery] int? letId, [FromQuery] int? droneId)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            var query = _db.MediaFiles.Include(m => m.Flight).Include(m => m.Drone).AsQueryable();

            if (letId.HasValue)
                query = query.Where(m => m.FlightId == letId.Value);

            if (droneId.HasValue)
                query = query.Where(m => m.DroneId == droneId.Value);

            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                // operater vidi samo snimke svojih letova i dokumentaciju dronova koji su mu dodijeljeni
                query = query.Where(m =>
                    (m.FlightId != null && m.Flight!.OperatorId == userId) ||
                    (m.DroneId != null && m.Drone!.OperatorId == userId));
            }

            var media = await query.OrderByDescending(m => m.UploadedAt).ToListAsync();
            return Ok(media.Select(ToDto));
        }

        // POST api/snimci/{letId}  (multipart/form-data, polje "files") - snimci vezani za let
        [HttpPost("{letId:int}")]
        [RequestSizeLimit(MaxFileSizeBytes)]
        public async Task<ActionResult<IEnumerable<MediaResponse>>> Upload(int letId, [FromForm] List<IFormFile> files)
        {
            var flight = await _db.Flights.FindAsync(letId);
            if (flight is null) return NotFound(new { message = "Let nije pronađen" });

            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                if (flight.OperatorId != userId)
                    return Forbid();
            }

            // Snimci sa terena po definiciji ne mogu postojati dok let nije stvarno završen -
            // frontend iz istog razloga prikazuje upload widget samo za "zavrsen" (Zadatak 3),
            // ali to je bila samo UI odluka bez odgovarajuce provjere ovdje, pa je direktan API
            // poziv mimo forme mogao otpremiti snimak za let u bilo kom statusu. Vazi za obje
            // uloge koje smiju uploadovati (operater i administrator).
            if (flight.Status != "zavrsen")
                return BadRequest(new { message = "Snimci se mogu dodati samo za završene letove." });

            if (files is null || files.Count == 0)
                return BadRequest(new { message = "Nije odabran nijedan fajl" });

            var uploadsRoot = Path.Combine(GetUploadsRoot(), "letovi", letId.ToString());
            Directory.CreateDirectory(uploadsRoot);

            var saved = new List<Media>();

            foreach (var file in files)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!MediaExtensions.Contains(ext))
                    return BadRequest(new { message = $"Nedozvoljen format fajla: {ext}. Za let su dozvoljene samo fotografije i video zapisi." });

                if (file.Length > MaxFileSizeBytes)
                    return BadRequest(new { message = $"Fajl {file.FileName} prelazi maksimalnu veličinu od 100MB" });

                if (!await MatchesDeclaredType(file, ext))
                    return BadRequest(new { message = $"Sadržaj fajla {file.FileName} ne odgovara ekstenziji {ext}." });

                var safeName = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(uploadsRoot, safeName);

                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var relativePath = Path.Combine("App_Data", "uploads", "letovi", letId.ToString(), safeName);

                var media = new Media
                {
                    FlightId = letId,
                    FileName = file.FileName,
                    FilePath = relativePath,
                    ContentType = file.ContentType
                };
                _db.MediaFiles.Add(media);
                saved.Add(media);
            }

            await _db.SaveChangesAsync();

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", $"Dodano snimaka: {saved.Count}", flight.Location, "novo");

            return Ok(saved.Select(ToDto));
        }

        // POST api/snimci/dron/{droneId}  (multipart/form-data, polje "files")
        // Fotografije, video zapisi i tehnička dokumentacija vezani direktno za letjelicu,
        // neovisno od pojedinačnih letova (npr. atest ispravnosti, uputstvo za upotrebu).
        [HttpPost("dron/{droneId:int}")]
        [RequestSizeLimit(MaxFileSizeBytes)]
        public async Task<ActionResult<IEnumerable<MediaResponse>>> UploadZaDron(int droneId, [FromForm] List<IFormFile> files)
        {
            var drone = await _db.Drones.FindAsync(droneId);
            if (drone is null) return NotFound(new { message = "Dron nije pronađen" });

            var role = User.FindFirstValue(ClaimTypes.Role);
            // Kontrola leta ima samo pregled dokumentacije drona, ne i mogućnost dodavanja.
            if (role == "kontrola_leta")
                return Forbid();

            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                if (drone.OperatorId != userId)
                    return Forbid();
            }

            if (files is null || files.Count == 0)
                return BadRequest(new { message = "Nije odabran nijedan fajl" });

            var uploadsRoot = Path.Combine(GetUploadsRoot(), "dronovi", droneId.ToString());
            Directory.CreateDirectory(uploadsRoot);

            var allowedExtensions = MediaExtensions.Concat(DocumentExtensions).ToArray();
            var saved = new List<Media>();

            foreach (var file in files)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!allowedExtensions.Contains(ext))
                {
                    return BadRequest(new
                    {
                        message = $"Nedozvoljen format fajla: {ext}. Dozvoljeno je: " +
                                   string.Join(", ", allowedExtensions)
                    });
                }

                if (file.Length > MaxFileSizeBytes)
                    return BadRequest(new { message = $"Fajl {file.FileName} prelazi maksimalnu veličinu od 100MB" });

                if (!await MatchesDeclaredType(file, ext))
                    return BadRequest(new { message = $"Sadržaj fajla {file.FileName} ne odgovara ekstenziji {ext}." });

                var safeName = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(uploadsRoot, safeName);

                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var relativePath = Path.Combine("App_Data", "uploads", "dronovi", droneId.ToString(), safeName);

                var media = new Media
                {
                    DroneId = droneId,
                    FileName = file.FileName,
                    FilePath = relativePath,
                    ContentType = file.ContentType
                };
                _db.MediaFiles.Add(media);
                saved.Add(media);
            }

            await _db.SaveChangesAsync();

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "dron", $"Dodano dokumenata/snimaka: {saved.Count}", drone.Name, "novo");

            return Ok(saved.Select(ToDto));
        }

        // GET api/snimci/{id}/file - jedini nacin da se dodje do stvarnog sadrzaja fajla.
        // Token se moze poslati i kroz Authorization header i kroz ?access_token= (vidi
        // OnMessageReceived u Program.cs) jer <a href>/<img src> ne mogu slati custom header.
        [HttpGet("{id:int}/file")]
        public async Task<IActionResult> GetFile(int id)
        {
            var media = await _db.MediaFiles.Include(m => m.Flight).Include(m => m.Drone).FirstOrDefaultAsync(m => m.Id == id);
            if (media is null) return NotFound(new { message = "Snimak nije pronađen" });

            var role = User.FindFirstValue(ClaimTypes.Role);
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (!CanAccess(media, role, userId))
                return Forbid();

            var fullPath = Path.Combine(_env.ContentRootPath, media.FilePath);
            if (!System.IO.File.Exists(fullPath))
                return NotFound(new { message = "Fajl nije pronađen na disku" });

            var contentType = string.IsNullOrWhiteSpace(media.ContentType) ? "application/octet-stream" : media.ContentType;
            return PhysicalFile(fullPath, contentType, media.FileName);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var media = await _db.MediaFiles.Include(m => m.Flight).Include(m => m.Drone).FirstOrDefaultAsync(m => m.Id == id);
            if (media is null) return NotFound(new { message = "Snimak nije pronađen" });

            var role = User.FindFirstValue(ClaimTypes.Role);

            // Brisanje snimaka leta: administrator ili kontrola leta.
            if (media.FlightId != null && role != "administrator" && role != "kontrola_leta")
                return Forbid();

            // Brisanje dokumentacije drona: samo administrator (kontrola leta ima samo pregled).
            if (media.DroneId != null && role != "administrator")
                return Forbid();

            var fullPath = Path.Combine(_env.ContentRootPath, media.FilePath);
            if (System.IO.File.Exists(fullPath))
                System.IO.File.Delete(fullPath);

            _db.MediaFiles.Remove(media);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
