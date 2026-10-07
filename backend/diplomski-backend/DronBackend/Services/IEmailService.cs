namespace DronBackend.Services
{
    public interface IEmailService
    {
        // Šalje email sa linkom za reset lozinke (vidi AuthController.ForgotPassword).
        Task SendPasswordResetEmailAsync(string toEmail, string recipientFullName, string resetLink);
    }
}
