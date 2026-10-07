using Data.EF;
using Data.EF.Models;
using DronBackend.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DronBackend.Controllers
{
    // Evidencija svih dešavanja u sistemu - dostupno samo administratoru
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "administrator")]
    public class AktivnostiController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AktivnostiController(AppDbContext db)
        {
            _db = db;
        }

        private static ActivityLogResponse ToDto(ActivityLog a) => new()
        {
            Id = a.Id,
            ActorName = a.ActorName,
            ActivityType = a.ActivityType,
            Description = a.Description,
            RelatedEntity = a.RelatedEntity,
            Status = a.Status,
            Timestamp = a.Timestamp
        };

        // GET api/aktivnosti?limit=200
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ActivityLogResponse>>> GetAll([FromQuery] int limit = 200)
        {
            var logs = await _db.ActivityLogs
                .OrderByDescending(a => a.Timestamp)
                .Take(limit)
                .ToListAsync();

            return Ok(logs.Select(ToDto));
        }
    }
}
