# Backend – Sistem za nadzor dronova (diplomski rad)

Napravljen po istom obrascu kao projekat sa fakulteta (ITP II kolokvijum):
ASP.NET Core Web API (.NET 8) + Entity Framework Core + MySQL (Pomelo) + JWT autentifikacija.

## Struktura

- **Data.EF** – DbContext, modeli (User, Drone, Flight, Media), seed podaci
- **DronBackend** – Web API projekat (Controllers, Dto, Util, Program.cs)

## Entiteti

- **User** – korisnik (uloge: `administrator`, `kontrola_leta`, `operater`; status: `aktivan`/`neaktivan`)
- **Drone** – dron (naziv, model, proizvođač, serijski broj, dodijeljeni operater, status: `aktivan`/`servis`/`neaktivan`)
- **Flight** (Let) – let drona (dron, operater, lokacija, datum/vrijeme, trajanje, status: `planiran`/`u-letu`/`zavrsen`, napomena)
- **Media** (Snimak) – fotografije/video vezani za konkretan let (`wwwroot/uploads/letovi/{letId}/`), ILI fotografije/video/tehnička dokumentacija vezani direktno za letjelicu (`wwwroot/uploads/dronovi/{droneId}/`) - vidi `Media.FlightId` / `Media.DroneId` (uvijek je popunjeno tačno jedno od ta dva polja)

## Endpointi

| Metoda | Ruta | Ko ima pristup | Opis |
|---|---|---|---|
| POST | `/api/auth/login` | svi | prijava, vraća JWT (nalog se zaključava na 15 min nakon 5 pogrešnih pokušaja) |
| GET/POST/PUT/DELETE | `/api/korisnici` | administrator (kontrola_leta ima samo GET, i vidi samo operatere) | upravljanje korisnicima |
| GET | `/api/dronovi` | svi (operater vidi samo svoje) | lista dronova, uključuje priloženu dokumentaciju |
| POST/PUT/DELETE | `/api/dronovi` | administrator | CRUD dronova |
| GET | `/api/letovi` | svi (operater vidi samo svoje) | lista letova |
| POST | `/api/letovi` | administrator, operater | prijava leta (operater uvijek na sebe; administrator opciono u ime bilo kojeg operatera preko `OperatorId`) |
| PUT | `/api/letovi/{id}` | administrator | izmjena leta (kontrola_leta ima samo uvid, ne izmjenu) |
| DELETE | `/api/letovi/{id}` | administrator | brisanje leta |
| GET | `/api/snimci?letId=` ili `?droneId=` | svi (operater samo svoje letove/dronove) | lista snimaka/dokumentacije |
| POST | `/api/snimci/{letId}` | svi ulogovani (operater samo svoj let) | upload fotografija/videa za let (multipart/form-data, polje `files`) |
| POST | `/api/snimci/dron/{droneId}` | administrator, operater (samo za svoj dron) | upload fotografija/videa/tehničke dokumentacije (.pdf/.doc/.docx) za letjelicu |
| DELETE | `/api/snimci/{id}` | administrator (i kontrola_leta za snimke letova) | brisanje snimka/dokumenta |

## Sigurnosne mjere

- **Lozinke**: minimum 8 karaktera, mora sadržavati bar jedno slovo i jedan broj (`Util/PasswordPolicy.cs`), provjerava se na backend-u (ne može se zaobići) i dodatno na frontend-u radi boljeg UX-a. Seed lozinke (`admin123`, `kontrola123`, `operater123`) zadovoljavaju ovo pravilo. Ako neko kasnije kroz formu za izmjenu korisnika/profila pokuša postaviti kraću lozinku ili lozinku bez slova/broja (npr. samo `1234`), sistem će je ispravno odbiti - to je namjerno ponašanje politike, a ne greška.
- **JWT SecretKey**: `appsettings.json` **ne** sadrži stvarni ključ (namjerno je prazan) - aplikacija odbija da se pokrene dok ga ne podesiš:
  ```
  cd DronBackend
  dotnet user-secrets init
  dotnet user-secrets set "Jwt:SecretKey" "<dugi-nasumican-string-min-32-karaktera>"
  ```
  U produkciji koristi environment varijablu `Jwt__SecretKey` umjesto User Secrets. Ni jedno ni drugo se ne commituje u git.
