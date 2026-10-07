namespace DronBackend.Dto
{
    public class ActivityLogResponse
    {
        public int Id { get; set; }
        public string ActorName { get; set; } = string.Empty;
        public string ActivityType { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? RelatedEntity { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }
}
