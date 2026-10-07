using Data.EF.Models;
using Microsoft.AspNetCore.Identity;

namespace Data.EF.Seed
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(AppDbContext context, PasswordHasher<User> hasher)
        {
            if (context.Users.Any())
                return;

            var now = DateTime.UtcNow;

            // Bootstrap - SAMO administrator. Namjerno se seeduje jedino ovaj nalog: da bi se
            // uopšte moglo ući u aplikaciju prvi put. Svi ostali korisnici, dronovi, letovi i
            // snimci se NE seeduju direktno u bazu - unose se kroz stvarne akcije u samoj
            // aplikaciji (UI/API), isto kao što bi to radio pravi administrator/operater/
            // kontrola leta, tako da ActivityLog dobije stvaran, prirodan trag tih akcija
            // umjesto da ostane prazan (vidi ActivityLogger - poziva se iz kontrolera, ne iz
            // seedera).
            var admin = new User
            {
                UserName = "admin",
                FirstName = "Marko",
                LastName = "Stanišić",
                Email = "admin@uav-evidencija.local",
                Role = "administrator",
                Status = "aktivan",
                CreatedAt = now
            };
            admin.PasswordHash = hasher.HashPassword(admin, "admin123");
            admin.PasswordChangedAt = admin.CreatedAt;

            context.Users.Add(admin);
            await context.SaveChangesAsync();
        }
    }
}
