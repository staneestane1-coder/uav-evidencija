using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Data.EF.Models
{
    public class Media
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        // Snimak/dokument je vezan ILI za konkretan let ILI direktno za letjelicu (dron) - nikad za oba
        // istovremeno. To pokriva i "otpremanje fotografija/video zapisa vezanih za let" i "otpremanje
        // fotografija/video zapisa/tehničke dokumentacije za letjelicu" iz obrazloženja teme.
        public int? FlightId { get; set; }
        public Flight? Flight { get; set; }

        public int? DroneId { get; set; }
        public Drone? Drone { get; set; }

        [Required]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string FilePath { get; set; } = string.Empty; // relativna putanja u wwwroot/uploads

        [Required]
        public string ContentType { get; set; } = string.Empty; // image | video (mime type)

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
