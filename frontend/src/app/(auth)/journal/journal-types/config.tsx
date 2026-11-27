import { PencilRuler, Box, Building2 } from "lucide-react";
import React from "react";
import { AddNewEstimateBtn } from "./estimate/addEstimate";
import { EstimateEntry } from "./estimate/EstimateEntry";
import { AddNewTemplateBtn } from "./template/addTemplate";
import { TemplateEntry } from "./template/TemplateEntry";
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
  estimate: {
    icon: <PencilRuler className="h-4 w-4" />,
    title: "Estimates",
    entryComponent: EstimateEntry,
    addEntryForm: AddNewEstimateBtn,
  },
  template: {
    icon: <Box className="h-4 w-4" />,
    title: "Templates",
    entryComponent: TemplateEntry,
    addEntryForm: AddNewTemplateBtn,
  },
};

export const getJournalIcon = (type: string) => {
  if (type === "business") {
    return <Building2 className="h-4 w-4" />;
  }
  return (
    JOURNAL_CONFIG[type as keyof typeof JOURNAL_CONFIG]?.icon ?? (
      <Building2 className="h-4 w-4" />
    )
  );
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