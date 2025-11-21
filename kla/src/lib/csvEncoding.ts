const DEFAULT_ENCODINGS: readonly string[] = ["utf-8", "windows-1250", "windows-1252", "iso-8859-1"];

export type CsvFileContents = {
  text: string;
  encoding: string;
};

export async function readCsvFileContents(
  file: File,
  encodings: readonly string[] = DEFAULT_ENCODINGS
): Promise<CsvFileContents> {
  const buffer = await file.arrayBuffer();
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      const text = decoder.decode(buffer);
      return { text, encoding };
    } catch {
      // Try next encoding option.
    }
  }
  const text = new TextDecoder("utf-8").decode(buffer);
  return { text, encoding: "utf-8" };
}

export const CSV_DECODER_PREFERENCES = DEFAULT_ENCODINGS;
