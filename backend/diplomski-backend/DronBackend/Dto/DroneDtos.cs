namespace DronBackend.Dto
{
    public class CreateDroneRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Manufacturer { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public int? OperatorId { get; set; }
        public string Status { get; set; } = "aktivan"; // aktivan | servis | neaktivan
        public string? Notes { get; set; }
    }

    public class UpdateDroneRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Manufacturer { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public int? OperatorId { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class DroneResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Manufacturer { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public int? OperatorId { get; set; }
        public string? OperatorName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public List<MediaResponse> MediaFiles { get; set; } = new();
    }
}
