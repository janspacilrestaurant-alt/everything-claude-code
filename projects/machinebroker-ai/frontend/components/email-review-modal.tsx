"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, type Communication, type Match, type TargetParty } from "@/lib/api";

interface Props {
  matchId: string;
  match: Match;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailReviewDialog({ matchId, match, open, onOpenChange }: Props) {
  const [comms, setComms] = useState<Communication[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .communicationsForMatch(matchId)
      .then(async (existing) => {
        if (cancelled) return;
        if (existing.length === 0) {
          // Force-generate drafts on the fly if none exist yet.
          await api.forceDraft(matchId);
          const fresh = await api.communicationsForMatch(matchId);
          if (!cancelled) setComms(fresh);
        } else {
          setComms(existing);
        }
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, matchId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review emails for this match</DialogTitle>
          <DialogDescription>
            Drafts are auto-generated and localized. Edit either side, then click Send. The buyer
            draft never exposes the seller&apos;s contact or source URL.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading drafts…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {comms && (
          <div className="grid gap-6 lg:grid-cols-2">
            {(["buyer", "seller"] as TargetParty[]).map((party) => {
              const comm = comms.find((c) => c.target_party === party);
              const recipient = party === "buyer" ? match.demand : match.supply;
              if (!comm) {
                return (
                  <div key={party} className="rounded border p-4 text-sm text-muted-foreground">
                    No {party} draft yet.
                  </div>
                );
              }
              return (
                <EmailPanel
                  key={comm.id}
                  comm={comm}
                  recipient={recipient.contact_email}
                  onUpdated={(updated) =>
                    setComms((cs) => cs?.map((c) => (c.id === updated.id ? updated : c)) ?? null)
                  }
                />
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmailPanel({
  comm,
  recipient,
  onUpdated,
}: {
  comm: Communication;
  recipient: string;
  onUpdated: (c: Communication) => void;
}) {
  const [subject, setSubject] = useState(comm.subject);
  const [body, setBody] = useState(comm.email_content);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = subject !== comm.subject || body !== comm.email_content;
  const sent = comm.sent_status === "sent";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateCommunication(comm.id, {
        subject,
        email_content: body,
      });
      onUpdated(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    if (dirty) await save();
    setSending(true);
    setError(null);
    try {
      const result = await api.sendCommunication(comm.id);
      onUpdated({
        ...comm,
        subject,
        email_content: body,
        sent_status: result.sent_status,
        error_message: result.error_message,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 className="font-semibold capitalize">{comm.target_party}</h3>
          <p className="text-xs text-muted-foreground">
            To: <span className="font-mono">{recipient}</span> · Language: {comm.language}
          </p>
        </div>
        <Badge variant={sent ? "success" : comm.sent_status === "failed" ? "destructive" : "outline"}>
          {comm.sent_status}
        </Badge>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Subject</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sent} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Body</label>
        <Textarea
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sent}
          className="font-sans"
        />
      </div>

      {comm.error_message && (
        <p className="text-xs text-destructive">Last error: {comm.error_message}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={save} disabled={!dirty || saving || sent}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button onClick={send} disabled={sending || sent}>
          {sent ? "Sent" : sending ? "Sending…" : "Send email"}
        </Button>
      </div>
    </div>
  );
}
