using Data.EF;
using Data.EF.Models;
using Data.EF.Seed;
using DronBackend.Services;
using DronBackend.Util;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);


// UtcDateTimeJsonConverter: MySQL vraca DateTime bez "Z" oznake (Kind=Unspecified), sto bi
// frontend pogresno protumacio kao lokalno vrijeme - vidi komentar u Util/UtcDateTimeJsonConverter.cs.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<PasswordHasher<User>>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

// NAPOMENA: ova provjera se odnosi ISKLJUČIVO na stvarno pokretanje API-ja (dotnet run).
// Generisanje/ažuriranje migracija (dotnet ef migrations add / database update) više NE
// prolazi kroz ovaj fajl uopšte - EF Core CLI koristi Data.EF/AppDbContextFactory.cs
// (IDesignTimeDbContextFactory) da napravi AppDbContext direktno, bez pokretanja cijele
// aplikacije. Zato migracija radi i kad JWT ključ još nije podešen - ali sam API i dalje
// odbija da se pokrene bez njega, iz istog razloga zbog kojeg je ova provjera i dodana.
var jwtSection = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSection["SecretKey"];
if (string.IsNullOrWhiteSpace(secretKey))
{
    throw new InvalidOperationException(
        "JWT SecretKey nije podešen. Podesi ga preko User Secrets (dotnet user-secrets set \"Jwt:SecretKey\" \"...\") " +
        "za lokalni razvoj, ili preko environment varijable Jwt__SecretKey u produkciji. " +
        "NE upisuj stvarni ključ u appsettings.json jer taj fajl ide u git repo.");
}
var issuer = jwtSection["Issuer"];
var audience = jwtSection["Audience"];

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidAudience = audience,

            ValidateIssuer = true,
            ValidIssuer = issuer,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        // Fajlovi (snimci/dokumentacija) se otvaraju direktno kroz <a href>/<img src>, pa browser
        // ne salje Authorization header. Za GET api/snimci/{id}/file dozvoljavamo token i kroz
        // query string (?access_token=...) - SAMO za tu rutu, ne globalno.
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var path = context.HttpContext.Request.Path;
                if (path.StartsWithSegments("/api/snimci") && path.Value != null && path.Value.EndsWith("/file"))
                {
                    var accessToken = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(accessToken))
                    {
                        context.Token = accessToken;
                    }
                }
                return Task.CompletedTask;
            },

            // JWT je po prirodi "stateless" - potpis i rok trajanja se provjere ISKLJUČIVO iz
            // samog tokena, bez ijednog upita ka bazi. Problem: ako administrator deaktivira
            // nalog ili mu promijeni ulogu, korisnik koji je već ulogovan bi normalno zadržao
            // pristup sa starim tokenom sve do isteka (do 12h - vidi appsettings Jwt:ExpiresInHours).
            // Ovaj handler se izvršava PRI SVAKOM autentifikovanom zahtjevu, nakon što je potpis/rok
            // već uspješno provjeren, i dodatno provjerava TRENUTNO stanje korisnika u bazi:
            //   - ako je nalog deaktiviran (ili obrisan) u međuvremenu -> zahtjev se odbija odmah
            //   - ako mu je promijenjena uloga -> nova uloga se koristi odmah za autorizaciju,
            //     umjesto (potencijalno zastarjele) uloge upisane u sam token
            // Cijena je jedan dodatni (jednostavan, indeksiran po primarnom ključu) upit po
            // zahtjevu - prihvatljivo za obim ove aplikacije, u zamjenu za mnogo predvidljivije
            // ponašanje (deaktivacija naloga stvarno odmah oduzima pristup).
            OnTokenValidated = async context =>
            {
                var userIdClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userIdClaim is null || !int.TryParse(userIdClaim, out var userId))
                {
                    context.Fail("Nevažeći token.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);

                if (user is null || user.Status != "aktivan")
                {
                    context.Fail("Nalog je deaktiviran ili više ne postoji.");
                    return;
                }

                // Token izdat PRIJE posljednje promjene lozinke (npr. zato sto je nalog bio
                // kompromitovan) se odbija odmah, umjesto da ostane validan do prirodnog
                // isteka (do Jwt:ExpiresInHours) - vidi izvjestaj testiranja, nalaz #7.
                // "iat" (issued at) je standardni JWT claim koji JwtSecurityToken automatski
                // postavlja pri izdavanju (vidi JwtTokenHelper.GenerateToken).
                var iatClaim = context.Principal!.FindFirst("iat")?.Value;
                if (iatClaim != null && long.TryParse(iatClaim, out var iatUnix))
                {
                    // "iat" je Unix timestamp u CIJELIM sekundama (bez djelova sekunde), dok
                    // PasswordChangedAt u bazi ima preciznost do mikrosekunde. Bez svođenja
                    // obje strane na istu (sekundnu) preciznost, nalog kreiran i odmah
                    // ulogovan U ISTOJ SEKUNDI bi lažno pao na ovoj provjeri (zaokruženi iat bi
                    // ispao "raniji" od PasswordChangedAt iako je token stvarno izdat poslije) -
                    // otkriveno upravo ovim scenarijem tokom lokalnog smoke-testa.
                    var passwordChangedAtUnix = new DateTimeOffset(
                        DateTime.SpecifyKind(user.PasswordChangedAt, DateTimeKind.Utc)).ToUnixTimeSeconds();

                    if (iatUnix < passwordChangedAtUnix)
                    {
                        context.Fail("Lozinka je promijenjena poslije izdavanja ovog tokena.");
                        return;
                    }
                }

                var identity = context.Principal!.Identity as ClaimsIdentity;
                var existingRoleClaim = identity?.FindFirst(ClaimTypes.Role);
                if (existingRoleClaim != null)
                {
                    identity!.RemoveClaim(existingRoleClaim);
                    identity.AddClaim(new Claim(ClaimTypes.Role, user.Role));
                }
            }
        };
    });

