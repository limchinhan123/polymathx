import type { AttachedFile } from "./types";

const MAX_CHARS = 8000;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS) + "\n\n[Document truncated for length]";
}

async function extractPdf(file: File): Promise<string> {
  // pdfjs-dist must run in browser (worker) — dynamic import keeps it client-side only
  const pdfjsLib = await import("pdfjs-dist");

  // Point the worker to the bundled asset. Next.js copies static files from public/.
  // We fall back to unpkg if the local worker isn't available yet (first load).
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return truncate(pages.join("\n\n").trim());
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return truncate(result.value.trim());
}

async function encodeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export async function processFile(file: File): Promise<AttachedFile> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File exceeds 10 MB limit");
  }

  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const text = await extractPdf(file);
    return { name, type: "pdf", text, isImage: false };
  }

  if (lower.endsWith(".docx")) {
    const text = await extractDocx(file);
    return { name, type: "docx", text, isImage: false };
  }

  if (/\.(jpe?g|png)$/i.test(lower)) {
    const base64 = await encodeImage(file);
    return { name, type: "image", base64, isImage: true };
  }

  throw new Error("Unsupported file type");
}
