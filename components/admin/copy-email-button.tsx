"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="admin-secondary" type="button" onClick={async () => { await navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy email"}</button>;
}
