using Data.EF;
using Data.EF.Models;
using DronBackend.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Xunit;

namespace DronBackend.Tests
{
    // Test konkurentnosti - provjerava centralnu tvrdnju rada (poglavlja 3.2, 5.1, 5.5) da
    // ExecuteUpdateAsync sa uslovom u Where klauzuli sprecava da dva istovremena zahtjeva nad
    // istim letom oba uspiju. Za razliku od LetoviControllerTests (jedan DbContext po testu),
    // ovdje su namjerno koriscena DVA ODVOJENA DbContext-a (kao dva odvojena HTTP zahtjeva u
    // stvarnoj aplikaciji), oba spojena na ISTU named in-memory SQLite bazu putem
    // "cache=shared" - obicna ":memory:" konekcija je vidljiva samo sopstvenoj konekciji, pa
    // bi dva odvojena DbContext-a inace vidjela dvije razlicite, prazne baze.
    public class ConcurrencyTests : IDisposable
    {
        private readonly SqliteConnection _keepAliveConnection;
        private readonly string _dbName = $"racetest_{Guid.NewGuid():N}";

        public ConcurrencyTests()
        {
            // Ova konekcija se ne koristi direktno - samo drzi named in-memory bazu zivom dok
            // test traje (SQLite in-memory baza se brise kad se zatvori POSLJEDNJA konekcija
            // na nju).
            _keepAliveConnection = new SqliteConnection($"Data Source=file:{_dbName}?mode=memory&cache=shared");
            _keepAliveConnection.Open();

            using var setupDb = CreateContext();
            setupDb.Database.EnsureCreated();
        }

        public void Dispose()
        {
            _keepAliveConnection.Dispose();
        }

        private AppDbContext CreateContext()
        {
            var connection = new SqliteConnection($"Data Source=file:{_dbName}?mode=memory&cache=shared");
            connection.Open();
            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
            return new AppDbContext(options);
        }

        private static LetoviController CreateController(AppDbContext db, string role, int userId)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, role)
            };
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));

            var controller = new LetoviController(db, new FakeWebHostEnvironment());
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
            return controller;
        }

        [Fact]
        public async Task Odobri_DvaIstovremenaZahtjeva_TacnoJedanUspijeva()
        {
            using var seedDb = CreateContext();
            var kontrola1 = new User { UserName = "kontrola1", FirstName = "Prva", LastName = "Kontrola", Email = "k1@uav.com", PasswordHash = "x", Role = "kontrola_leta" };
            var kontrola2 = new User { UserName = "kontrola2", FirstName = "Druga", LastName = "Kontrola", Email = "k2@uav.com", PasswordHash = "x", Role = "kontrola_leta" };
            var operater = new User { UserName = "operater1", FirstName = "Prvi", LastName = "Operater", Email = "op1@uav.com", PasswordHash = "x", Role = "operater" };
            seedDb.Users.AddRange(kontrola1, kontrola2, operater);
            await seedDb.SaveChangesAsync();

            var dron = new Drone { Name = "Dron-01", Model = "Model X", Manufacturer = "Proizvodjac", SerialNumber = "SN-RACE-001", OperatorId = operater.Id, Status = "aktivan" };
            seedDb.Drones.Add(dron);
            await seedDb.SaveChangesAsync();

            var flight = new Flight
            {
                DroneId = dron.Id,
                OperatorId = operater.Id,
                Location = "Test lokacija",
                FlightDateTime = DateTime.UtcNow.AddDays(1),
                Status = "na-cekanju",
                RequestedStatus = "planiran"
            };
            seedDb.Flights.Add(flight);
            await seedDb.SaveChangesAsync();
            var flightId = flight.Id;

            // Dva ODVOJENA DbContext-a i kontrolera - simulira dva razlicita, istovremena HTTP
            // zahtjeva (npr. dva razlicita clana kontrole leta kliknu "Odobri" u istom trenutku,
            // ili isti korisnik dvaput klikne dugme). Task.WhenAll pokrece oba poziva istinski
            // paralelno, ne sekvencijalno.
            using var db1 = CreateContext();
            using var db2 = CreateContext();
            var controller1 = CreateController(db1, "kontrola_leta", kontrola1.Id);
            var controller2 = CreateController(db2, "kontrola_leta", kontrola2.Id);

            var task1 = controller1.Odobri(flightId);
            var task2 = controller2.Odobri(flightId);
            var results = await Task.WhenAll(task1, task2);

            var okCount = results.Count(r => r.Result is OkObjectResult);
            var badCount = results.Count(r => r.Result is BadRequestObjectResult);

            Assert.Equal(1, okCount);
            Assert.Equal(1, badCount);

            using var verifyDb = CreateContext();
            var finalFlight = await verifyDb.Flights.AsNoTracking().FirstAsync(f => f.Id == flightId);
            Assert.Equal("planiran", finalFlight.Status);
            Assert.True(finalFlight.ReviewedByUserId == kontrola1.Id || finalFlight.ReviewedByUserId == kontrola2.Id);
        }
    }
}
