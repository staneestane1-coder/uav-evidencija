using System.Net;
using System.Net.Mail;

namespace DronBackend.Services
{
    // Jednostavan SMTP klijent (System.Net.Mail, ugrađen u .NET - bez dodatnog NuGet paketa)
    // podešen za slanje preko Mailtrap-a (test SMTP servis) u razvoju. Isti kod radi i sa bilo
    // kojim drugim standardnim SMTP relay-em u produkciji - mijenja se samo appsettings/User
    // Secrets podešavanje (Smtp:Host/Port/Username/Password), ne kod.
    public class SmtpEmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public SmtpEmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string recipientFullName, string resetLink)
        {
            var host = _configuration["Smtp:Host"];
            if (string.IsNullOrWhiteSpace(host))
                throw new InvalidOperationException(
                    "Smtp:Host nije podešen. Popuni Smtp sekciju u appsettings.json (Mailtrap host/port), " +
                    "i Smtp:Username/Smtp:Password preko User Secrets.");

            var port = _configuration.GetValue<int?>("Smtp:Port") ?? 587;
            var username = _configuration["Smtp:Username"];
            var password = _configuration["Smtp:Password"];
            var enableSsl = _configuration.GetValue<bool?>("Smtp:EnableSsl") ?? true;
            var fromEmail = _configuration["Smtp:FromEmail"] ?? "no-reply@uav-evidencija.local";
            var fromName = _configuration["Smtp:FromName"] ?? "UAV Evidencija";

            using var message = new MailMessage
            {
                From = new MailAddress(fromEmail, fromName),
                Subject = "Reset lozinke - UAV Evidencija",
                Body = BuildHtmlBody(recipientFullName, resetLink),
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                Credentials = string.IsNullOrEmpty(username) ? null : new NetworkCredential(username, password)
            };

            await client.SendMailAsync(message);
        }

        private static string BuildHtmlBody(string recipientFullName, string resetLink)
        {
            return $"""
                <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:480px;margin:0 auto;color:#1a2733;">
                    <h2 style="color:#0d1b2a;">Zahtjev za reset lozinke</h2>
                    <p>Poštovani/a {WebUtility.HtmlEncode(recipientFullName)},</p>
                    <p>Primili smo zahtjev za reset lozinke za Vaš nalog u sistemu UAV Evidencija.
                    Kliknite na dugme ispod da postavite novu lozinku:</p>
                    <p style="text-align:center;margin:28px 0;">
                        <a href="{resetLink}" style="background:#0078d4;color:#ffffff;text-decoration:none;
                            padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">
                            Resetuj lozinku
                        </a>
                    </p>
                    <p>Ako dugme ne radi, kopirajte sljedeći link u pretraživač:<br>
                    <a href="{resetLink}">{resetLink}</a></p>
                    <p><strong>Ovaj link ističe za 1 sat.</strong></p>
                    <p>Ako niste Vi zatražili reset lozinke, slobodno ignorišite ovaj email -
                    Vaša lozinka ostaje nepromijenjena.</p>
                    <hr style="border:none;border-top:1px solid #dde3ea;margin:24px 0;">
                    <p style="font-size:12px;color:#7a8794;">Ovo je automatska poruka sistema UAV Evidencija, ne odgovarajte na nju.</p>
                </div>
                """;
        }
    }
}
