# UAV Evidencija

**Web platforma za nadzor i evidenciju bespilotnih letjelica** — diplomski rad.

Sistem za evidenciju dronova, prijavu i praćenje letova, upload fotografija/videa/dokumentacije i nadzor aktivnosti korisnika, sa tri različite korisničke uloge i JWT autentifikacijom.

## Sadržaj

- [Korištene tehnologije](#korištene-tehnologije)
- [Struktura repozitorija](#struktura-repozitorija)
- [Uloge korisnika](#uloge-korisnika)
- [Glavne funkcionalnosti](#glavne-funkcionalnosti)
- [Pokretanje projekta](#pokretanje-projekta)
- [Test nalozi](#test-nalozi)
- [Sigurnosne mjere](#sigurnosne-mjere)

## Korištene tehnologije

**Backend**
- ASP.NET Core Web API (.NET 8)
- Entity Framework Core + MySQL (Pomelo.EntityFrameworkCore.MySql)
- JWT (JSON Web Token) autentifikacija i autorizacija po ulogama
- Swagger / Swashbuckle (dokumentacija API-ja)
- xUnit (testovi)

**Frontend**
- HTML5, CSS3, vanilla JavaScript (bez frameworka)
- [Leaflet](https://leafletjs.com/) – prikaz letova na karti
- OpenStreetMap Nominatim – geokodiranje lokacija

## Struktura repozitorija

```
uav-evidencija/
├── backend/
│   └── diplomski-backend/
│       ├── Data.EF/              # DbContext, modeli, migracije, seed podaci
│       ├── DronBackend/          # Web API (Controllers, Dto, Util, Program.cs)
│       └── DronBackend.Tests/    # xUnit testovi
└── frontend/
    └── frontend-v7.5/
        ├── admin/                # dashboard administratora
        ├── kontrola/             # dashboard kontrole leta
        ├── operater/             # dashboard operatera
        ├── login/                # prijava, reset lozinke
        └── shared/                # zajednički JS/CSS (API klijent, autentifikacija, UI komponente)
```

Detaljan opis backend entiteta i API endpointa: [`backend/diplomski-backend/README.md`](backend/diplomski-backend/README.md).

## Uloge korisnika

| Uloga | Pristup |
|---|---|
| **Administrator** | Puno upravljanje sistemom: korisnici, dronovi, letovi (uključujući izmjenu i brisanje), snimci/dokumentacija, pregled svih aktivnosti |
| **Kontrola leta** (`kontrola_leta`) | Uvid u operatere, dronove i letove (bez izmjene/brisanja letova), karta aktivnih letova, izvještaji |
| **Operater** | Prijava i pregled sopstvenih letova, pregled dodijeljenih dronova, upload fotografija/videa/dokumentacije za svoje letove i dronove |

## Glavne funkcionalnosti

- Evidencija dronova (naziv, model, proizvođač, serijski broj, dodijeljeni operater, status)
- Prijava i praćenje letova (lokacija, datum/vrijeme, trajanje, status: planiran / u letu / završen)
- Upload i pregled fotografija, videa i tehničke dokumentacije vezane za letove i dronove
- Karta letova (Leaflet + geokodiranje lokacija)
- Izvještaji i agregirani pregledi letova
- Evidencija aktivnosti korisnika (ko je šta i kada uradio u sistemu)
- Prijava putem JWT-a, sa automatskim odjavljivanjem po isteku tokena i zaštitom od brute-force napada na login

## Pokretanje projekta

### Backend

Preduslovi: .NET 8 SDK i lokalni MySQL server.

```bash
cd backend/diplomski-backend/DronBackend

# 1. Podesi konekciju na bazu u appsettings.json (ConnectionStrings:DefaultConnection)

# 2. Podesi JWT tajni ključ (obavezno - app se ne pokreće bez njega)
dotnet user-secrets init
dotnet user-secrets set "Jwt:SecretKey" "<dugi-nasumican-string-min-32-karaktera>"

# 3. Pokreni API (baza se automatski kreira/ažurira i puni test podacima)
dotnet run
```

API se podiže na `https://localhost:7229` (Swagger dostupan na `/swagger`).

Detaljnije (struktura, endpointi, sigurnosne mjere): [`backend/diplomski-backend/README.md`](backend/diplomski-backend/README.md).

### Frontend

Frontend je statičan HTML/CSS/JS i ne zahtijeva build korak — poslužuje se preko bilo kog lokalnog web servera (npr. VS Code ekstenzija "Live Server").

```bash
cd frontend/frontend-v7.5
# pokreni Live Server (ili ekvivalentan statički server) i otvori:
# login/login.html
```

Ako backend radi na drugom portu od podrazumijevanog, prilagodi `API_BASE_URL` u `frontend/frontend-v7.5/shared/api-config.js`.

## Test nalozi

| Korisničko ime | Lozinka | Uloga |
|---|---|---|
| admin | admin123 | administrator |
| kontrola | kontrola123 | kontrola_leta |
| operater | operater123 | operater |

> Ovo su seed lozinke namijenjene za lokalno pokretanje/testiranje projekta i obavezno ih treba promijeniti u bilo kom produkcionom okruženju.

## Sigurnosne mjere

- JWT tajni ključ i lozinka za bazu **nisu** hardkodovani u kodu — čuvaju se preko .NET User Secrets (lokalno) ili environment varijabli (produkcija)
- Lozinke korisnika: minimum 8 karaktera, obavezno slovo i broj, provjera i na backendu i na frontendu
- Zaključavanje naloga na 15 minuta nakon 5 pogrešnih pokušaja prijave
- JWT token se provjerava pri svakom zahtjevu (ne samo pri izdavanju) — deaktivacija naloga ili promjena uloge djeluje odmah, bez čekanja da token istekne

Detaljnije u [`backend/diplomski-backend/README.md`](backend/diplomski-backend/README.md#sigurnosne-mjere).
