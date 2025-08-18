import React from "react";
import { createCast } from "ts-safe-cast";

import { register } from "$app/utils/serverComponentUtil";

import { Button } from "$app/components/Button";
import { useOriginalLocation } from "$app/components/useOriginalLocation";

export function SupportHeader({ onOpenNewTicket }: { onOpenNewTicket: () => void; newTicketUrl?: string }) {
  const { pathname } = new URL(useOriginalLocation());
  const isHelpArticle =
    pathname.startsWith(Routes.help_center_root_path()) && pathname !== Routes.help_center_root_path();

  return (
    <>
      <h1 className="hidden group-[.sidebar-nav]/body:block">Help</h1>
      <h1 className="group-[.sidebar-nav]/body:hidden">
        <a href={Routes.root_path()} className="flex items-center">
          <img src="logo.svg" alt="Gumroad" className="h-8 dark:invert" width={32} height={32} />
        </a>
      </h1>
      <div className="actions">
        {isHelpArticle ? (
          <a href={Routes.help_center_root_path()} className="button" aria-label="Search" title="Search">
            <span className="icon icon-solid-search"></span>
          </a>
        ) : (
          <Button color="accent" onClick={onOpenNewTicket}>
            New ticket
          </Button>
        )}
      </div>
      <div role="tablist">
        <a
          href={Routes.help_center_root_path()}
          role="tab"
          aria-selected={pathname.startsWith(Routes.help_center_root_path())}
          className="pb-2"
        >
          Articles
        </a>
        <a
          href={Routes.support_index_path()}
          role="tab"
          aria-selected={pathname.startsWith(Routes.support_index_path())}
          className="border-b-2 pb-2"
        >
          Support tickets
        </a>
      </div>
    </>
  );
}

const Wrapper = ({ new_ticket_url }: { new_ticket_url: string }) => (
  <SupportHeader onOpenNewTicket={() => (window.location.href = new_ticket_url)} />
);

export default register({ component: Wrapper, propParser: createCast() });
