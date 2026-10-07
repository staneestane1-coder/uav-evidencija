using System.Text.Json;
using System.Text.Json.Serialization;

namespace DronBackend.Util
{
    // MySQL/Pomelo EF Core provider vraca DateTime kolone sa Kind=Unspecified (MySQL DATETIME
    // tip nema pojam vremenske zone) - iako je vrijednost STVARNO uvijek UTC (aplikacija svuda
    // koristi DateTime.UtcNow pri upisu). System.Text.Json podrazumijevano serijalizuje
    // Kind=Unspecified BEZ "Z" oznake (npr. "2026-07-30T19:18:00"), pa frontend (new Date(iso))
    // takav string tumaci kao LOKALNO vrijeme umjesto UTC - rezultat je pomak u prikazu jednak
    // razlici vremenske zone servera (npr. 2h za UTC+2), vidljivo kod planiranih letova i svugdje
    // gdje se datum/vrijeme prikazuje korisniku. Ovaj converter eksplicitno oznacava SVAKI
    // DateTime kao Utc prije serijalizacije, cime izlaz uvijek dobija "Z" i frontend ga ispravno
    // tumaci kao UTC. Registruje se globalno u Program.cs (AddJsonOptions).
    public class UtcDateTimeJsonConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var value = reader.GetDateTime();
            return value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
                : value.ToUniversalTime();
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        {
            var utcValue = value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
                : value.ToUniversalTime();
            writer.WriteStringValue(utcValue);
        }
    }
}
