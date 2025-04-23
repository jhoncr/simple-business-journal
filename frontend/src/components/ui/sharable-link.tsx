"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SharableLinkProps {
  link: string;
  maxDisplayLength?: number;
  className?: string;
}

export function SharableLink({
  link,
  maxDisplayLength = 50,
  className = "",
}: SharableLinkProps) {
  const [copied, setCopied] = useState(false);

  const displayLink =
    link.length > maxDisplayLength
      ? `${link.substring(
          0,
          Math.floor(maxDisplayLength / 2),
        )}...${link.substring(link.length - Math.floor(maxDisplayLength / 2))}`
      : link;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Card className={`flex items-center p-2 w-full ${className}`}>
      <div className="flex-1 min-w-0 mr-2">
        <p className="text-sm truncate" title={link}>
          {displayLink}
        </p>
      </div>
      {/* <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild> */}
      <Button
        variant="outline"
        size="sm"
        onClick={copyToClipboard}
        aria-label="Copy link to clipboard"
        className="flex-shrink-0"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="ml-2 hidden sm:inline">
          {copied ? "Copied!" : "Copy"}
        </span>
      </Button>
      {/* </TooltipTrigger>
          <TooltipContent> */}
      {/* <p>{copied ? "Copied to clipboard!" : "Copy to clipboard"}</p>
          </TooltipContent> */}
      {/* </Tooltip>
      </TooltipProvider> */}
    </Card>
  );
}
