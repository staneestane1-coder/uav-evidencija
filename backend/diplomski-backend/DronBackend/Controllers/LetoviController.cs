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
    [Authorize]
    public class LetoviController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public LetoviController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        private static FlightResponse ToDto(Flight f) => new()
        {
            Id = f.Id,
            DroneId = f.DroneId,
            DroneName = f.Drone?.Name,
            OperatorId = f.OperatorId,
            OperatorName = f.Operator != null ? $"{f.Operator.FirstName} {f.Operator.LastName}" : null,
            Location = f.Location,
            FlightDateTime = f.FlightDateTime,
            DurationMinutes = f.DurationMinutes,
            Status = f.Status,
            RequestedStatus = f.RequestedStatus,
            ReviewedByUserId = f.ReviewedByUserId,
            ReviewedByName = f.ReviewedBy != null ? $"{f.ReviewedBy.FirstName} {f.ReviewedBy.LastName}" : null,
            ReviewedAt = f.ReviewedAt,
            RejectionReason = f.RejectionReason,
            RejectionAcknowledged = f.RejectionAcknowledged,
            Warning = f.Warning,
            WarningAt = f.WarningAt,
            WarningByName = f.WarningBy != null ? $"{f.WarningBy.FirstName} {f.WarningBy.LastName}" : null,
            WarningAcknowledged = f.WarningAcknowledged,
            Note = f.Note,
            MediaFiles = f.MediaFiles.Select(m => new MediaResponse
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

        // Zajednicki Include lanac za sve rute koje vracaju pun FlightResponse (GetAll,
        // GetById, Odobri, Odbij) - ranije ponovljen identicno na sva 4 mjesta.
        private IQueryable<Flight> FlightsWithDetails() => _db.Flights
            .Include(f => f.Drone)
            .Include(f => f.Operator)
            .Include(f => f.ReviewedBy)
            .Include(f => f.WarningBy)
            .Include(f => f.MediaFiles);

        // page/pageSize su opcioni (bez njih se ponasa isto kao ranije - vraca sve) da se ne
        // bi pokvario postojeci frontend, koji ih trenutno ne salje. Dodato kao pripremu za
        // rast broja letova (vidi izvjestaj testiranja, nalaz #9) - GET /letovi je endpoint
        // koji ce najbrze narasti u odnosu na ostale liste (korisnici/dronovi).
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FlightResponse>>> GetAll([FromQuery] int? page, [FromQuery] int? pageSize)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            var query = FlightsWithDetails();

            // operater vidi samo svoje letove
            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                query = query.Where(f => f.OperatorId == userId);
            }

            var ordered = query.OrderByDescending(f => f.FlightDateTime);

            IQueryable<Flight> paged = ordered;
            if (page.HasValue && pageSize.HasValue && pageSize.Value > 0)
            {
                var pageNumber = Math.Max(page.Value, 1);
                paged = ordered.Skip((pageNumber - 1) * pageSize.Value).Take(pageSize.Value);
            }

            var flights = await paged.ToListAsync();
            return Ok(flights.Select(ToDto));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<FlightResponse>> GetById(int id)
        {
            var flight = await FlightsWithDetails().FirstOrDefaultAsync(f => f.Id == id);

            if (flight is null) return NotFound(new { message = "Let nije pronađen" });

            // operater smije vidjeti samo sopstvene letove (isto pravilo kao u GetAll)
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role == "operater")
            {
                var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                if (flight.OperatorId != userId)
                    return Forbid();
            }

            return Ok(ToDto(flight));
        }

        // Koristi se za Create (operater/administrator prijavljuju let SAMO sa jednim od ova
        // tri "operativna" statusa - na-cekanju/odbijen se dodjeljuju iskljucivo kroz tok
        // odobrenja, ne direktnim unosom).
        private static readonly string[] AllowedFlightStatuses = { "planiran", "u-letu", "zavrsen" };

        // Administrator kroz puni Update (Izmijeni let) smije eksplicitno vidjeti/zadrzati/
        // promijeniti i na-cekanju/odbijen - to ostaje njegovo trusted-unos ovlascenje (isto
        // kao i direktno kreiranje bez odobrenja), i sprecava da padajuci meni na frontendu
        // ostane bez odgovarajuce opcije kad se otvori za izmjenu leta koji je trenutno u
        // jednom od ta dva stanja.
        private static readonly string[] AllowedFlightStatusesForUpdate =
            AllowedFlightStatuses.Concat(new[] { "na-cekanju", "odbijen", "otkazan" }).ToArray();

        // operater prijavljuje let za sebe (OperatorId iz requesta se za operatera ignoriše);
        // administrator takodje moze prijaviti let, i to eksplicitno u ime bilo kojeg operatera
        // slanjem OperatorId polja (validira se da odabrani korisnik postoji i ima ulogu
        // "operater" - vidi tijelo metode ispod). Kontrola leta NEMA pristup ovoj akciji -
        // njena uloga je iskljucivo uvid/nadzor (isto ogranicenje kao na Update ispod), zato
        // je ovdje eksplicitno [Authorize(Roles=...)].
        [HttpPost]
        [Authorize(Roles = "administrator,operater")]
        public async Task<ActionResult<FlightResponse>> Create(CreateFlightRequest request)
        {
            var drone = await _db.Drones.FindAsync(request.DroneId);
            if (drone is null) return BadRequest(new { message = "Odabrani dron ne postoji" });

            if (!string.IsNullOrWhiteSpace(request.Status) && !AllowedFlightStatuses.Contains(request.Status))
                return BadRequest(new { message = "Nevažeći status leta" });

            var role = User.FindFirstValue(ClaimTypes.Role);
            var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Nalaz 7.8 (testiranje) - operater smije prijaviti let ISKLJUČIVO sa letjelicom
            // koja mu je dodijeljena (Drone.OperatorId). Ranije se provjeravalo samo da
            // odabrani dron postoji, ne i da pripada pozivaocu, cime je bilo koji operater
            // mogao prijaviti let sa tudjom letjelicom. Administrator ostaje izuzet - on
            // eksplicitno prijavljuje let u ime bilo kojeg operatera (vidi granu ispod).
            if (role == "operater" && drone.OperatorId != callerId)
            {
                return StatusCode(403, new { message = "Operater može prijaviti let samo sa letjelicom koja mu je dodijeljena." });
            }

            int operatorId;
            if (role == "operater")
            {
                // Operater UVIJEK prijavljuje let na sebe - eventualni OperatorId poslan sa
                // klijenta se namjerno ignoriše, da operater ne bi mogao "podmetnuti" let
                // drugom operateru (npr. mijenjajući payload direktno, mimo forme).
                operatorId = callerId;
            }
            else
            {
                // Administrator - smije prijaviti let u ime bilo kojeg operatera, ako je
                // OperatorId poslan i validan. Ako nije poslan, let se vodi na samog
                // administratora (npr. testni/interni unos) - to je eksplicitno ponašanje,
                // ne slučajno podmetanje kao ranije (vidi napomenu u CreateFlightRequest).
                if (request.OperatorId.HasValue)
                {
                    var targetUser = await _db.Users.FindAsync(request.OperatorId.Value);
                    if (targetUser is null || targetUser.Role != "operater")
                        return BadRequest(new { message = "Odabrani operater ne postoji ili nema ulogu operatera." });

                    operatorId = targetUser.Id;
                }
                else
                {
                    operatorId = callerId;
                }
            }

            var requestedStatus = string.IsNullOrWhiteSpace(request.Status) ? "zavrsen" : request.Status;

            // Operater prijavljuje let ISKLJUČIVO kao "planiran" (Zadatak 3) - to je jedina
            // prava "ulazna tačka" za operatera, sve ostale tranzicije (pokretanje,
            // završavanje) idu kroz posebne, uske akcije ispod (Pokreni/Zavrsi/Otkazi), nakon
            // što kontrola odobri let. Ovo je zaštita na backendu, ne samo skrivanje opcije na
            // frontendu - operater ne smije zaobići formu direktnim API pozivom. "u-letu"/
            // "zavrsen" ostaju dozvoljeni SAMO za administratora (trusted unos).
            if (role == "operater")
            {
                if (requestedStatus != "planiran")
                    return BadRequest(new { message = "Operater može prijaviti let samo sa statusom 'planiran'." });

                // Forma "Prijavi let" (operater/prijavi-let) zahtijeva oba polja - ovo je ista
                // provjera na backendu, da direktan API poziv mimo forme ne može zaobići ono što
                // frontend već nameće. Administratorov unos (Create u ime operatera, ili puni
                // Update/izmijeni-let) ostaje trusted i namjerno NE prolazi kroz ove provjere -
                // ta dva puta eksplicitno dozvoljavaju praznu lokaciju/proizvoljan datum.
                if (string.IsNullOrWhiteSpace(request.Location))
                    return BadRequest(new { message = "Molimo unesite lokaciju leta." });

                if (request.FlightDateTime <= DateTime.UtcNow)
                    return BadRequest(new { message = "Molimo odaberite datum i vrijeme u budućnosti." });
            }

            var flight = new Flight
            {
                DroneId = request.DroneId,
                OperatorId = operatorId,
                Location = request.Location,
                FlightDateTime = request.FlightDateTime,
                DurationMinutes = request.DurationMinutes,
                Note = request.Note
            };

            // Operater ne aktivira "planiran" let direktno - zahtjev ide na odobrenje kontroli
            // leta, a traženi status se pamti u RequestedStatus i aktivira tek nakon odobrenja
            // (vidi Odobri ispod). Otkad je (Zadatak 3) operateru dozvoljeno da prijavi SAMO
            // "planiran", ova grana je za operatera praktično jedina moguća - provjera ostaje
            // eksplicitna (umjesto pojednostavljivanja u bezuslovni "if (role == operater)")
            // da kod ostane tačan i bez izmjene ako se gornje ograničenje ikad ublaži.
            // Administrator zadržava postojeće ponašanje - uvijek direktan status, bez obzira
            // na status (trusted unos, i dalje sve tri vrijednosti dozvoljene pri kreiranju).
            if (role == "operater" && requestedStatus == "planiran")
            {
                flight.Status = "na-cekanju";
                flight.RequestedStatus = requestedStatus;
            }
            else
            {
                flight.Status = requestedStatus;
            }

            _db.Flights.Add(flight);
            await _db.SaveChangesAsync();

            await _db.Entry(flight).Reference(f => f.Drone).LoadAsync();
            await _db.Entry(flight).Reference(f => f.Operator).LoadAsync();

            if (flight.Status == "na-cekanju")
            {
                await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Zahtjev za let poslan na odobrenje kontroli", drone.Name, "novo");
            }
            else
            {
                var activityDescription = flight.Status switch
                {
                    "u-letu" => "Pokrenut let",
                    "planiran" => "Planiran let",
                    _ => "Prijavljen let"
                };
                await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", activityDescription, drone.Name, flight.Status == "zavrsen" ? "uspjesno" : "novo");
            }

            return CreatedAtAction(nameof(GetById), new { id = flight.Id }, ToDto(flight));
        }

        // Kontrola leta odobrava zahtjev za let - status prelazi u ono sto je operater
        // originalno trazio (RequestedStatus). Ne otvara puno Update/Delete kontroli, samo
        // ovu konkretnu tranziciju stanja (isto ogranicenje kao read-only pristup letovima
        // ranije - kontrola i dalje ne moze mijenjati podatke leta, samo odluciti o njemu).
        //
        // Uslov "Status == na-cekanju" je dio SAME UPDATE naredbe (ExecuteUpdateAsync), ne
        // odvojena provjera prije SaveChanges - da dva istovremena zahtjeva nad istim letom
        // (npr. dva razlicita kontrolora kliknu Odobri i Odbij u istom trenutku) ne mogu oba
        // proci. Ko god prvi izvrsi UPDATE "pobjedi" tu tranziciju; drugi dobija affected=0
        // (BadRequest ispod), umjesto da oba upisu svoje stanje jedno preko drugog.
        [HttpPut("{id:int}/odobri")]
        [Authorize(Roles = "kontrola_leta")]
        public async Task<ActionResult<FlightResponse>> Odobri(int id)
        {
            var reviewerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var now = DateTime.UtcNow;

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.Status == "na-cekanju")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(f => f.Status, f => f.RequestedStatus ?? "planiran")
                    .SetProperty(f => f.ReviewedByUserId, reviewerId)
                    .SetProperty(f => f.ReviewedAt, now));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let nije na čekanju odobrenja." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Let odobren", flight.Drone?.Name, "uspjesno");

            return Ok(ToDto(flight));
        }

        // Kontrola leta odbija zahtjev za let, uz opcioni razlog. Isto ogranicenje kao Odobri
        // iznad - samo ova konkretna tranzicija, ne pun Update/Delete. Isti atomicni obrazac
        // (ExecuteUpdateAsync sa uslovom u Where) i isti razlog kao Odobri iznad.
        [HttpPut("{id:int}/odbij")]
        [Authorize(Roles = "kontrola_leta")]
        public async Task<ActionResult<FlightResponse>> Odbij(int id, RejectFlightRequest request)
        {
            var reviewerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var now = DateTime.UtcNow;
            var reason = string.IsNullOrWhiteSpace(request.Razlog) ? null : request.Razlog.Trim();

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.Status == "na-cekanju")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(f => f.Status, "odbijen")
                    .SetProperty(f => f.RejectionReason, reason)
                    .SetProperty(f => f.RejectionAcknowledged, false)
                    .SetProperty(f => f.ReviewedByUserId, reviewerId)
                    .SetProperty(f => f.ReviewedAt, now));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let nije na čekanju odobrenja." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Let odbijen", flight.Drone?.Name, "upozorenje");

            return Ok(ToDto(flight));
        }

        // Kontrola leta salje upozorenje operateru dok je let "u-letu" - dron je vec u vazduhu
        // pa se let ne moze "odbiti" kao na-cekanju zahtjev, ovo je odvojen komunikacijski
        // kanal koji NE mijenja Status leta, samo obavjestava operatera. Isti atomicni
        // ExecuteUpdateAsync obrazac kao Odobri/Odbij iznad - ako dvije kontrole posalju
        // upozorenje istovremeno, dozvoljeno je da drugo prepise prvo, ali sam upis mora biti
        // atomican.
        [HttpPut("{id:int}/upozorenje")]
        [Authorize(Roles = "kontrola_leta")]
        public async Task<ActionResult<FlightResponse>> PosaljiUpozorenje(int id, SendWarningRequest request)
        {
            var poruka = request.Poruka?.Trim();
            if (string.IsNullOrEmpty(poruka))
                return BadRequest(new { message = "Poruka upozorenja je obavezna." });

            var senderId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var now = DateTime.UtcNow;

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.Status == "u-letu")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(f => f.Warning, poruka)
                    .SetProperty(f => f.WarningAt, now)
                    .SetProperty(f => f.WarningByUserId, senderId)
                    .SetProperty(f => f.WarningAcknowledged, false));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Upozorenje se može poslati samo za let koji je trenutno u letu." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Upozorenje poslano operateru", flight.Drone?.Name, "upozorenje");

            return Ok(ToDto(flight));
        }

        // Operater potvrdjuje da je procitao upozorenje - samo za sopstveni let (ista provjera
        // vlasnistva kao GetById iznad). Administrator takodje smije potvrditi (trusted uvid,
        // isti princip kao ostale administratorske akcije). Kontrola NEMA pristup - ona salje
        // upozorenje, ne potvrdjuje ga (blokirano vec kroz [Authorize(Roles=...)] ispod).
        [HttpPut("{id:int}/potvrdi-upozorenje")]
        [Authorize(Roles = "operater,administrator")]
        public async Task<ActionResult<FlightResponse>> PotvrdiUpozorenje(int id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (role == "operater")
            {
                var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var owns = await _db.Flights.AnyAsync(f => f.Id == id && f.OperatorId == callerId);
                if (!owns)
                {
                    var existsAtAll = await _db.Flights.AnyAsync(f => f.Id == id);
                    return existsAtAll ? Forbid() : NotFound(new { message = "Let nije pronađen" });
                }
            }

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.WarningAcknowledged == false && f.Warning != null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(f => f.WarningAcknowledged, true));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let nema aktivno upozorenje za potvrdu." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Operater potvrdio upozorenje", flight.Drone?.Name, "novo");

            return Ok(ToDto(flight));
        }

        // Operater potvrdjuje da je vidio odbijanje leta - isti princip kao PotvrdiUpozorenje
        // iznad (ista pravila vlasnistva/ovlascenja), samo za drugi izvor istog signala
        // ("stvari koje operater treba da pogleda i potvrdi" - vidi shared/active-warnings-badge.js).
        [HttpPut("{id:int}/potvrdi-odbijanje")]
        [Authorize(Roles = "operater,administrator")]
        public async Task<ActionResult<FlightResponse>> PotvrdiOdbijanje(int id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (role == "operater")
            {
                var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var owns = await _db.Flights.AnyAsync(f => f.Id == id && f.OperatorId == callerId);
                if (!owns)
                {
                    var existsAtAll = await _db.Flights.AnyAsync(f => f.Id == id);
                    return existsAtAll ? Forbid() : NotFound(new { message = "Let nije pronađen" });
                }
            }

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.Status == "odbijen" && f.RejectionAcknowledged == false)
                .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.RejectionAcknowledged, true));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let nema neprihvaćeno odbijanje za potvrdu." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Operater potvrdio odbijanje leta", flight.Drone?.Name, "novo");

            return Ok(ToDto(flight));
        }

        // Operater pokreće odobreni ("planiran") let - "cleared to fly" postaje "u-letu" (let
        // stvarno počinje). Samo za sopstveni let (ista provjera vlasništva kao
        // PotvrdiUpozorenje iznad); administrator nad bilo kojim (trusted). Uska, jednosmjerna
        // tranzicija - isti princip kao Odobri/Odbij, ne otvara operateru punu mogućnost
        // izmjene leta preko ovog puta.
        [HttpPut("{id:int}/pokreni")]
        [Authorize(Roles = "administrator,operater")]
        public async Task<ActionResult<FlightResponse>> Pokreni(int id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (role == "operater")
            {
                var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var owns = await _db.Flights.AnyAsync(f => f.Id == id && f.OperatorId == callerId);
                if (!owns)
                {
                    var existsAtAll = await _db.Flights.AnyAsync(f => f.Id == id);
                    return existsAtAll ? Forbid() : NotFound(new { message = "Let nije pronađen" });
                }
            }

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.Status == "planiran")
                .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.Status, "u-letu"));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let se može pokrenuti samo iz statusa 'planiran'." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Let pokrenut", flight.Drone?.Name, "novo");

            return Ok(ToDto(flight));
        }

        // Operater označava svoj let kao završen - jedini način da let (za operatera) dođe do
        // "zavrsen" (prijava direktno kao "zavrsen" je uklonjena u Zadatak 3 - vidi Create
        // iznad). Ista pravila vlasništva kao Pokreni iznad.
        [HttpPut("{id:int}/zavrsi")]
        [Authorize(Roles = "administrator,operater")]
        public async Task<ActionResult<FlightResponse>> Zavrsi(int id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (role == "operater")
            {
                var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var owns = await _db.Flights.AnyAsync(f => f.Id == id && f.OperatorId == callerId);
                if (!owns)
                {
                    var existsAtAll = await _db.Flights.AnyAsync(f => f.Id == id);
                    return existsAtAll ? Forbid() : NotFound(new { message = "Let nije pronađen" });
                }
            }

            var affected = await _db.Flights
                .Where(f => f.Id == id && f.Status == "u-letu")
                .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.Status, "zavrsen"));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let se može označiti kao završen samo iz statusa 'u-letu'." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Let označen kao završen", flight.Drone?.Name, "uspjesno");

            return Ok(ToDto(flight));
        }

        // Operater otkazuje SVOJ let dok još nije poletio - dok čeka odobrenje ("na-cekanju")
        // ili je već odobren ali još nije pokrenut ("planiran"). Nakon "u-letu" otkazivanje
        // više nije moguće (let se već dešava - dron je u vazduhu). "odbijen" je potpuno
        // terminalan i namjerno nije uključen u Where guard ispod. Ista pravila vlasništva kao
        // Pokreni/Zavrsi iznad.
        [HttpPut("{id:int}/otkazi")]
        [Authorize(Roles = "administrator,operater")]
        public async Task<ActionResult<FlightResponse>> Otkazi(int id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (role == "operater")
            {
                var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var owns = await _db.Flights.AnyAsync(f => f.Id == id && f.OperatorId == callerId);
                if (!owns)
                {
                    var existsAtAll = await _db.Flights.AnyAsync(f => f.Id == id);
                    return existsAtAll ? Forbid() : NotFound(new { message = "Let nije pronađen" });
                }
            }

            var affected = await _db.Flights
                .Where(f => f.Id == id && (f.Status == "na-cekanju" || f.Status == "planiran"))
                .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.Status, "otkazan"));

            if (affected == 0)
            {
                var exists = await _db.Flights.AnyAsync(f => f.Id == id);
                return exists
                    ? BadRequest(new { message = "Let se može otkazati samo dok je 'na čekanju' ili 'planiran'." })
                    : NotFound(new { message = "Let nije pronađen" });
            }

            var flight = await FlightsWithDetails().FirstAsync(f => f.Id == id);
            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Let otkazan od strane operatera", flight.Drone?.Name, "upozorenje");

            return Ok(ToDto(flight));
        }

        // Kontrola leta ima ISKLJUČIVO uvid (pregled) u letove, ne i mogućnost izmjene - u skladu s
        // opisom uloge iz obrazloženja teme. Izmjena je zato ograničena samo na administratora.
        [HttpPut("{id:int}")]
        [Authorize(Roles = "administrator")]
        public async Task<IActionResult> Update(int id, UpdateFlightRequest request)
        {
            var flight = await _db.Flights.Include(f => f.Drone).Include(f => f.Operator).Include(f => f.MediaFiles)
                .FirstOrDefaultAsync(f => f.Id == id);
            if (flight is null) return NotFound(new { message = "Let nije pronađen" });

            var droneExists = await _db.Drones.AnyAsync(d => d.Id == request.DroneId);
            if (!droneExists)
                return BadRequest(new { message = "Odabrani dron ne postoji" });

            if (!string.IsNullOrWhiteSpace(request.Status) && !AllowedFlightStatusesForUpdate.Contains(request.Status))
                return BadRequest(new { message = "Nevažeći status leta" });

            var droneChanged = flight.DroneId != request.DroneId;

            flight.DroneId = request.DroneId;
            flight.Location = request.Location;
            flight.FlightDateTime = request.FlightDateTime;
            flight.DurationMinutes = request.DurationMinutes;
            if (!string.IsNullOrWhiteSpace(request.Status)) flight.Status = request.Status;
            flight.Note = request.Note;

            await _db.SaveChangesAsync();

            // Drone se mogao promijeniti - prisilno osvjezi navigation property prije mapiranja u DTO
            // (EF ne re-ucitava vec ucitanu referencu samo zato sto se FK promijenio). SAMO kad se
            // FK stvarno promijenio - EF odbija (InvalidOperationException) da "unload"-uje referencu
            // koja je vec ucitana i i dalje konzistentna sa FK-om (isti dron kao prije).
            if (droneChanged)
            {
                _db.Entry(flight).Reference(f => f.Drone).IsLoaded = false;
                await _db.Entry(flight).Reference(f => f.Drone).LoadAsync();
            }

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Izmijenjen let", flight.Drone?.Name, flight.Status == "zavrsen" ? "uspjesno" : "novo");

            return Ok(ToDto(flight));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrator")]
        public async Task<IActionResult> Delete(int id)
        {
            var flight = await _db.Flights.Include(f => f.Drone).FirstOrDefaultAsync(f => f.Id == id);
            if (flight is null) return NotFound(new { message = "Let nije pronađen" });

            var droneName = flight.Drone?.Name;

            // Isti razlog kao u DronoviController.Delete - EF Core kaskadno brise Media redove
            // iz baze zajedno sa letom, ali ne i fizicke fajlove na disku (nalaz #1 iz izvjestaja
            // testiranja), pa se putanje moraju sacuvati PRIJE brisanja.
            var filePaths = await _db.MediaFiles
                .Where(m => m.FlightId == id)
                .Select(m => m.FilePath)
                .ToListAsync();

            _db.Flights.Remove(flight);
            await _db.SaveChangesAsync();

            DronBackend.Util.MediaFileCleaner.DeleteFiles(_env, filePaths);

            await DronBackend.Util.ActivityLogger.LogAsync(_db, User, "let", "Obrisan let", droneName, "upozorenje");

            return NoContent();
        }
    }
}
