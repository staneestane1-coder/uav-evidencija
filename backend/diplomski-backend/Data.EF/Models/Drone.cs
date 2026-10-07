using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Data.EF.Models
{
    public class Drone
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string Model { get; set; } = string.Empty;

        [Required]
        public string Manufacturer { get; set; } = string.Empty;

        [Required]
        public string SerialNumber { get; set; } = string.Empty;

        // dodijeljen operater (opciono)
        public int? OperatorId { get; set; }
        public User? Operator { get; set; }

        // aktivan | servis | neaktivan
        [Required]
        public string Status { get; set; } = "aktivan";

        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Flight> Flights { get; set; } = new List<Flight>();

        // Fotografije, video zapisi i tehnička dokumentacija vezani direktno za letjelicu
        // (npr. atest ispravnosti, uputstvo, fotografija drona) - neovisno od pojedinačnih letova.
        public ICollection<Media> MediaFiles { get; set; } = new List<Media>();
    }
}
