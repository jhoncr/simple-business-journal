import { Coins, Package, List, FileText, PencilRuler } from "lucide-react";
import { CashFlowEntry } from "./cash-flow/CashFlowEntry";
import { InventoryItemEntry } from "./inventory/InventoryItemEntry";
import { AddInventoryEntryForm } from "./inventory/add-inventory-entry";
import { AddLogEntryForm } from "./cash-flow/add-cf-entry";
import React from "react";
import { AddNewQuoteBtn } from "./quote/addQuote";
import { QuoteEntry } from "./quote/QuoteEntry";
import { DBentry } from "@/lib/custom_types";
import { EntryViewProps } from "../comp/EntryView";

const JOURNAL_CONFIG: {
  [key: string]: {
    icon: React.ReactNode;
    title: string;
    entryComponent: React.ComponentType<EntryViewProps<DBentry>> | null;
    addEntryForm?: React.ComponentType<{ journalId: string }> | null;
  };
} = {
  cashflow: {
    icon: <Coins className="h-4 w-4" />,
    title: "Simple Cashflow",
    entryComponent: CashFlowEntry,
    addEntryForm: AddLogEntryForm,
  },
  inventory: {
    icon: <Package className="h-4 w-4" />,
    title: "Inventory",
    entryComponent: InventoryItemEntry,
    addEntryForm: AddInventoryEntryForm,
  },
  quote: {
    icon: <PencilRuler className="h-4 w-4" />,
    title: "Quotes",
    entryComponent: QuoteEntry,
    addEntryForm: AddNewQuoteBtn,
  },
  group: {
    icon: <FileText className="h-4 w-4" />,
    title: "Group",
    entryComponent: null,
    addEntryForm: null,
  },
};

export const getJournalIcon = (type: string) => {
  return JOURNAL_CONFIG[type as keyof typeof JOURNAL_CONFIG]?.icon ?? null;
};

export const getEntryComponent = (type: string) => {
  return (
    JOURNAL_CONFIG[type as keyof typeof JOURNAL_CONFIG]?.entryComponent ?? null
  );
};

export const getJournalOptions = () => {
  return Object.entries(JOURNAL_CONFIG).map(([key, value]) => ({
    value: key,
    label: value.title,
    icon: value.icon,
  }));
};

export const getJournalTitles = () => {
  return Object.entries(JOURNAL_CONFIG).map(([key, value]) => value.title);
};

export const getAddEntryForm = (type: string) => {
  const addEntryComponent =
    JOURNAL_CONFIG[type as keyof typeof JOURNAL_CONFIG]?.addEntryForm ?? null;
  return addEntryComponent;
};
