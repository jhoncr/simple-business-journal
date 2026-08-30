"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MoreVertical,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  Receipt,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Building2,
  FileCheck2,
  QrCode,
  Zap,
  HelpCircle,
} from "lucide-react";
import { cn, formattedDate, formatCurrency } from "@/lib/utils";
import { Payment } from "@backend/common/schemas/estimate_schema";
import { allowedCurrencySchemaType, ROLES } from "@backend/common/schemas/common_schemas";
import { ROLES_THAT_ADD, ROLES_CAN_DELETE } from "@backend/common/const";
import { useTranslations } from "next-intl";
import { PaymentDialog } from "./PaymentDialog";

interface PaymentsProps {
  payments: Payment[];
  currencyFormat: (amount: number) => string;
  journalCurrency?: allowedCurrencySchemaType;
  grandTotal?: number;
  isInvoiceFlow?: boolean;
  userRole?: (typeof ROLES)[number];
  handleAddPayment: (payment: Payment) => Promise<boolean | void> | void;
  handleUpdatePayment?: (payment: Payment) => Promise<boolean | void> | void;
  handleDeletePayment?: (paymentId: string) => Promise<boolean | void> | void;
  handleRestorePayment?: (paymentId: string) => Promise<boolean | void> | void;
  handlePermanentDeletePayment?: (paymentId: string) => Promise<boolean | void> | void;
  isSaving: boolean;
}

