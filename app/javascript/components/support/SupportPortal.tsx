import {
  useConversations,
  useConversation,
  useRealtimeEvents,
  useCreateMessage,
  useCreateConversation,
  MessageContent,
} from "@helperai/react";
import placeholderImage from "images/placeholders/support.png";
import React, { useEffect } from "react";

import FileUtils from "$app/utils/file";

import { Button } from "$app/components/Button";
import { FileRowContent } from "$app/components/FileRowContent";
import { Icon } from "$app/components/Icons";
import { Modal } from "$app/components/Modal";
import { SupportHeader } from "$app/components/server-components/support/Header";
import { useOriginalLocation } from "$app/components/useOriginalLocation";

export default function SupportPortal() {
  const [selectedConversationSlug, setSelectedConversationSlug] = React.useState<string | null>(null);
  const { searchParams } = new URL(useOriginalLocation());
  const [isNewTicketOpen, setIsNewTicketOpen] = React.useState(!!searchParams.get("new_ticket"));

  useEffect(() => {
    if (!isNewTicketOpen && new URL(location.href).searchParams.get("new_ticket")) {
      history.replaceState(null, "", location.pathname);
    }
  }, [isNewTicketOpen]);

  return (
    <>
      <main>
        <header>
          <SupportHeader onOpenNewTicket={() => setIsNewTicketOpen(true)} />
        </header>

        {selectedConversationSlug == null ? (
          <ConversationList onSelect={setSelectedConversationSlug} onOpenNewTicket={() => setIsNewTicketOpen(true)} />
        ) : (
          <ConversationDetail
            conversationSlug={selectedConversationSlug}
            onBack={() => setSelectedConversationSlug(null)}
          />
        )}
      </main>
      <NewTicketModal
        open={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onCreated={(slug) => {
          setIsNewTicketOpen(false);
          setSelectedConversationSlug(slug);
        }}
      />
    </>
  );
}

function ConversationList({
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
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How can we help you today?"
      footer={
        <>
          <Button onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
            Attach files
          </Button>
          <Button
            color="accent"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isSubmitting || !subject.trim() || !message.trim()}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        className="space-y-4 md:w-[700px]"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            if (!subject.trim() || !message.trim()) return;
            setIsSubmitting(true);
            try {
              const { conversationSlug } = await createConversation({ subject: subject.trim() });
              await createMessage({ conversationSlug, content: message.trim(), attachments });
              onCreated(conversationSlug);
            } finally {
              setIsSubmitting(false);
            }
          })();
        }}
      >
        <label className="sr-only">Subject</label>
        <input value={subject} placeholder="Subject" onChange={(e) => setSubject(e.target.value)} />
        <label className="sr-only">Message</label>
        <textarea
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your issue or question..."
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length === 0) return;
            setAttachments((prev) => [...prev, ...files]);
            e.currentTarget.value = "";
          }}
        />
        {attachments.length > 0 ? (
          <div role="list" className="rows" aria-label="Files">
            {attachments.map((file, index) => (
              <div role="listitem" key={`${file.name}-${index}`} className="content actions">
                <div className="content">
                  <FileRowContent
                    name={FileUtils.getFileNameWithoutExtension(file.name)}
                    extension={FileUtils.getFileExtension(file.name).toUpperCase()}
                    externalLinkUrl={null}
                    isUploading={false}
                    details={<li>{FileUtils.getReadableFileSize(file.size)}</li>}
                  />
                </div>
                <div className="actions">
                  <Button
                    outline
                    color="danger"
                    aria-label="Remove"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Icon name="trash2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
