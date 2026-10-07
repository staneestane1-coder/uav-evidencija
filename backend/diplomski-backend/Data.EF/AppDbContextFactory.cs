using System;
using System.IO;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Data.EF
{
    // ISKLJUČIVO za EF Core CLI alat (dotnet ef migrations ..., dotnet ef database update ...).
    //
    // Kad se AppDbContext traži preko "dotnet ef", EF Core tooling normalno pokušava da
    // izgradi CIJELU aplikaciju (Program.cs) da bi pronašao DbContext registrovan u DI
    // kontejneru. Problem: Program.cs prije toga provjerava da li je podešen JWT tajni
    // ključ i baca grešku ako nije - što je odlično za stvarno pokretanje API-ja (da niko
    // ne pokrene sistem s praznim ključem), ali potpuno nepotrebno usput blokira i samo
    // GENERISANJE migracije, koje sa JWT-om nema nikakve veze.
    //
    // Prisustvo OVE klase (IDesignTimeDbContextFactory<AppDbContext>) govori EF alatu:
    // "ne pokušavaj da podigneš cijelu aplikaciju - samo pozovi CreateDbContext() ovdje".
    // Program.cs i njegova provjera JWT ključa se u tom slučaju uopšte ne izvršavaju,
    // pa "dotnet ef migrations add ..." radi i BEZ prethodno podešenog JWT ključa.
    //
    // Napomena: JWT ključ i dalje MORA biti podešen da bi se aplikacija stvarno POKRENULA
    // (dotnet run) - ova klasa mijenja samo to kako se pravi/ažurira migracija, ne i
    // stvarno pokretanje API-ja.
    public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var connectionString = ResolveConnectionString();

            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));

            return new AppDbContext(optionsBuilder.Options);
        }

        private static string ResolveConnectionString()
        {
            // 1) Environment varijabla (isti princip kao za Jwt__SecretKey u produkciji) -
            //    ako je neko već podesio ConnectionStrings__DefaultConnection, koristi to.
            var fromEnv = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            if (!string.IsNullOrWhiteSpace(fromEnv))
                return fromEnv;

            // 2) appsettings.json iz DronBackend projekta (tu gdje se aplikacija stvarno
            //    pokreće) - radi bilo da se komanda pokrene iz DronBackend ili iz Data.EF foldera.
            var candidatePaths = new[]
            {
                Path.Combine(Directory.GetCurrentDirectory(), "..", "DronBackend", "appsettings.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json"),
            };

            foreach (var path in candidatePaths)
            {
                var fromFile = TryReadConnectionString(path);
                if (!string.IsNullOrWhiteSpace(fromFile))
                    return fromFile;
            }

            // 3) Zadnja linija odbrane - ista podrazumijevana vrijednost kao u
            //    DronBackend/appsettings.json, dovoljna da se migracija generiše i na
            //    "čistoj" lokalnoj MySQL instanci bez ikakve dodatne konfiguracije.
            return "Server=localhost;Port=3306;Database=DronMonitoringDb;User=root;Password=;SslMode=Preferred;";
        }

        private static string? TryReadConnectionString(string path)
        {
            if (!File.Exists(path))
                return null;

            try
            {
                using var stream = File.OpenRead(path);
                using var document = JsonDocument.Parse(stream);

                if (document.RootElement.TryGetProperty("ConnectionStrings", out var connectionStrings) &&
                    connectionStrings.TryGetProperty("DefaultConnection", out var value))
                {
                    return value.GetString();
                }
            }
            catch
            {
                // appsettings.json nije čitljiv/validan - probaj sljedeću putanju ili
                // podrazumijevanu vrijednost, nema potrebe da migracija zbog toga puca.
            }

            return null;
        }
    }
}
