using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Data.EF.Models;
using Microsoft.IdentityModel.Tokens;

namespace DronBackend.Util
{
    public static class JwtTokenHelper
    {
        public static string GenerateToken(User user, IConfiguration configuration)
        {
            var secretKey = configuration["Jwt:SecretKey"];
            if (string.IsNullOrWhiteSpace(secretKey))
                throw new InvalidOperationException("JWT SecretKey is missing - podesi ga preko User Secrets ili environment varijable Jwt__SecretKey.");
            var issuer = configuration["Jwt:Issuer"];
            var audience = configuration["Jwt:Audience"];

            // Rok trajanja tokena je konfigurabilan (Jwt:ExpiresInHours u appsettings.json),
            // podrazumijevano 12h ako nije podešeno ili je podešena nevažeća vrijednost.
            // Vidi README ("Sigurnosne mjere") za smjernice oko izbora vrijednosti.
            const int defaultExpiresInHours = 12;
            var expiresInHours = configuration.GetValue<int?>("Jwt:ExpiresInHours") ?? defaultExpiresInHours;
            if (expiresInHours <= 0) expiresInHours = defaultExpiresInHours;

            // "iat" (issued at) NIJE automatski dio tokena - JwtSecurityToken konstruktor koji
            // koristimo (bez notBefore) ga ne postavlja sam. Eksplicitno ga dodajemo kao claim
            // jer Program.cs (OnTokenValidated) njime provjerava da li je token izdat PRIJE
            // posljednje promjene lozinke (User.PasswordChangedAt) - bez ove linije bi ta
            // provjera tiho "no-op"-ovala i stari tokeni bi ostajali validni i poslije promjene
            // lozinke (vidi izvještaj testiranja, nalaz #7).
            var issuedAtUnix = ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeSeconds().ToString();

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.UserName),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(JwtRegisteredClaimNames.Iat, issuedAtUnix, ClaimValueTypes.Integer64)
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(expiresInHours),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