builder.Services.AddAuthorization();

// NAPOMENA: politika "dev" (AllowAnyOrigin) se ranije primjenjivala BEZUSLOVNO, i u
// produkciji - naziv je sugerisao ogranicenje samo za razvoj, ali kod to nikad nije stvarno
// provjeravao (vidi izvjestaj testiranja, nalaz #6). Sad se AllowAnyOrigin koristi SAMO kad
// je Environment.IsDevelopment() tacno (frontend se lokalno cesto otvara direktno kao fajl
// ili sa promjenljivog porta, pa je to tu prihvatljivo). Van developmenta se koriste
// ISKLJUCIVO domeni navedeni u AllowedOrigins (appsettings.json / env varijabla
// AllowedOrigins__0, __1, ...) - ako nijedan nije podesen, cross-origin pozivi se odbijaju
// (fail-safe podrazumijevano ponasanje, umjesto fail-open kao ranije).
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin();
        }
        else if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    });
});

// Osnovna zastita od brzog "grebanja" API-ja (vidi izvjestaj testiranja, nalaz #12) - opsti
// limit po IP adresi za citav API, i strozi posebno za login (pored postojeceg
// zakljucavanja naloga u AuthController, koje stiti KONKRETAN nalog, ne i samo slanje
// zahtjeva ka ruti).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter = System.Threading.RateLimiting.PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "nepoznato",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("login", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "nepoznato",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // "Zaboravljena lozinka" - stroziji limit nego login, jer ove rute (za razliku od login-a)
    // nemaju zakljucavanje po nalogu kao dodatnu zastitu: forgot-password bi se inace mogao
    // zloupotrijebiti za "bombardovanje" tudjeg inbox-a emailovima, a reset-password za
    // pogadjanje tokena (i pored toga sto je token dovoljno dug da to samo po sebi bude
    // nepraktično bez ograničenja brzine).
    options.AddPolicy("password-reset", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "nepoznato",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 8,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();

// Apply pending EF migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher<User>>();

    // NAPOMENA: projekat ne sadrži EF Core migracije (folder Data.EF/Migrations).
    // Ako ih nisi generisao/la, GetMigrations() će biti prazan i baza neće imati
    // nijednu tabelu - db.Database.Migrate() u tom slučaju ne radi ništa, pa bi
    // seedovanje niže puklo sa neopisnom greškom "Table 'X' doesn't exist".
    // Ovaj blok to pretvara u jasnu, čitljivu poruku prije nego što aplikacija padne.
    if (!db.Database.GetMigrations().Any())
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine();
        Console.WriteLine("=====================================================================");
        Console.WriteLine(" GREŠKA: Nema EF Core migracija u projektu (Data.EF/Migrations).");
        Console.WriteLine(" Baza se ne može kreirati dok se ne generiše bar jedna migracija.");
        Console.WriteLine();
        Console.WriteLine(" Pokreni jednom (iz DronBackend foldera):");
        Console.WriteLine("   dotnet ef migrations add InitialCreate --project ../Data.EF --startup-project .");
        Console.WriteLine();
        Console.WriteLine(" Zatim ponovo pokreni aplikaciju (dotnet run) - migracija i seed");
        Console.WriteLine(" podaci (admin/kontrola/operater nalozi) primijeniće se automatski.");
        Console.WriteLine("=====================================================================");
        Console.ResetColor();
        Environment.Exit(1);
    }

    db.Database.Migrate();

    await DbSeeder.SeedAsync(db, hasher);
}
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Osnovni sigurnosni header-i (vidi izvjestaj testiranja, nalaz #14). Namjerno se NE dodaje
// puna Content-Security-Policy ovdje - lako bi pokvarila Swagger UI (inline skripte/stilovi)
// bez pazljivog podesavanja po direktivi, sto prevazilazi obim ove ispravke.
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

app.UseCors("frontend");

app.UseRateLimiter();

// NAPOMENA: fajlovi (snimci/dokumentacija) se VISE NE serviraju kao javni staticki sadrzaj -
// otpremljeni su van wwwroot (App_Data/uploads) i dostupni ISKLJUCIVO kroz autentifikovanu
// rutu GET api/snimci/{id}/file (SnimciController), koja provjerava ulogu/vlasnistvo isto
// kao i ostatak API-ja. Ranije "app.UseStaticFiles()" je fajlove servirao bez ikakve provjere
// tokena - ko god pogodi/dobije URL mogao je otvoriti tudju dokumentaciju drona/leta.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
