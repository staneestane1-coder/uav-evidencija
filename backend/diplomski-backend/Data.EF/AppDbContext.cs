using Data.EF.Models;
using Microsoft.EntityFrameworkCore;

namespace Data.EF
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> contextOptions) : base(contextOptions)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Drone> Drones { get; set; }
        public DbSet<Flight> Flights { get; set; }
        public DbSet<Media> MediaFiles { get; set; }
        public DbSet<ActivityLog> ActivityLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>()
                .HasIndex(u => u.UserName).IsUnique();
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email).IsUnique();

            modelBuilder.Entity<Drone>()
                .HasIndex(d => d.SerialNumber).IsUnique();

            modelBuilder.Entity<Drone>()
                .HasOne(d => d.Operator)
                .WithMany(u => u.Drones)
                .HasForeignKey(d => d.OperatorId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Flight>()
                .HasOne(f => f.Drone)
                .WithMany(d => d.Flights)
                .HasForeignKey(f => f.DroneId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Flight>()
                .HasOne(f => f.Operator)
                .WithMany(u => u.Flights)
                .HasForeignKey(f => f.OperatorId)
                .OnDelete(DeleteBehavior.Restrict);

            // Ko je iz kontrole odobrio/odbio let - za razliku od Operator (Restrict), brisanje
            // korisnika iz kontrole ne smije biti blokirano prošlim pregledanim letovima, pa
            // se FK samo postavlja na null (istorija leta ostaje, samo bez imena revizora).
            modelBuilder.Entity<Flight>()
                .HasOne(f => f.ReviewedBy)
                .WithMany()
                .HasForeignKey(f => f.ReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Ko je iz kontrole poslao upozorenje - isti razlog kao ReviewedBy iznad (brisanje
            // korisnika iz kontrole ne smije biti blokirano prošlim upozorenjima).
            modelBuilder.Entity<Flight>()
                .HasOne(f => f.WarningBy)
                .WithMany()
                .HasForeignKey(f => f.WarningByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Media>()
                .HasOne(m => m.Flight)
                .WithMany(f => f.MediaFiles)
                .HasForeignKey(m => m.FlightId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Media>()
                .HasOne(m => m.Drone)
                .WithMany(d => d.MediaFiles)
                .HasForeignKey(m => m.DroneId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
