using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Data.EF.Models
{
    public class User
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public string UserName { get; set; } = string.Empty;

        [Required]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        // administrator | kontrola_leta | operater
        [Required]
        public string Role { get; set; } = "operater";

        // aktivan | neaktivan
        [Required]
        public string Status { get; set; } = "aktivan";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Zaštita od brute-force napada na login (vidi AuthController.Login)
        public int FailedLoginAttempts { get; set; } = 0;
        public DateTime? LockedUntil { get; set; }

        // Vrijeme posljednje promjene lozinke - JWT tokeni izdati PRIJE ovog trenutka se
        // odbijaju čim se lozinka promijeni (vidi OnTokenValidated u Program.cs), umjesto da
        // ostanu validni do prirodnog isteka (Jwt:ExpiresInHours) i nakon namjerne promjene
        // lozinke (npr. zbog kompromitovanog naloga).
        public DateTime PasswordChangedAt { get; set; } = DateTime.UtcNow;

        // "Zaboravljena lozinka" tok (vidi AuthController.ForgotPassword/ResetPassword) -
        // token se postavlja pri zahtjevu za reset, sa rokom trajanja od 1h, i briše se čim
        // se iskoristi (jednokratan) ili kad istekne. Null van aktivnog reset zahtjeva.
        public string? PasswordResetToken { get; set; }
        public DateTime? PasswordResetTokenExpiry { get; set; }

        public ICollection<Drone> Drones { get; set; } = new List<Drone>();
        public ICollection<Flight> Flights { get; set; } = new List<Flight>();
    }
}
