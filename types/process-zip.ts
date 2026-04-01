import type { ZipLayoutReport } from "@/types/zip-layout";

export type ProcessZipResult =
  | {
      ok: true;
      message: string;
      stats: {
        totalFiles: number;
        htmlFiles: number;
        imageFiles: number;
        htmlFilesScanned: number;
        imageTags: number;
        imagesMissingAlt: number;
        layout: ZipLayoutReport;
        ocrImagesProcessed: number;
        ocrImagesSkippedCap: number;
        ocrTextsEmpty: number;
        altsInjected: number;
        htmlFilesUpdated: number;
        downloadToken: string | null;
      };
    }
  | { ok: false; message: string };
