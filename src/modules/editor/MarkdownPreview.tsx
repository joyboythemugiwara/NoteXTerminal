import { marked } from "marked";
import { useEffect, useState } from "react";
import "github-markdown-css/github-markdown.css";

type Props = {
  content: string;
};

export function MarkdownPreview({ content }: Props) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    const parse = async () => {
      const parsed = await marked.parse(content);
      setHtml(parsed);
    };
    parse();
  }, [content]);

  return (
    <div className="h-full w-full overflow-y-auto bg-white p-6 dark:bg-[#0d1117]">
      <div
        className="markdown-body mx-auto max-w-3xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
