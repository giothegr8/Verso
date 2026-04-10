import { toPng, toBlob } from 'html-to-image';

export const handleShare = async (
  title: string, 
  text: string, 
  url: string, 
  onToast: (msg: string) => void,
  elementId?: string
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
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#FDFCFB', // Default light background
      });
      const link = document.createElement('a');
      link.download = `verso-${Date.now()}.png`;
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
          const blob = await toBlob(element, {
            cacheBust: true,
            backgroundColor: '#FDFCFB',
          });
          if (blob) {
            const file = new File([blob], `verso-${Date.now()}.png`, { type: 'image/png' });
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
