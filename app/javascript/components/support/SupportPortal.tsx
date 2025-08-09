import {
  useConversations,
  useConversation,
  useRealtimeEvents,
  useCreateMessage,
  useCreateConversation,
  MessageContent,
} from "@helperai/react";
import debounce from "lodash/debounce";
import React from "react";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";

export default function SupportPortal() {
  const [selectedConversationSlug, setSelectedConversationSlug] = React.useState<string | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = React.useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Support</h1>
        <Button onClick={() => setIsNewTicketOpen(true)}>New ticket</Button>
      </div>

      {selectedConversationSlug == null ? (
        <ConversationList onSelect={setSelectedConversationSlug} />
      ) : (
        <ConversationDetail
          conversationSlug={selectedConversationSlug}
          onBack={() => setSelectedConversationSlug(null)}
        />
      )}

      <NewTicketModal
        open={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onCreated={(slug) => {
          setIsNewTicketOpen(false);
          setSelectedConversationSlug(slug);
        }}
      />
    </div>
  );
}

function ConversationList({ onSelect }: { onSelect: (slug: string) => void }) {
  const { data, isLoading, error, refetch } = useConversations();

  const refresh = React.useMemo(() => debounce(() => void refetch(), 300), [refetch]);

  React.useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Something went wrong.</div>;

  const conversations = data?.conversations ?? [];

  return (
    <div className="overflow-x-auto rounded border">
      <table className="divide-gray-200 min-w-full divide-y">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-gray-700 px-4 py-3 text-left text-sm font-medium">Subject</th>
            <th className="text-gray-700 px-4 py-3 text-left text-sm font-medium">Message count</th>
            <th className="text-gray-700 px-4 py-3 text-left text-sm font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody className="divide-gray-100 divide-y bg-white">
          {conversations.map((c) => (
            <tr key={c.slug} className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(c.slug)}>
              <td className="text-gray-900 px-4 py-3 text-sm">{c.subject}</td>
              <td className="text-gray-500 px-4 py-3 text-sm">{c.messageCount}</td>
              <td className="text-gray-500 px-4 py-3 text-sm">
                {c.latestMessageAt ? new Date(c.latestMessageAt).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversationDetail({ conversationSlug, onBack }: { conversationSlug: string; onBack: () => void }) {
  const { data: conversation, isLoading, error, refetch } = useConversation(conversationSlug);
  const { mutateAsync: createMessage } = useCreateMessage();

  useRealtimeEvents(conversation?.slug ?? "", { enabled: Boolean(conversation?.slug) });

  const [input, setInput] = React.useState("");

  if (isLoading) return <div>Loading...</div>;
  if (error || !conversation) return <div>Something went wrong.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={onBack}>Back</Button>
        <h2 className="text-xl font-semibold">{conversation.subject}</h2>
      </div>

      <div className="space-y-3">
        {conversation.messages.map(({ id, content, role, staffName, createdAt }) => (
          <div key={id} className="rounded border p-3">
            <div className="text-gray-500 mb-1 text-xs">
              <span className="font-medium">{role === "user" ? "You" : staffName || role}</span>
              <span> · {new Date(createdAt).toLocaleString()}</span>
            </div>
            <MessageContent message={{ content }} />
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            const trimmed = input.trim();
            if (!trimmed) return;
            await createMessage({ conversationSlug: conversation.slug, content: trimmed });
            setInput("");
            void refetch();
          })();
        }}
      >
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Type your message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}

function NewTicketModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const { mutateAsync: createConversation } = useCreateConversation();
  const { mutateAsync: createMessage } = useCreateMessage();

  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  return (
    <Modal open={open} onClose={onClose} title="New ticket">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            if (!subject.trim() || !message.trim()) return;
            setIsSubmitting(true);
            try {
              const { conversationSlug } = await createConversation({ subject: subject.trim() });
              await createMessage({ conversationSlug, content: message.trim() });
              onCreated(conversationSlug);
            } finally {
              setIsSubmitting(false);
            }
          })();
        }}
      >
        <div className="space-y-1">
          <label className="block text-sm font-medium">Subject</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium">Message</label>
          <textarea
            className="w-full rounded border px-3 py-2"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
