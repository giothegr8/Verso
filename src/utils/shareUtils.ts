import { toBlob } from 'html-to-image';
import { getLocalizedBookName } from './verseUtils';

export function getVerseFilename(book: string, chapter: string | number, verse: string | number, isSpanish: boolean): string {
  const locBook = getLocalizedBookName(book, isSpanish ? 'es' : 'en');
  const normalizedBook = locBook
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const cleanBook = normalizedBook
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const cleanChapter = String(chapter).replace(/[^0-9]+/g, "-");
  
  const cleanVerse = String(verse)
    .replace(/[^0-9\-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `verso-${cleanBook}-${cleanChapter}-${cleanVerse}.png`;
}

export const handleShare = async (
  title: string,
  text: string,
  url: string,
  onToast: (msg: string) => void,
  elementId?: string,
  filename?: string
) => {
  const actualFilename = filename || `verso-${Date.now()}.png`;

  // 1. Generate the share image exactly once and reuse the single blob for every
  //    path below. No path regenerates the image.
  let blob: Blob | null = null;
  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        await document.fonts.ready;
        blob = await toBlob(element, {
          cacheBust: true,
          pixelRatio: 3,
          skipAutoScale: true,
        });
      } catch (imgErr) {
        console.error("Share image generation failed", imgErr);
        blob = null;
      }
    }
  }
  const file = blob ? new File([blob], actualFilename, { type: 'image/png' }) : null;

  // Final fallback: download the already-generated blob (no re-render).
  const downloadBlob = (): boolean => {
    if (!blob) return false;
    try {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = actualFilename;
      link.href = objectUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return true;
    } catch (err) {
      console.error("Share image download failed", err);
      return false;
    }
  };

  // Clipboard fallback: copy the generated IMAGE (not text) when the platform
  // supports image clipboard writes.
  const copyImageToClipboard = async (): Promise<boolean> => {
    if (!blob) return false;
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
      return false;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch (err) {
      console.error("Share image clipboard write failed", err);
      return false;
    }
  };

  // 2. Native file sharing through the OS share sheet, when supported.
  if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      onToast("Shared successfully!");
      return;
    } catch (err: any) {
      // 9. A user-cancelled native share is a cancellation, not a failure: stop
      //    here without forcing a download.
      if (err && err.name === 'AbortError') {
        return;
      }
      console.error("Native share failed", err);
      // Otherwise fall through to the clipboard / download fallbacks.
    }
  }

  // 3. Image clipboard fallback.
  if (await copyImageToClipboard()) {
    onToast("Image copied — paste it anywhere.");
    return;
  }

  // 4. Download fallback.
  if (downloadBlob()) {
    onToast("Image downloaded — attach it to your message.");
    return;
  }

  // Safety net when no image could be generated at all, so the button never does
  // nothing: share or copy the text/link instead.
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      onToast("Shared successfully!");
      return;
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        return;
      }
      console.error("Text share failed", err);
    }
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      onToast("Copied to clipboard!");
      return;
    }
  } catch (err) {
    console.error("Text clipboard write failed", err);
  }
  onToast("Could not share or copy.");
};
