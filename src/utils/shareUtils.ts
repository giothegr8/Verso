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

// --- Prepared share image cache ---------------------------------------------
// The share image is generated when the Share modal OPENS and cached here, so
// the Share button click can call navigator.share synchronously while the
// browser's transient user activation is still valid. The previous behavior
// generated the image (toBlob) inside the click handler; that asynchronous work
// consumed the activation and made navigator.share reject with AbortError, which
// was then silently swallowed. Preparing ahead of the click removes that race.
export interface PreparedShareImage {
  blob: Blob;
  file: File;
  filename: string;
}

let preparedImage: PreparedShareImage | null = null;

// Generate the share image once and cache it. Returns the prepared image, or
// null when the element is missing or rendering fails. Safe to call repeatedly;
// callers should only re-run when the rendered card content actually changes.
export async function prepareShareImage(
  elementId: string,
  filename: string
): Promise<PreparedShareImage | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    preparedImage = null;
    return null;
  }
  try {
    // Ensure fonts are loaded before capture so the card renders correctly.
    await document.fonts.ready;
    const blob = await toBlob(element, {
      cacheBust: true,
      pixelRatio: 3,
      skipAutoScale: true,
    });
    if (!blob) {
      preparedImage = null;
      return null;
    }
    const file = new File([blob], filename, { type: 'image/png' });
    preparedImage = { blob, file, filename };
    return preparedImage;
  } catch (err) {
    console.error("Share image preparation failed", err);
    preparedImage = null;
    return null;
  }
}

// Drop the cached image (called when the modal closes or its content changes).
export function clearPreparedShareImage() {
  preparedImage = null;
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

  // 1. Reuse the image prepared when the modal opened so the FIRST async share
  //    operation below is navigator.share itself — preserving user activation.
  //    Only a legacy caller that never prepared an image (e.g. the path-review
  //    flow) falls back to generating once here; that degraded path may lose
  //    activation but still resolves through the visible fallback chain.
  let blob: Blob | null = null;
  let file: File | null = null;
  if (preparedImage && preparedImage.filename === actualFilename) {
    blob = preparedImage.blob;
    file = preparedImage.file;
  } else if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        await document.fonts.ready;
        blob = await toBlob(element, {
          cacheBust: true,
          pixelRatio: 3,
          skipAutoScale: true,
        });
        file = blob ? new File([blob], actualFilename, { type: 'image/png' }) : null;
      } catch (imgErr) {
        console.error("Share image generation failed", imgErr);
        blob = null;
        file = null;
      }
    }
  }

  // Final fallback: download the already-generated blob (no re-render). This is
  // the same mechanism the explicit Download Image button uses.
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

  // 2. Native file sharing through the OS share sheet, when supported. Because
  //    the image was prepared before the click, this is the first async share
  //    operation and runs while activation is valid.
  if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      onToast("Shared successfully!");
      return;
    } catch (err: any) {
      // A user-dismissed OS share sheet is a genuine cancellation. The image was
      // prepared ahead of the click, so activation was valid and AbortError here
      // means the user backed out — not an activation failure. Surface it
      // visibly (no silent return) but do NOT force a download.
      if (err && err.name === 'AbortError') {
        onToast("Share canceled.");
        return;
      }
      // Every other error (NotAllowedError, TypeError, InvalidStateError,
      // DataError, SecurityError, …) is a real failure, NOT a cancellation:
      // continue to the clipboard / download fallbacks below.
      console.error("Native share failed", err);
    }
  }

  // 3. Image clipboard fallback.
  if (await copyImageToClipboard()) {
    onToast("Image copied — paste it anywhere.");
    return;
  }

  // 4. Automatic image download fallback.
  if (downloadBlob()) {
    onToast("Image downloaded — attach it to your message.");
    return;
  }

  // 5. Nothing worked (typically no image could be generated at all): never end
  //    silently — show a visible final error.
  onToast("Could not share, copy, or download the image.");
};
