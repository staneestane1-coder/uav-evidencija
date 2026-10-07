using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.EF.Migrations
{
    /// <inheritdoc />
    public partial class DodajPotvrduOdbijanja : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RejectionAcknowledged",
                table: "Flights",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RejectionAcknowledged",
                table: "Flights");
        }
    }
}
