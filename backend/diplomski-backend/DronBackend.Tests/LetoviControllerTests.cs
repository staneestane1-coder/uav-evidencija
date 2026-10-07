using Data.EF;
using Data.EF.Models;
using DronBackend.Controllers;
using DronBackend.Dto;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Xunit;

namespace DronBackend.Tests
{
    // Minimalna lazna implementacija IWebHostEnvironment - LetoviController je zahtijeva u
    // konstruktoru (koristi se samo u Delete akciji, koja nije predmet ovih testova).
    public class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "DronBackend.Tests";
        public string WebRootPath { get; set; } = ".";
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = ".";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    // Svaki test dobija svoju, potpuno izolovanu SQLite in-memory bazu (otvorena konekcija
    // drzi bazu zivom dok test traje - EnsureCreated() gradi semu iz istog modela koji
    // koristi i stvarna aplikacija, ExecuteUpdateAsync koriscen u LetoviController-u radi
    // ispravno jer je SQLite pravi relacioni provider, za razliku od InMemory providera koji
    // ExecuteUpdateAsync ne podrzava).
    public class LetoviControllerTests : IDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly AppDbContext _db;
        private readonly LetoviController _controller;

        public LetoviControllerTests()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(_connection)
                .Options;

            _db = new AppDbContext(options);
            _db.Database.EnsureCreated();

