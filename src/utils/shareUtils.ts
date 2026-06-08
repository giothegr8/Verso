import { toPng, toBlob } from 'html-to-image';
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
  const shareData: ShareData = {
    title,
    text,
    url,
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        const fullText = `${text}\n\n${url}`;
        await navigator.clipboard.writeText(fullText);
        onToast("Copied to clipboard!");
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch (clipboardErr) {
      onToast("Could not share or copy.");
    }
  };

  const downloadImage = async (element: HTMLElement) => {
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 3,
        skipAutoScale: true,
      });
      const link = document.createElement('a');
      link.download = filename || `verso-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      onToast("Image downloaded!");
    } catch (err) {
      onToast("Could not download image.");
    }
  };

  try {
    let files: File[] = [];
    
    // Try to generate image if elementId is provided
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        try {
          await document.fonts.ready;
          const blob = await toBlob(element, {
            cacheBust: true,
            pixelRatio: 3,
            skipAutoScale: true,
          });
          if (blob) {
            const actualFilename = filename || `verso-${Date.now()}.png`;
            const file = new File([blob], actualFilename, { type: 'image/png' });
            files = [file];
          }
        } catch (imgErr) {
          console.error("Image generation failed", imgErr);
        }
      }
    }

    // Check if sharing is supported
    if (navigator.share) {
      const dataToShare: ShareData = { ...shareData };
      
      // Add files if supported
      if (files.length > 0 && navigator.canShare && navigator.canShare({ files })) {
        dataToShare.files = files;
      }

      await navigator.share(dataToShare);
      onToast("Shared successfully!");
    } else {
      // Fallback: Download image if available, otherwise copy to clipboard
      if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
          await downloadImage(element);
        } else {
          await copyToClipboard();
        }
      } else {
        await copyToClipboard();
      }
    }
  } catch (err: any) {
    // If the user cancelled the share, do nothing
    if (err.name === 'AbortError') {
      return;
    }
    
    // If share fails, fallback to download/clipboard
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        await downloadImage(element);
      } else {
        await copyToClipboard();
      }
    } else {
      await copyToClipboard();
    }
  }
};
