namespace DronBackend.Dto
{
    public class CreateFlightRequest
    {
        public int DroneId { get; set; }

        // Opciono - SAMO administrator smije da ga postavi (npr. unos leta u ime
        // operatera). Ako je poslato, backend provjerava da odabrani korisnik zaista
        // postoji i da ima ulogu "operater" (LetoviController.Create). Ako korisnik
        // sa ulogom "operater" pošalje ovo polje, backend ga ignoriše i uvijek koristi
        // njegov sopstveni nalog - operater ne smije "podmetnuti" let drugom operateru.
        public int? OperatorId { get; set; }

        public string? Location { get; set; }
        public DateTime FlightDateTime { get; set; } = DateTime.UtcNow;
        public int? DurationMinutes { get; set; }
        public string Status { get; set; } = "zavrsen"; // planiran | u-letu | zavrsen
        public string? Note { get; set; }
    }

    public class UpdateFlightRequest
    {
        public int DroneId { get; set; }
        public string? Location { get; set; }
        public DateTime FlightDateTime { get; set; }
        public int? DurationMinutes { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Note { get; set; }
    }

    public class FlightResponse
    {
        public int Id { get; set; }
        public int DroneId { get; set; }
        public string? DroneName { get; set; }
        public int OperatorId { get; set; }
        public string? OperatorName { get; set; }
        public string? Location { get; set; }
        public DateTime FlightDateTime { get; set; }
        public int? DurationMinutes { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? RequestedStatus { get; set; }
        public int? ReviewedByUserId { get; set; }
        public string? ReviewedByName { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? RejectionReason { get; set; }
        public bool RejectionAcknowledged { get; set; }
        public string? Warning { get; set; }
        public DateTime? WarningAt { get; set; }
        public string? WarningByName { get; set; }
        public bool WarningAcknowledged { get; set; }
        public string? Note { get; set; }
        public List<MediaResponse> MediaFiles { get; set; } = new();
    }

    public class RejectFlightRequest
    {
        public string? Razlog { get; set; }
    }

    public class SendWarningRequest
    {
        public string Poruka { get; set; } = string.Empty;
    }

    public class MediaResponse
    {
        public int Id { get; set; }
        public int? FlightId { get; set; }
        public int? DroneId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
    }
}
