import { useConversations } from "@helperai/react";
import placeholderImage from "images/placeholders/support.png";
import React from "react";

import { Button } from "$app/components/Button";

export function ConversationList({
  onSelect,
  onOpenNewTicket,
}: {
  onSelect: (slug: string) => void;
  onOpenNewTicket: () => void;
}) {
  const { data, isLoading, error } = useConversations();

  if (isLoading) return null;
  if (error) return <div>Something went wrong.</div>;

  const conversations = data?.conversations ?? [];

  if (conversations.length === 0) {
    return (
      <section>
        <div className="placeholder">
          <figure>
            <img src={placeholderImage} />
          </figure>
          <h2>Need a hand? We're here for you.</h2>
          <p>
            Got a question about selling, payouts, or your products? Send us a message and we'll reply right here so you
            can get back to creating.
          </p>
          <Button color="accent" onClick={onOpenNewTicket}>
            Contact support
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Message count</th>
            <th>Last updated</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr key={c.slug} aria-selected={false} onClick={() => onSelect(c.slug)}>
              <td>{c.subject}</td>
              <td>{c.messageCount}</td>
              <td>{c.latestMessageAt ? new Date(c.latestMessageAt).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
