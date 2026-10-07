using System.ComponentModel.DataAnnotations;

namespace Data.EF.Models
{
    public class ActivityLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string ActorName { get; set; } = string.Empty;

        // let | dron | korisnik | sistem
        [Required]
        public string ActivityType { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        // npr. naziv drona ili korisnika na koji se aktivnost odnosi
        public string? RelatedEntity { get; set; }

        // uspjesno | novo | upozorenje | greska
        [Required]
        public string Status { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
