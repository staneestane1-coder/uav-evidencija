using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.EF.Migrations
{
    /// <inheritdoc />
    public partial class DodajOdobrenjeLeta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Flights",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "RequestedStatus",
                table: "Flights",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "Flights",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewedByUserId",
                table: "Flights",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Flights_ReviewedByUserId",
                table: "Flights",
                column: "ReviewedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Flights_Users_ReviewedByUserId",
                table: "Flights",
                column: "ReviewedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Flights_Users_ReviewedByUserId",
                table: "Flights");

            migrationBuilder.DropIndex(
                name: "IX_Flights_ReviewedByUserId",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "RequestedStatus",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "Flights");

            migrationBuilder.DropColumn(
                name: "ReviewedByUserId",
                table: "Flights");
        }
    }
}
