namespace DronBackend.Util
{
    // Provjerava da PRVI BAJTOVI otpremljenog fajla ("magic number"/potpis formata) odgovaraju
    // ekstenziji iz naziva fajla - sprjecava da neko zaobidje provjeru ekstenzije u
    // SnimciController tako sto ce proizvoljan (npr. izvrsni) fajl preimenovati u ".jpg" ili
    // ".pdf" (vidi izvjestaj testiranja). Namjerno permisivna za formate kod kojih pouzdan,
    // univerzalan potpis prakticno ne postoji (mp4/mov/avi imaju desetine legitimnih varijanti
    // kontejnera; .doc je stariji binarni OLE format sa vise mogucih zaglavlja) - za njih se i
    // dalje prihvata sadrzaj na osnovu ekstenzije, isto kao ranije. Za formate sa jasnim,
    // stabilnim potpisom (slike, pdf, docx) provjera je stroga.
    public static class FileSignatureValidator
    {
        public static bool MatchesExtension(string extension, byte[] header)
        {
            switch (extension)
            {
                case ".jpg":
                case ".jpeg":
                    return header.Length >= 3 &&
                        header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;

                case ".png":
                    return header.Length >= 8 &&
                        header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
                        header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A;

                case ".webp":
                    // RIFF....WEBP - bajtovi 4-7 su velicina fajla (varira), zato se preskacu
                    return header.Length >= 12 &&
                        header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
                        header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;

                case ".pdf":
                    return header.Length >= 4 &&
                        header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46; // %PDF

                case ".docx":
                    // .docx je zapravo ZIP arhiva (Open XML) - PK.. potpis
                    return header.Length >= 4 &&
                        header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04;

                default:
                    // .mp4/.mov/.avi/.doc - nema jednog pouzdanog potpisa za sve legitimne
                    // varijante, prihvata se na osnovu ekstenzije kao i do sada.
                    return true;
            }
        }
    }
}
