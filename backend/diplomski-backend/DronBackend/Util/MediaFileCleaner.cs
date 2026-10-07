namespace DronBackend.Util
{
    // Brise fizicke fajlove sa diska za listu relativnih putanja (Media.FilePath).
    // Koristi se u DronoviController/LetoviController.Delete NAKON uspjesnog SaveChangesAsync
    // (kad su redovi vec kaskadno obrisani iz baze) - EF Core kaskadno brise redove u Media
    // tabeli, ali nikad i same fajlove na disku, pa bi bez ovoga svako brisanje drona/leta
    // ostavljalo "osirotele" fajlove u App_Data/uploads zauvijek (vidi izvjestaj testiranja).
    public static class MediaFileCleaner
    {
        public static void DeleteFiles(IWebHostEnvironment env, IEnumerable<string> relativePaths)
        {
            foreach (var relativePath in relativePaths)
            {
                try
                {
                    var fullPath = Path.Combine(env.ContentRootPath, relativePath);
                    if (File.Exists(fullPath))
                        File.Delete(fullPath);
                }
                catch
                {
                    // Best-effort ciscenje diska - red u bazi je vec obrisan, ne zelimo da
                    // zahtjev pukne samo zato sto fizicki fajl nije mogao biti uklonjen
                    // (npr. zakljucan od strane drugog procesa).
                }
            }
        }
    }
}
