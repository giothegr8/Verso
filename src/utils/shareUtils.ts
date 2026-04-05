export const handleShare = async (title: string, text: string, url: string, onToast: (msg: string) => void) => {
  const shareData = {
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

  try {
    // Check if sharing is supported and allowed
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      onToast("Shared successfully!");
    } else {
      await copyToClipboard();
    }
  } catch (err: any) {
    // If the user cancelled the share, do nothing
    if (err.name === 'AbortError') {
      return;
    }
    
    // If share is not allowed or fails for other reasons, fallback to clipboard
    await copyToClipboard();
  }
};
