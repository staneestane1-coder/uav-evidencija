using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Data.EF.Models
{
    public class Flight
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int DroneId { get; set; }
        public Drone? Drone { get; set; }

        [Required]
        public int OperatorId { get; set; }
        public User? Operator { get; set; }

        public string? Location { get; set; }

        [Required]
        public DateTime FlightDateTime { get; set; } = DateTime.UtcNow;

        public int? DurationMinutes { get; set; }

        // planiran | u-letu | zavrsen | na-cekanju | odbijen
        [Required]
        public string Status { get; set; } = "zavrsen";

        // Status koji je operater originalno tražio (planiran/u-letu/zavrsen) - postavlja se
        // kad let ide na odobrenje (Status = "na-cekanju") i aktivira nakon što ga kontrola
        // odobri (LetoviController.Odobri). Null za letove koje direktno kreira administrator
        // (ne prolaze kroz odobrenje) i za letove kreirane prije uvođenja ovog toka.
        public string? RequestedStatus { get; set; }

        public int? ReviewedByUserId { get; set; }
        public User? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? RejectionReason { get; set; }

        // Da li je operater potvrdio da je vidio odbijanje leta - isti princip kao
        // WarningAcknowledged ispod (LetoviController.PotvrdiOdbijanje).
        public bool RejectionAcknowledged { get; set; } = false;

        // Upozorenje koje kontrola leta salje operateru dok je let "u-letu" (npr. "Spustite
        // dron, ulazite u zabranjenu zonu"). Ne mijenja Status leta - samo komunikacijski
        // kanal koji operater mora potvrditi da je procitao (LetoviController.PotvrdiUpozorenje).
        public string? Warning { get; set; }
        public DateTime? WarningAt { get; set; }
        public int? WarningByUserId { get; set; }
        public User? WarningBy { get; set; }
        public bool WarningAcknowledged { get; set; } = false;

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Media> MediaFiles { get; set; } = new List<Media>();
    }
}
