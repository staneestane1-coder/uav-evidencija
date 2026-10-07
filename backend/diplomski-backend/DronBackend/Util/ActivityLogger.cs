using Data.EF;
using Data.EF.Models;
using System.Security.Claims;

namespace DronBackend.Util
{
    public static class ActivityLogger
    {
        // Loguje aktivnost na osnovu ulogovanog korisnika (iz JWT tokena zahtjeva)
        public static async Task LogAsync(
            AppDbContext db,
            ClaimsPrincipal principal,
            string activityType,
            string description,
            string? relatedEntity,
            string status)
        {
            var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            string actorName = "Nepoznat korisnik";

            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                var user = await db.Users.FindAsync(userId);
                if (user != null) actorName = $"{user.FirstName} {user.LastName}";
            }

            await LogAsync(db, actorName, activityType, description, relatedEntity, status);
        }

        // Loguje aktivnost kad još nema autentifikovanog principala (npr. prijava na sistem)
        public static async Task LogAsync(
            AppDbContext db,
            User actor,
            string activityType,
            string description,
            string? relatedEntity,
            string status)
        {
            await LogAsync(db, $"{actor.FirstName} {actor.LastName}", activityType, description, relatedEntity, status);
        }

        private static async Task LogAsync(
            AppDbContext db,
            string actorName,
            string activityType,
            string description,
            string? relatedEntity,
            string status)
        {
            db.ActivityLogs.Add(new ActivityLog
            {
                ActorName = actorName,
                ActivityType = activityType,
                Description = description,
                RelatedEntity = relatedEntity,
                Status = status,
                Timestamp = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
        }
    }
}
