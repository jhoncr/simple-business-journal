"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface AddNewInvoiceBtnProps {
  journalId: string;
}

export const AddNewInvoiceBtn: React.FC<AddNewInvoiceBtnProps> = ({
  journalId,
}) => {
  if (!journalId) {
    console.error("AddNewInvoiceBtn: journalId is missing");
    return null; // Or render a disabled button
  }

  return (
    <Link href={`/journal/entry?jid=${journalId}&type=invoice`} passHref>
      <Button variant="default" size="sm">
        <PlusCircle className="mr-2 h-4 w-4" />
        New Invoice
      </Button>
    </Link>
  );
};
