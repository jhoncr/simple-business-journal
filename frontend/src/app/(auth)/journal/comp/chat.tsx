import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import { DBentry } from "../../../../lib/custom_types";
import { AccessMap } from "@/../../backend/functions/src/common/schemas/common_schemas";
import { Button } from "@/components/ui/button";
import { ChevronsUp, User } from "lucide-react";
import { Entry } from "./Entry";
import { useFetchEntries } from "./useFetch";
import { useAuth } from "@/lib/auth_handler";
import { AddInventoryEntryForm } from "../journal-types/inventory/add-inventory-entry";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap"; // Import EntryType

//TODO: handle delete of entries
interface MessageListProps {
  messages: DBentry[];
  journalId: string; // --- ADD journalId ---
  entryType: EntryType; // --- ADD entryType ---
  access: AccessMap;
  loading: boolean;
  role: string; // Logged-in user's role
  BottomFn?: () => void;
  removeFn: (entry: DBentry) => void;
}
const MessageList = memo(function MessageList({
  messages,
  journalId, // Get prop
  entryType, // Get prop
  access,
  loading,
  role,
  BottomFn,
  removeFn,
}: MessageListProps) {
  const [showToTopButton, setShowToTopButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
      console.log("scrolling");
      setShowToTopButton(scrollTop > 10);
      // check if we are at the bottom of the page and user is scrolling down
      if (scrollTop + clientHeight >= scrollHeight - 1) {
        BottomFn && BottomFn();
      }
    },
    [BottomFn],
  );

  const ButtonGoTop = () => {
    const goTopFn = useCallback(() => {
      // smooth scroll to top
      console.log("scrolling to top");
      // scroll to top if the scrollTop function is available
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: -10,
          behavior: "smooth",
        });
      }
    }, []);

    return (
      // Show this button on top of the scroll
      <Button
        // show button on top center of the scroll component
        className={`h-14 w-14 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-50 absolute top-10 left-1/2 bg-primary
            ${showToTopButton ? "visible" : "invisible"}`}
        variant="outline"
        onClick={goTopFn}
      >
        <ChevronsUp />
      </Button>
    );
  };

  const Loading = () => {
    return (
      <div className="w-full h-14">
        {loading ? (
          <p className="text-center text-xs">Loading...</p>
        ) : (
          <p className="text-center text-xs">No more entries</p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full relative">
      <ButtonGoTop />
      <div
        className="w-full flex flex-col overflow-y-auto h-screen space-y-2"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {messages.map((entry: DBentry) => {
          const creatorInfo = access[entry.createdBy];
          if (!creatorInfo) {
            console.warn(
              `Creator info missing for user ID: ${entry.createdBy} on entry ${entry.id}`,
            );
            // Optionally render a placeholder or skip
            // return null;
          }
          // Ensure the fallback object includes all required fields for the User type
          // If creatorInfo exists, spread it and add the uid. Otherwise, use the fallback.
          const userProps = creatorInfo
            ? { ...creatorInfo, uid: entry.createdBy } // Add uid from entry.createdBy
            : {
                uid: entry.createdBy, // Use the creatorBy ID as the fallback uid
                displayName: "Unknown User",
                email: "", // Provide a default empty string or placeholder
                role: "viewer", // Provide a default role or handle appropriately
                // photoURL is optional
              };
          return entry?.createdBy ? (
            <Entry
              key={entry.id}
              journalId={journalId} // --- Pass journalId ---
              entryType={entryType} // --- Pass entryType ---
              entry={entry}
              user={userProps} // Pass creator info or fallback with required fields
              removeFn={removeFn}
              role={role} // Pass logged-in user's role
            />
          ) : null;
        })}
        <Loading />
      </div>
    </div>
  );
});

interface ChatBoxProps {
  journalId: string; // Changed journalId to journalId
  entryType: EntryType; // --- ADD entryType ---
  access: AccessMap;
  actionButton: React.ReactNode;
  filterList: DBentry[]; // Assuming filter list is of the same entryType
  hasFilter: boolean;
  // journalType is replaced by entryType
  removeFilterEntry: (entry: DBentry) => void;
}
// Create a component to render the chat box
export function ChatBox({
  journalId, // Use journalId
  entryType, // --- Get entryType ---
  access,
  actionButton,
  filterList,
  hasFilter,
  removeFilterEntry,
}: ChatBoxProps) {
  const [page, setPage] = useState(0);
  // --- Update useFetchEntries if needed ---
  const { loading, error, list, removeEntry } = useFetchEntries(
    journalId,
    entryType,
    page,
  ); // Pass entryType
  const { authUser } = useAuth();
  const viewerRole = (authUser && access[authUser.uid]?.role) || "viewer"; // Get viewer role safely

  const handleAtBottom = useCallback(() => {
    console.log("AtBottom Function called");
    setPage((prevPage) => prevPage + 1); // Use functional update
  }, []);

  // Render the chat box, if on mobile, the chat box will be full screen
  // if on desktop, the chat box will cover 2/3 of the screen
  return (
    <div className="h-full flex flex-col space-y-1 md:max-w-2xl w-full mx-auto">
      {" "}
      {/* Added mx-auto */}
      {authUser &&
        (hasFilter ? (
          <MessageList
            messages={filterList}
            journalId={journalId} // Pass journalId
            entryType={entryType} // Pass entryType
            access={access}
            BottomFn={handleAtBottom} // Pass directly
            loading={loading}
            role={viewerRole} // Pass viewer role
            removeFn={removeFilterEntry}
          />
        ) : (
          <MessageList
            messages={list}
            journalId={journalId} // Pass journalId
            entryType={entryType} // Pass entryType
            access={access}
            BottomFn={handleAtBottom} // Pass directly
            loading={loading}
            role={viewerRole} // Pass viewer role
            removeFn={removeEntry}
          />
        ))}
      <div
        id="action-btn"
        className="fixed bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-content h-content"
      >
        {actionButton}
      </div>
    </div>
  );
}
