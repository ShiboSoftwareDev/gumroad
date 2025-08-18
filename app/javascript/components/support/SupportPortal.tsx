import type { Message } from "@helperai/client";
import {
  useConversations,
  useConversation,
  useRealtimeEvents,
  useCreateMessage,
  useCreateConversation,
  MessageContent,
} from "@helperai/react";
import pinkIcon from "images/pink-icon.png";
import placeholderImage from "images/placeholders/support.png";
import startCase from "lodash/startCase";
import React, { useEffect } from "react";

import FileUtils from "$app/utils/file";

import { Button } from "$app/components/Button";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import { FileRowContent } from "$app/components/FileRowContent";
import { Icon } from "$app/components/Icons";
import { Modal } from "$app/components/Modal";
import { showAlert } from "$app/components/server-components/Alert";
import { SupportHeader } from "$app/components/server-components/support/Header";
import { useGlobalEventListener } from "$app/components/useGlobalEventListener";
import { useOriginalLocation } from "$app/components/useOriginalLocation";

export default function SupportPortal() {
  const { searchParams } = new URL(useOriginalLocation());
  const [selectedConversationSlug, setSelectedConversationSlug] = React.useState<string | null>(searchParams.get("id"));
  const [isNewTicketOpen, setIsNewTicketOpen] = React.useState(!!searchParams.get("new_ticket"));

  useEffect(() => {
    const url = new URL(location.href);
    if (!isNewTicketOpen && url.searchParams.get("new_ticket")) {
      url.searchParams.delete("new_ticket");
      history.replaceState(null, "", url.toString());
    }
  }, [isNewTicketOpen]);

  useEffect(() => {
    const url = new URL(location.href);
    if (selectedConversationSlug) {
      url.searchParams.set("id", selectedConversationSlug);
    } else {
      url.searchParams.delete("id");
    }
    if (url.toString() !== window.location.href) history.pushState(null, "", url.toString());
  }, [selectedConversationSlug]);

  useGlobalEventListener("popstate", () => {
    const params = new URL(location.href).searchParams;
    setSelectedConversationSlug(params.get("id"));
    setIsNewTicketOpen(!!params.get("new_ticket"));
  });

  if (selectedConversationSlug != null) {
    return (
      <ConversationDetail
        conversationSlug={selectedConversationSlug}
        onBack={() => setSelectedConversationSlug(null)}
      />
    );
  }

  return (
    <>
      <main>
        <header>
          <SupportHeader onOpenNewTicket={() => setIsNewTicketOpen(true)} />
        </header>
        <ConversationList onSelect={setSelectedConversationSlug} onOpenNewTicket={() => setIsNewTicketOpen(true)} />
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

function MessageListItem({ message, isLastMessage }: { message: Message; isLastMessage: boolean }) {
  const [isExpanded, setIsExpanded] = React.useState(isLastMessage);
  const currentSeller = useCurrentSeller();
  const attachments = [...message.publicAttachments, ...message.privateAttachments];
  return (
    <div role="listitem">
      <div className="content">
        <img
          className="user-avatar !w-9"
          src={message.role === "user" ? (currentSeller?.avatarUrl ?? pinkIcon) : pinkIcon}
        />
        <div className={`font-bold ${isExpanded ? "flex-1" : ""}`}>
          {message.role === "user" ? (currentSeller?.name ?? "You") : message.staffName || startCase(message.role)}
        </div>
        <div className={isExpanded ? "hidden" : "ml-2 line-clamp-1 min-w-0 flex-1"}>
          <MessageContent message={message} />
        </div>
        <div className="whitespace-nowrap text-right">
          {new Date(message.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
      </div>
      <div className="actions">
        <Button
          outline
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse message" : "Expand message"}
        >
          {isExpanded ? <Icon name="outline-cheveron-up" /> : <Icon name="outline-cheveron-down" />}
        </Button>
      </div>
      {isExpanded ? (
        <div className="col-span-full pl-12">
          <MessageContent message={message} />
          {attachments.length > 0 ? (
            <div role="list" className="rows mt-4 w-full max-w-[500px]">
              {attachments.map((attachment) => (
                <div
                  role="listitem"
                  className={attachment.contentType?.startsWith("image/") ? "overflow-hidden !p-0" : ""}
                  key={attachment.url}
                >
                  {attachment.contentType?.startsWith("image/") ? (
                    <img src={attachment.url} alt={attachment.name ?? "Attachment"} className="w-full" />
                  ) : (
                    <FileRowContent
                      name={FileUtils.getFileNameWithoutExtension(attachment.name ?? "Attachment")}
                      extension={FileUtils.getFileExtension(attachment.name ?? "Attachment").toUpperCase()}
                      externalLinkUrl={null}
                      isUploading={false}
                      details={<li>{attachment.contentType?.split("/")[1]}</li>}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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

function ConversationDetail({ conversationSlug, onBack }: { conversationSlug: string; onBack: () => void }) {
  const { data: conversation, isLoading, error, refetch } = useConversation(conversationSlug);
  const { mutateAsync: createMessage, isPending: isSubmitting } = useCreateMessage({
    onError: (error) => {
      showAlert(error.message, "error");
    },
  });

  useRealtimeEvents(conversation?.slug ?? "", { enabled: Boolean(conversation?.slug) });

  const [input, setInput] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    await createMessage({ conversationSlug, content: trimmed, attachments });
    setInput("");
    setAttachments([]);
    void refetch();
  };

  if (isLoading) return <div>Loading...</div>;
  if (error || !conversation) return <div>Something went wrong.</div>;

  return (
    <main>
      <header className="!gap-0">
        <a className="no-underline" onClick={onBack}>
          <Icon name="arrow-left" /> Go back to Support tickets
        </a>
        <h1>{conversation.subject}</h1>
      </header>

      <div>
        <div role="list" className="rows mb-12" aria-label="Messages">
          {conversation.messages.map((message, index) => (
            <MessageListItem
              key={message.id}
              message={message}
              isLastMessage={index === conversation.messages.length - 1}
            />
          ))}
        </div>

        <form className="mt-4 flex flex-col gap-2" onSubmit={(e) => void handleSubmit(e)}>
          <label htmlFor="reply">Reply</label>
          <textarea
            className="mb-2 flex-1 rounded border px-3 py-2"
            placeholder="Write a reply"
            id="reply"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
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
            <div role="list" className="rows mb-2" aria-label="Files">
              {attachments.map((file, index) => (
                <div role="listitem" key={`${file.name}-${index}`}>
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
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
              Attach files
            </Button>
            <Button type="submit" color="primary" disabled={isSubmitting || !input.trim()}>
              {isSubmitting ? "Sending..." : "Send reply"}
            </Button>
          </div>
        </form>
      </div>
    </main>
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
  const { mutateAsync: createConversation } = useCreateConversation({
    onError: (error) => {
      showAlert(error.message, "error");
    },
  });
  const { mutateAsync: createMessage } = useCreateMessage({
    onError: (error) => {
      showAlert(error.message, "error");
    },
  });

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
              <div role="listitem" key={`${file.name}-${index}`}>
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
