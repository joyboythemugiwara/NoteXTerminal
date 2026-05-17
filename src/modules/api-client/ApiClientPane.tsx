import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SentIcon,
  Delete02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

type Header = {
  key: string;
  value: string;
  enabled: boolean;
};

type ApiResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
};

export function ApiClientPane() {
  const [method, setMethod] = useState<Method>("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<Header[]>([
    { key: "Content-Type", value: "application/json", enabled: true },
  ]);
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    const start = Date.now();
    try {
      const headerMap: Record<string, string> = {};
      for (const h of headers) {
        if (h.enabled && h.key) headerMap[h.key] = h.value;
      }

      const res = await invoke<{
        status: number;
        headers: Record<string, string>;
        body: number[];
      }>("http_request", {
        url,
        method,
        headers: headerMap,
        body: body ? Array.from(new TextEncoder().encode(body)) : null,
        allowPrivateNetwork: true,
      });

      const end = Date.now();
      const bodyText = new TextDecoder().decode(new Uint8Array(res.body));
      
      setResponse({
        status: res.status,
        headers: res.headers,
        body: bodyText,
        time: end - start,
        size: res.body.length,
      });
    } catch (e) {
      setError(String(e));
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [url, method, headers, body]);

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "", enabled: true }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, patch: Partial<Header>) => {
    setHeaders(headers.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const statusColor = useMemo(() => {
    if (!response) return "";
    if (response.status >= 200 && response.status < 300) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (response.status >= 400) return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  }, [response]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Address Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
          <SelectTrigger className="w-[110px] h-9 font-bold bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET" className="text-blue-500 font-bold">GET</SelectItem>
            <SelectItem value="POST" className="text-green-500 font-bold">POST</SelectItem>
            <SelectItem value="PUT" className="text-yellow-500 font-bold">PUT</SelectItem>
            <SelectItem value="DELETE" className="text-red-500 font-bold">DELETE</SelectItem>
            <SelectItem value="PATCH" className="text-purple-500 font-bold">PATCH</SelectItem>
            <SelectItem value="HEAD" className="text-muted-foreground font-bold">HEAD</SelectItem>
            <SelectItem value="OPTIONS" className="text-muted-foreground font-bold">OPTIONS</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-9 bg-background"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button 
          onClick={handleSend} 
          disabled={loading || !url}
          className="h-9 px-4 gap-2"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <HugeiconsIcon icon={SentIcon} size={16} />
          )}
          Send
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="request" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-border bg-muted/10 px-3 h-10 shrink-0">
            <TabsList className="bg-transparent h-full p-0 gap-4">
              <TabsTrigger 
                value="request" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1"
              >
                Request
              </TabsTrigger>
              <TabsTrigger 
                value="response" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1"
              >
                Response
              </TabsTrigger>
            </TabsList>
            
            {response && (
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <Badge variant="outline" className={cn("px-2 py-0 h-5", statusColor)}>
                  {response.status}
                </Badge>
                <span className="text-muted-foreground">{response.time}ms</span>
                <span className="text-muted-foreground">{(response.size / 1024).toFixed(2)} KB</span>
              </div>
            )}
          </div>

          <TabsContent value="request" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
            <Tabs defaultValue="body" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="bg-muted/30 w-full justify-start rounded-none h-8 px-3 border-b border-border shrink-0">
                <TabsTrigger value="body" className="h-6 text-[11px]">Body</TabsTrigger>
                <TabsTrigger value="headers" className="h-6 text-[11px]">Headers</TabsTrigger>
              </TabsList>
              
              <TabsContent value="body" className="flex-1 m-0 p-3 overflow-hidden">
                <Textarea 
                  placeholder="Request body (JSON, text, etc.)"
                  className="h-full resize-none font-mono text-sm bg-muted/20 border-border"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </TabsContent>
              
              <TabsContent value="headers" className="flex-1 m-0 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={h.enabled} 
                          onChange={(e) => updateHeader(i, { enabled: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-background"
                        />
                        <Input 
                          placeholder="Key" 
                          value={h.key}
                          onChange={(e) => updateHeader(i, { key: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                        <Input 
                          placeholder="Value" 
                          value={h.value}
                          onChange={(e) => updateHeader(i, { value: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeHeader(i)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addHeader}
                      className="h-8 gap-2 text-xs"
                    >
                      <HugeiconsIcon icon={PlusSignIcon} size={12} />
                      Add Header
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="response" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
            {error && (
              <div className="p-4 flex flex-col items-center justify-center h-full text-center">
                <div className="text-red-500 font-bold mb-2">Request Failed</div>
                <div className="text-muted-foreground text-sm font-mono max-w-md break-all">{error}</div>
              </div>
            )}
            
            {!response && !error && !loading && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Send a request to see the response
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="text-sm text-muted-foreground">Sending request...</span>
                </div>
              </div>
            )}

            {response && (
              <Tabs defaultValue="body" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="bg-muted/30 w-full justify-start rounded-none h-8 px-3 border-b border-border shrink-0">
                  <TabsTrigger value="body" className="h-6 text-[11px]">Body</TabsTrigger>
                  <TabsTrigger value="headers" className="h-6 text-[11px]">Headers</TabsTrigger>
                </TabsList>
                
                <TabsContent value="body" className="flex-1 m-0 p-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <pre className="p-3 font-mono text-sm whitespace-pre-wrap break-all">
                      {response.body}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="headers" className="flex-1 m-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-3">
                      <table className="w-full text-xs font-mono">
                        <tbody>
                          {Object.entries(response.headers).map(([k, v]) => (
                            <tr key={k} className="border-b border-border/50 last:border-0">
                              <td className="py-1.5 pr-4 text-muted-foreground align-top whitespace-nowrap">{k}</td>
                              <td className="py-1.5 break-all">{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
