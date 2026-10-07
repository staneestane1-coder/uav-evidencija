using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.EF.Migrations
{
    /// <inheritdoc />
    public partial class DodajUpozorenjeLeta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Warning",
                table: "Flights",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "WarningAcknowledged",
                table: "Flights",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "WarningAt",
                table: "Flights",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarningByUserId",
                table: "Flights",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Flights_WarningByUserId",
                table: "Flights",
                column: "WarningByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Flights_Users_WarningByUserId",
                table: "Flights",
                column: "WarningByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Flights_Users_WarningByUserId",
                table: "Flights");

            migrationBuilder.DropIndex(
                name: "IX_Flights_WarningByUserId",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "Warning",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "WarningAcknowledged",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "WarningAt",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "WarningByUserId",
                table: "Flights");
        }
    }
}