- **JWT rok trajanja tokena**: konfigurabilan preko `Jwt:ExpiresInHours` u `appsettings.json` (podrazumijevano `12` - jedna radna smjena). Ne postoji "univerzalno ispravna" vrijednost - kraći rok (npr. 1-2h) je sigurniji jer ograničava koliko dugo ukraden/procurio token vrijedi, ali prisiljava korisnika na češću ponovnu prijavu; duži rok (npr. 24h+) je udobniji ali povećava prozor rizika. Za ovaj diplomski/lokalni scenario 12h je razuman kompromis. Kad token istekne, backend vraća `401`, a frontend (`shared/api.js`) to prepoznaje, briše sesiju i vraća korisnika na login sa porukom da je sesija istekla (vidi ispod) - korisnik dakle nikad ne ostaje "zaglavljen" sa nevažećim tokenom bez objašnjenja.
- **Brute-force zaštita na loginu**: nakon 5 pogrešnih pokušaja lozinke zaredom, nalog se zaključava na 15 minuta (`User.FailedLoginAttempts` / `User.LockedUntil`).
- **MySQL lozinka**: `appsettings.json` sadrži `User=root;Password=;` (prazna lozinka za root korisnika). Ovo je namjerno i prihvatljivo za lokalni razvoj/diplomski rad, gdje se pretpostavlja lokalni MySQL bez posebne zaštite. **Na produkciji ovo obavezno treba promijeniti**: postaviti jaku lozinku za MySQL korisnika i ConnectionString premjestiti iz `appsettings.json` u User Secrets / environment varijablu (`ConnectionStrings__DefaultConnection`), na isti način kao i `Jwt:SecretKey` ispod, umjesto da stoji u plain-textu u repozitoriju.

## Pokretanje

> `Data.EF/Migrations` folder je uključen u repozitorijum - nije potrebno ručno
> generisati početnu migraciju. `dotnet run` (korak 4 ispod) sam kreira/ažurira
> bazu preko postojećih migracija (`db.Database.Migrate()`).

1. Instaliraj .NET 8 SDK i pokreni lokalni MySQL server.
2. U `DronBackend/appsettings.json` prilagodi `ConnectionStrings:DefaultConnection` (korisnik/lozinka za MySQL).
3. Podesi JWT tajni ključ (obavezno - aplikacija se ne pokreće bez njega, vidi sekciju "Sigurnosne mjere" iznad):
   ```
   cd DronBackend
   dotnet user-secrets init
   dotnet user-secrets set "Jwt:SecretKey" "<dugi-nasumican-string-min-32-karaktera>"
   ```
4. Pokreni API:
   ```
   cd DronBackend
   dotnet run
   ```
   Baza se automatski kreira/ažurira (`db.Database.Migrate()`) i puni test podacima pri prvom pokretanju.

   Ako ikad zatreba dodatna migracija (npr. nakon izmjene modela), generiši je na isti
   način kao i dosadašnje: `dotnet ef migrations add <Naziv> --project ../Data.EF --startup-project .`

## Test nalozi (isti kao u frontend login formi)

| Korisničko ime | Lozinka | Uloga |
|---|---|---|
| admin | admin123 | administrator |
| kontrola | kontrola123 | kontrola_leta |
| operater | operater123 | operater |

## Stanje projekta

- Frontend je u potpunosti povezan na ove endpointe (`shared/api.js`) — token sa `/api/auth/login` se čuva u `sessionStorage` i šalje kao `Authorization: Bearer {token}` header uz svaki zahtjev.
- Izvještaji (stranica "izvjestaji") i mapa letova (stranica "karta") su implementirani na frontendu — koriste postojeći `GET /api/letovi` i rade agregaciju/filtriranje/geokodiranje na klijentu, bez potrebe za dodatnim endpointima.
- `POST /api/letovi` je ograničen na `[Authorize(Roles = "administrator,operater")]` — nije dostupan svakom ulogovanom korisniku. Operater uvijek prijavljuje let na sebe; administrator može prijaviti let u ime bilo kojeg korisnika sa ulogom operater slanjem `OperatorId` polja (validira se da taj korisnik postoji i da ima tu ulogu).
- JWT token se dodatno provjerava PRI SVAKOM zahtjevu (ne samo pri izdavanju) - ako je nalog u međuvremenu deaktiviran, pristup se odmah gubi (umjesto da se čeka istek tokena); ako mu je promijenjena uloga, nova uloga važi odmah na sljedećem zahtjevu (`Program.cs`, `OnTokenValidated`).

## Mogući pravci daljeg razvoja

- Na admin panelu (frontend) i dalje ne postoji forma za DODAVANJE novog leta (samo operater/administrator preko `POST /api/letovi`, npr. sa operaterske stranice „Prijavi let“) — izmjena postojećeg leta (`PUT /api/letovi/{id}`) je dodata (admin/letovi → dugme „Izmijeni“).
- Stranica „Karta“ (kontrola) i dalje zavisi od interneta za neprepoznate lokacije (OpenStreetMap Nominatim) i za samu Leaflet biblioteku (CDN) - lokalni rječnik poznatih gradova/opština (`CITY_COORDS`) je proširen da pokrije više BiH opština i smanji tu zavisnost, ali potpuno offline rad nije moguć bez samostalnog hostovanja Leaflet fajlova i/ili potpune baze koordinata.
