using Data.EF;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DronBackend.Controllers
{
    // Administratorski alat za odrzavanje sistema - trenutno samo ciscenje "osirotelih"
    // fajlova (vidi izvjestaj testiranja, nalaz #15): fajlova koji su ostali u App_Data/uploads
    // od prije nego sto je popravljeno brisanje fizickih fajlova pri brisanju drona/leta
    // (DronoviController/LetoviController.Delete - vidi nalaz #1), i nemaju vise nijedan
    // odgovarajuci red u Media tabeli.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "administrator")]
    public class OdrzavanjeController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public OdrzavanjeController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        // POST api/odrzavanje/ocisti-fajlove
        [HttpPost("ocisti-fajlove")]
        public async Task<IActionResult> OcistiOsiroteleFajlove()
        {
            var uploadsRoot = Path.Combine(_env.ContentRootPath, "App_Data", "uploads");
            if (!Directory.Exists(uploadsRoot))
                return Ok(new { obrisanoFajlova = 0, oslobodjenoBajtova = 0L });

            var poznatePutanje = new HashSet<string>(
                await _db.MediaFiles.Select(m => m.FilePath).ToListAsync(),
                StringComparer.OrdinalIgnoreCase);

            var obrisano = 0;
            long oslobodjeno = 0;

            foreach (var fullPath in Directory.EnumerateFiles(uploadsRoot, "*", SearchOption.AllDirectories))
            {
                var relativePath = Path.GetRelativePath(_env.ContentRootPath, fullPath);
                if (poznatePutanje.Contains(relativePath))
                    continue;

                try
                {
                    var info = new FileInfo(fullPath);
                    var size = info.Length;
                    info.Delete();
                    obrisano++;
                    oslobodjeno += size;
                }
                catch
                {
                    // Best-effort - preskoci fajl koji se ne moze obrisati (npr. zauzet od
                    // strane drugog procesa) i nastavi sa ostalima.
                }
            }

            await DronBackend.Util.ActivityLogger.LogAsync(
                _db, User, "sistem",
                $"Očišćeno osirotelih fajlova: {obrisano} ({oslobodjeno / 1024 / 1024} MB oslobođeno)",
                null, "novo");

            return Ok(new { obrisanoFajlova = obrisano, oslobodjenoBajtova = oslobodjeno });
        }
    }
}