            _controller = new LetoviController(_db, new FakeWebHostEnvironment());
        }

        public void Dispose()
        {
            _db.Dispose();
            _connection.Dispose();
        }

        private static void SetCaller(LetoviController controller, string role, int userId)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, role)
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private async Task<(User kontrola, User operater, User drugiOperater, Drone dron, Drone tudjiDron)> SeedBasicData()
        {
            var kontrola = new User { UserName = "kontrola", FirstName = "Kontrola", LastName = "Leta", Email = "kontrola@uav.com", PasswordHash = "x", Role = "kontrola_leta" };
            var operater = new User { UserName = "operater1", FirstName = "Prvi", LastName = "Operater", Email = "op1@uav.com", PasswordHash = "x", Role = "operater" };
            var drugiOperater = new User { UserName = "operater2", FirstName = "Drugi", LastName = "Operater", Email = "op2@uav.com", PasswordHash = "x", Role = "operater" };
            _db.Users.AddRange(kontrola, operater, drugiOperater);
            await _db.SaveChangesAsync();

            var dron = new Drone { Name = "Dron-01", Model = "Model X", Manufacturer = "Proizvodjac", SerialNumber = "SN-001", OperatorId = operater.Id, Status = "aktivan" };
            var tudjiDron = new Drone { Name = "Dron-02", Model = "Model Y", Manufacturer = "Proizvodjac", SerialNumber = "SN-002", OperatorId = drugiOperater.Id, Status = "aktivan" };
            _db.Drones.AddRange(dron, tudjiDron);
            await _db.SaveChangesAsync();

            return (kontrola, operater, drugiOperater, dron, tudjiDron);
        }

        // ExecuteUpdateAsync (koristen u LetoviController za sve tranzicije statusa) izvodi
        // upis direktno u bazi, mimo change trackera - FindAsync bi nakon toga vratio
        // ZASTARJELU, jos uvijek pracenu instancu iz lokalnog keša konteksta umjesto stvarnog
        // stanja iz baze. AsNoTracking() svaki put cita svjeze stanje, isto kao sto bi to
        // uradio nov DbContext u sljedecem HTTP zahtjevu u stvarnoj aplikaciji.
        private Task<Flight?> FreshFlight(int id) =>
            _db.Flights.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);

        private async Task<Flight> SeedFlight(int droneId, int operatorId, string status, string? requestedStatus = null)
        {
            var flight = new Flight
            {
                DroneId = droneId,
                OperatorId = operatorId,
                Location = "Test lokacija",
                FlightDateTime = DateTime.UtcNow.AddDays(1),
                Status = status,
                RequestedStatus = requestedStatus
            };
            _db.Flights.Add(flight);
            await _db.SaveChangesAsync();
            return flight;
        }

        // Test 1: Odobravanje leta uspijeva samo iz statusa "na-cekanju"
        [Fact]
        public async Task Odobri_UspijevaSamoIzNaCekanju()
        {
            var (kontrola, operater, _, dron, _) = await SeedBasicData();
            var letNaCekanju = await SeedFlight(dron.Id, operater.Id, "na-cekanju", requestedStatus: "planiran");
            var letVecPlaniran = await SeedFlight(dron.Id, operater.Id, "planiran");

            SetCaller(_controller, "kontrola_leta", kontrola.Id);

            var okResult = await _controller.Odobri(letNaCekanju.Id);
            var okObjectResult = Assert.IsType<OkObjectResult>(okResult.Result);
            var updated = await FreshFlight(letNaCekanju.Id);
            Assert.Equal("planiran", updated!.Status);
            Assert.Equal(kontrola.Id, updated.ReviewedByUserId);

            var badResult = await _controller.Odobri(letVecPlaniran.Id);
            Assert.IsType<BadRequestObjectResult>(badResult.Result);
            var unchanged = await FreshFlight(letVecPlaniran.Id);
            Assert.Equal("planiran", unchanged!.Status);
        }

        // Test 2: Pokretanje leta uspijeva samo iz statusa "planiran"
        [Fact]
        public async Task Pokreni_UspijevaSamoIzPlaniran()
        {
            var (_, operater, _, dron, _) = await SeedBasicData();
            var letPlaniran = await SeedFlight(dron.Id, operater.Id, "planiran");
            var letZavrsen = await SeedFlight(dron.Id, operater.Id, "zavrsen");

            SetCaller(_controller, "operater", operater.Id);

            var okResult = await _controller.Pokreni(letPlaniran.Id);
            Assert.IsType<OkObjectResult>(okResult.Result);
            var updated = await FreshFlight(letPlaniran.Id);
            Assert.Equal("u-letu", updated!.Status);

            var badResult = await _controller.Pokreni(letZavrsen.Id);
            Assert.IsType<BadRequestObjectResult>(badResult.Result);
            var unchanged = await FreshFlight(letZavrsen.Id);
            Assert.Equal("zavrsen", unchanged!.Status);
        }

        // Test 3: Otkazivanje leta uspijeva samo iz "na-cekanju"/"planiran", ne iz "u-letu"
        [Fact]
        public async Task Otkazi_UspijevaSamoIzNaCekanjuIliPlaniran_NeIzULetu()
        {
            var (_, operater, _, dron, _) = await SeedBasicData();
            var letNaCekanju = await SeedFlight(dron.Id, operater.Id, "na-cekanju", requestedStatus: "planiran");
            var letPlaniran = await SeedFlight(dron.Id, operater.Id, "planiran");
            var letULetu = await SeedFlight(dron.Id, operater.Id, "u-letu");

            SetCaller(_controller, "operater", operater.Id);

            Assert.IsType<OkObjectResult>((await _controller.Otkazi(letNaCekanju.Id)).Result);
            Assert.Equal("otkazan", (await FreshFlight(letNaCekanju.Id))!.Status);

            Assert.IsType<OkObjectResult>((await _controller.Otkazi(letPlaniran.Id)).Result);
            Assert.Equal("otkazan", (await FreshFlight(letPlaniran.Id))!.Status);

            var badResult = await _controller.Otkazi(letULetu.Id);
            Assert.IsType<BadRequestObjectResult>(badResult.Result);
            Assert.Equal("u-letu", (await FreshFlight(letULetu.Id))!.Status);
        }

        // Test 4: Zavrsetak leta uspijeva samo iz statusa "u-letu"
        [Fact]
        public async Task Zavrsi_UspijevaSamoIzULetu()
        {
            var (_, operater, _, dron, _) = await SeedBasicData();
            var letULetu = await SeedFlight(dron.Id, operater.Id, "u-letu");
            var letPlaniran = await SeedFlight(dron.Id, operater.Id, "planiran");

            SetCaller(_controller, "operater", operater.Id);

            var okResult = await _controller.Zavrsi(letULetu.Id);
            Assert.IsType<OkObjectResult>(okResult.Result);
            Assert.Equal("zavrsen", (await FreshFlight(letULetu.Id))!.Status);

            var badResult = await _controller.Zavrsi(letPlaniran.Id);
            Assert.IsType<BadRequestObjectResult>(badResult.Result);
            Assert.Equal("planiran", (await FreshFlight(letPlaniran.Id))!.Status);
        }

        // Test 5 (nakon ispravke nalaza 7.8): Operater ne moze prijaviti let sa letjelicom
        // koja mu nije dodijeljena.
        [Fact]
        public async Task Create_OperaterNeMozePrijavitiLetSaTudjimDronom()
        {
            var (_, operater, drugiOperater, dron, tudjiDron) = await SeedBasicData();

            SetCaller(_controller, "operater", operater.Id);

            var request = new CreateFlightRequest
            {
                DroneId = tudjiDron.Id, // dodijeljen drugom operateru
                Location = "Test lokacija",
                FlightDateTime = DateTime.UtcNow.AddDays(1),
                DurationMinutes = 20,
                Status = "planiran"
            };

            var result = await _controller.Create(request);
            var statusResult = Assert.IsType<ObjectResult>(result.Result);
            Assert.Equal(403, statusResult.StatusCode);

            Assert.Empty(_db.Flights.Where(f => f.DroneId == tudjiDron.Id));

            // Kontrolni pozitivan slucaj - sa sopstvenom letjelicom zahtjev uspijeva
            var validRequest = new CreateFlightRequest
            {
                DroneId = dron.Id,
                Location = "Test lokacija",
                FlightDateTime = DateTime.UtcNow.AddDays(1),
                DurationMinutes = 20,
                Status = "planiran"
            };
            var okResult = await _controller.Create(validRequest);
            Assert.IsType<CreatedAtActionResult>(okResult.Result);
        }
    }
}
