export const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopyTextToClipboard(text);
      }
    } catch (err) {
      console.warn('Clipboard API failed, using fallback', err);
      fallbackCopyTextToClipboard(text);
    }
  };
  
  export const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Copy failed', err);
    }
    document.body.removeChild(textArea);
  };
  