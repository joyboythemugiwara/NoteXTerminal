import { useEffect, useRef } from "react";

type Props = {
  content: string;
};

export function HtmlPreview({ content }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Use srcdoc for safer rendering and easier content updates
    // We wrap the content in a basic structure to ensure it renders correctly
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(content);
      doc.close();
    }
  }, [content]);

  return (
    <div className="h-full w-full bg-white">
      <iframe
        ref={iframeRef}
        title="HTML Preview"
        className="h-full w-full border-none"
        sandbox="allow-scripts"
      />
    </div>
  );
}