export const Payments = ({
  payments,
  currencyFormat,
  journalCurrency = "USD",
  grandTotal = 0,
  isInvoiceFlow = true,
  userRole = "viewer",
  handleAddPayment,
  handleUpdatePayment,
  handleDeletePayment,
  handleRestorePayment,
  handlePermanentDeletePayment,
  isSaving,
}: PaymentsProps) => {
  const t = useTranslations("payments");

  // Permissions
  const canModify = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);
  const canDeletePermanently = useMemo(
    () => ROLES_CAN_DELETE.has(userRole),
    [userRole],
  );

  // Dialog & confirmation states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [targetPaymentId, setTargetPaymentId] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);

  // Filter active and voided payments
  const activePayments = useMemo(
    () => payments.filter((p) => !p.deletedAt && !p.isDeleted),
    [payments],
  );
  const voidedPayments = useMemo(
    () => payments.filter((p) => p.deletedAt || p.isDeleted),
    [payments],
  );

  const totalPaid = useMemo(
    () => activePayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [activePayments],
  );

  const balanceDue = useMemo(
    () => (grandTotal || 0) - totalPaid,
    [grandTotal, totalPaid],
  );

  const displayedPayments = useMemo(
    () => (showVoided ? payments : activePayments),
    [showVoided, payments, activePayments],
  );

  // Payment method icon & helper
  const getMethodDisplay = (method?: string | null) => {
    if (!method) return { label: t("na"), icon: HelpCircle };
    const lower = method.toLowerCase();
    switch (lower) {
      case "cash":
        return { label: t("methods.cash"), icon: Banknote };
      case "credit_card":
        return { label: t("methods.credit_card"), icon: CreditCard };
      case "debit_card":
        return { label: t("methods.debit_card"), icon: CreditCard };
      case "bank_transfer":
        return { label: t("methods.bank_transfer"), icon: Building2 };
      case "check":
        return { label: t("methods.check"), icon: FileCheck2 };
      case "pix":
        return { label: t("methods.pix"), icon: QrCode };
      case "zelle":
        return { label: t("methods.zelle"), icon: Zap };
      case "other":
        return { label: t("methods.other"), icon: Receipt };
      default:
        return { label: method, icon: Receipt };
    }
  };

  // Handlers for Add/Edit
  const handleOpenAdd = () => {
    setEditingPayment(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setDialogOpen(true);
  };

  const handleSavePayment = async (payment: Payment) => {
    if (editingPayment && handleUpdatePayment) {
      await handleUpdatePayment(payment);
    } else {
      await handleAddPayment(payment);
    }
  };

  // Handlers for Void & Restore
  const handleOpenVoidConfirm = (paymentId: string) => {
    setTargetPaymentId(paymentId);
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (targetPaymentId && handleDeletePayment) {
      await handleDeletePayment(targetPaymentId);
    }
    setVoidDialogOpen(false);
    setTargetPaymentId(null);
  };

  const handleRestore = async (paymentId: string) => {
    if (handleRestorePayment) {
      await handleRestorePayment(paymentId);
    }
  };

  const handleOpenPermanentDeleteConfirm = (paymentId: string) => {
    setTargetPaymentId(paymentId);
    setPermanentDeleteDialogOpen(true);
  };

  const handleConfirmPermanentDelete = async () => {
    if (targetPaymentId && handlePermanentDeletePayment) {
      await handlePermanentDeletePayment(targetPaymentId);
    }
    setPermanentDeleteDialogOpen(false);
    setTargetPaymentId(null);
  };

  // Status badge calculation
  const renderStatusBadge = () => {
    if (activePayments.length === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {t("status.unpaid")}
        </Badge>
      );
    }
    if (totalPaid >= grandTotal && grandTotal > 0) {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t("status.paid")}
        </Badge>
      );
    }
    if (totalPaid > grandTotal) {
      return (
        <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
          <AlertCircle className="h-3 w-3" />
          {t("status.credit")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
        <AlertCircle className="h-3 w-3" />
        {t("status.partial")}
      </Badge>
    );
  };

  return (
    <Card className="print:border-none print:shadow-none break-before-page overflow-hidden">
      {/* Header */}
      <CardHeader className="p-4 sm:p-6 pb-3 print:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {t("title")}
            </CardTitle>
            <div className="print:hidden">{renderStatusBadge()}</div>
          </div>

          {/* Action Toolbar (Screen only) */}
          <div className="flex items-center gap-2 print:hidden">
            {voidedPayments.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowVoided(!showVoided)}
              >
                {showVoided ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                    {t("hideVoided")}
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    {t("showVoided", { count: voidedPayments.length })}
                  </>
                )}
              </Button>
            )}

            {isInvoiceFlow && canModify && (
              <Button
                onClick={handleOpenAdd}
                disabled={isSaving}
                size="sm"
                variant="brutalist"
                className="h-8 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("recordPayment")}
              </Button>
            )}
          </div>
        </div>

        {/* Financial Summary Tile Bar */}
        <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-secondary/30 rounded-lg border text-xs print:hidden">
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              {t("summary.totalInvoiced")}
            </span>
            <span className="font-bold text-sm sm:text-base">
              {currencyFormat(grandTotal)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              {t("summary.totalPaid")}
            </span>
            <span className="font-bold text-sm sm:text-base text-green-600 dark:text-green-400">
              {currencyFormat(totalPaid)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              {t("summary.balanceDue")}
            </span>
            <span
              className={cn(
                "font-bold text-sm sm:text-base",
                balanceDue > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground",
              )}
            >
              {currencyFormat(balanceDue)}
            </span>
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-4 sm:p-6 pt-0 print:p-0 space-y-4">
        {/* Screen: Interactive Payments List */}
        <div className="print:hidden">
          {displayedPayments.length > 0 ? (
            <div className="divide-y border rounded-lg overflow-hidden bg-card">
              {displayedPayments.map((payment, index) => {
                const isVoided = Boolean(payment.deletedAt || payment.isDeleted);
                const methodInfo = getMethodDisplay(payment.method);
                const MethodIcon = methodInfo.icon;
                const paymentKey =
                  payment.id || `payment-${index}-${payment.date}`;

                return (
                  <div
                    key={paymentKey}
                    className={cn(
                      "p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors",
                      isVoided
                        ? "bg-muted/30 opacity-70"
                        : "hover:bg-accent/40",
                    )}
                  >
                    {/* Left details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Method badge */}
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border">
                          <MethodIcon className="h-3 w-3" />
                          {methodInfo.label}
                        </span>

                        {/* Date */}
                        <span className="text-xs text-muted-foreground">
                          {formattedDate(new Date(payment.date))}
                        </span>

                        {/* Voided badge */}
                        {isVoided && (
                          <Badge
                            variant="destructive"
                            className="text-2xs py-0 h-4"
                          >
                            {t("voidedBadge")}
                          </Badge>
                        )}
                      </div>

                      {/* Transaction ID and Notes */}
                      {(payment.transactionId || payment.notes) && (
                        <div className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                          {payment.transactionId && (
                            <p className="font-mono text-2xs">
                              {t("transactionId")}: {payment.transactionId}
                            </p>
                          )}
                          {payment.notes && (
                            <p className="italic text-foreground/80 break-words">
                              &ldquo;{payment.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      {/* Audit trail */}
                      {isVoided && payment.deletedAt && (
                        <p className="text-2xs text-destructive">
                          {t("voidedOn", {
                            date: formattedDate(new Date(payment.deletedAt)),
                          })}
                        </p>
                      )}
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={cn(
                          "text-sm sm:text-base font-bold whitespace-nowrap",
                          isVoided
                            ? "line-through text-muted-foreground"
                            : "text-green-600 dark:text-green-400",
                        )}
                      >
                        {currencyFormat(payment.amount)}
                      </span>

                      {/* Action Menu */}
                      {canModify && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              disabled={isSaving}
                              aria-label={t("moreActions")}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!isVoided ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleOpenEdit(payment)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>{t("editPayment")}</span>
                                </DropdownMenuItem>
                                {payment.id && handleDeletePayment && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleOpenVoidConfirm(payment.id!)
                                      }
                                      className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                      <span>{t("voidPayment")}</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {payment.id && handleRestorePayment && (
                                  <DropdownMenuItem
                                    onClick={() => handleRestore(payment.id!)}
                                    className="cursor-pointer gap-2"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>{t("restorePayment")}</span>
                                  </DropdownMenuItem>
                                )}
                                {canDeletePermanently &&
                                  payment.id &&
                                  handlePermanentDeletePayment && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleOpenPermanentDeleteConfirm(
                                            payment.id!,
                                          )
                                        }
                                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>{t("deletePermanently")}</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 px-4 border border-dashed rounded-lg bg-card/50">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("noPaymentsYet")}
              </p>
              {isInvoiceFlow && canModify && (
                <Button
                  onClick={handleOpenAdd}
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("recordPayment")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Print Layout: Clean Receipts Table */}
        <div className="hidden print:block space-y-3 mt-4">
          <h3 className="text-sm font-bold border-b pb-1">
            {t("receipt")}
          </h3>
          {activePayments.length > 0 ? (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 font-semibold">{t("date")}</th>
                  <th className="py-1 font-semibold">{t("method")}</th>
                  <th className="py-1 font-semibold">{t("transactionId")}</th>
                  <th className="py-1 font-semibold text-right">{t("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activePayments.map((p, idx) => {
                  const methodInfo = getMethodDisplay(p.method);
                  return (
                    <tr key={p.id || idx}>
                      <td className="py-1.5">
                        {formattedDate(new Date(p.date))}
                      </td>
                      <td className="py-1.5">{methodInfo.label}</td>
                      <td className="py-1.5 font-mono text-2xs">
                        {p.transactionId || "-"}
                      </td>
                      <td className="py-1.5 text-right font-medium">
                        {currencyFormat(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={3} className="py-1.5 text-right">
                    {t("totalPaid")}:
                  </td>
                  <td className="py-1.5 text-right">
                    {currencyFormat(totalPaid)}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={3} className="py-1 text-right">
                    {t("balanceDue")}:
                  </td>
                  <td className="py-1 text-right">
                    {currencyFormat(balanceDue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {t("noPaymentsYet")}
            </p>
          )}
        </div>
      </CardContent>

      {/* Add / Edit Modal */}
      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        paymentToEdit={editingPayment}
        balanceDue={balanceDue}
        currency={journalCurrency}
        onSave={handleSavePayment}
        isSaving={isSaving}
      />

      {/* Void Confirmation Alert Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("voidConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmVoid}
              disabled={isSaving}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {t("voidPayment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={permanentDeleteDialogOpen}
        onOpenChange={setPermanentDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("permanentDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("permanentDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPermanentDelete}
              disabled={isSaving}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {t("deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
