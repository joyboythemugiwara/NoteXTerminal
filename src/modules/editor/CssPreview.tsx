import { useEffect, useRef } from "react";

type Props = {
  content: string;
};

export function CssPreview({ content }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 2rem; 
              background: white;
              color: black;
            }
            .preview-container { max-width: 600px; margin: 0 auto; }
            section { margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1rem; }
            h2 { color: #666; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; }
            
            /* User CSS Start */
            ${content}
            /* User CSS End */
          </style>
        </head>
        <body>
          <div class="preview-container">
            <section>
              <h2>Typography</h2>
              <h1>Heading 1</h1>
              <h2>Heading 2</h2>
              <h3>Heading 3</h3>
              <p>This is a paragraph of text. <strong>Bold text</strong>, <em>italic text</em>, and a <a href="#">link</a>.</p>
            </section>
            
            <section>
              <h2>Buttons</h2>
              <button>Default Button</button>
              <button class="primary">Primary</button>
              <button class="secondary">Secondary</button>
            </section>
            
            <section>
              <h2>Forms</h2>
              <input type="text" placeholder="Text input..." />
              <br><br>
              <textarea placeholder="Textarea..."></textarea>
            </section>

            <section>
              <h2>Components</h2>
              <div class="card">
                <h3>Card Title</h3>
                <p>This is a simple card component example.</p>
              </div>
            </section>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();
  }, [content]);

  return (
    <div className="h-full w-full bg-white">
      <iframe
        ref={iframeRef}
        title="CSS Preview"
        className="h-full w-full border-none"
        sandbox="allow-scripts"
      />
    </div>
  );
}
