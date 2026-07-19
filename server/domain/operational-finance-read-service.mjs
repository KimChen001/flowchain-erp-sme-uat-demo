import { resolveProvisionedActor } from "./pilot-identity.mjs";

export class OperationalFinanceReadError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "OperationalFinanceReadError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const fail = (code, message, status = 400, details) => {
  throw new OperationalFinanceReadError(code, message, status, details);
};
const text = (value) => String(value ?? "").trim();
const managerRoles = new Set(["admin", "manager"]);
const draftRoles = new Set([
  "admin",
  "manager",
  "business-specialist",
  "business_specialist",
  "buyer",
]);
const serial = (value) =>
  value && typeof value.toISOString === "function"
    ? value.toISOString()
    : value;
const decimal = (value) =>
  value === null || value === undefined ? null : String(value);

function pageQuery(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 25)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function actions(actor, capability, row, type) {
  if (!capability?.enabled) return [];
  if (type === "invoice") {
    const values = [];
    if (draftRoles.has(actor.role) && row.status === "draft")
      values.push("revise", "submit");
    if (draftRoles.has(actor.role) && row.status === "submitted")
      values.push("match");
    if (
      managerRoles.has(actor.role) &&
      ["matched", "exception"].includes(row.status)
    )
      values.push("approve");
    return values;
  }
  if (type === "payable" && managerRoles.has(actor.role)) {
    if (row.status === "approved") return ["hold", "mark_export_ready"];
    if (row.status === "export_ready") return ["hold"];
    if (row.status === "held") return ["release"];
  }
  if (type === "creditMemo") {
    if (managerRoles.has(actor.role) && row.status === "draft")
      return ["approve"];
  }
  return [];
}

function invoiceSummary(row, actor, capabilities) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber || row.id,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    relatedPoId: row.relatedPoId,
    relatedGrnId: row.relatedGrnId,
    invoiceDate: serial(row.invoiceDate),
    dueDate: serial(row.dueDate),
    subtotalAmount: decimal(row.subtotalAmount ?? row.amount),
    enteredTaxAmount: decimal(row.enteredTaxAmount ?? 0),
    totalAmount: decimal(row.totalAmount ?? row.amount),
    currency: row.currency,
    status: row.status,
    matchStatus: row.matchStatus,
    varianceAmount: decimal(row.varianceAmount),
    version: row.version,
    availableActions: actions(
      actor,
      capabilities["supplier-invoice"],
      row,
      "invoice",
    ),
  };
}

function payableSummary(row, actor, capabilities) {
  return {
    id: row.id,
    obligationNumber: row.obligationNumber,
    supplierInvoiceId: row.supplierInvoiceId,
    supplierInvoiceNumber: row.supplierInvoice?.invoiceNumber,
    supplierName: row.supplierInvoice?.supplierName,
    originalAmount: decimal(row.originalAmount),
    outstandingAmount: decimal(row.outstandingAmount),
    approvedCreditAmount: decimal(row.approvedCreditAmount),
    currency: row.currency,
    dueDate: serial(row.dueDate),
    status: row.status,
    version: row.version,
    settlementExecuted: false,
    availableActions: actions(
      actor,
      capabilities["payable-obligation"],
      row,
      "payable",
    ),
  };
}

function creditMemoSummary(row, actor, capabilities) {
  return {
    id: row.id,
    creditMemoNumber: row.creditMemoNumber,
    supplierInvoiceId: row.supplierInvoiceId,
    supplierInvoiceNumber: row.supplierInvoice?.invoiceNumber,
    returnPostingId: row.returnPostingId,
    returnPostingNumber: row.returnPosting?.postingNumber,
    supplierName: row.supplierNameSnapshot,
    subtotalAmount: decimal(row.subtotalAmount),
    enteredTaxAmount: decimal(row.enteredTaxAmount),
    totalAmount: decimal(row.totalAmount),
    currency: row.currency,
    status: row.status,
    version: row.version,
    availableActions: actions(
      actor,
      capabilities["supplier-credit-memo"],
      row,
      "creditMemo",
    ),
  };
}

export function createOperationalFinanceReadService({
  prisma,
  capabilities = {},
} = {}) {
  if (!prisma) throw new Error("prisma is required");

  async function actor(context) {
    return resolveProvisionedActor(prisma, context?.identity || context);
  }

  async function listSupplierInvoices(query, context) {
    const current = await actor(context);
    const { page, pageSize, skip } = pageQuery(query);
    const search = text(query.search);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
      ...(text(query.currency)
        ? { currency: text(query.currency).toUpperCase() }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              { supplierName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.supplierInvoice.count({ where }),
      prisma.supplierInvoice.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => invoiceSummary(row, current, capabilities)),
      page,
      pageSize,
      total,
      capabilities,
    };
  }

  async function supplierInvoiceDetail(invoiceId, context) {
    const current = await actor(context);
    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, tenantId: current.tenantId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        matchRuns: {
          orderBy: { createdAt: "desc" },
          include: {
            lines: { orderBy: { id: "asc" } },
            exceptions: { orderBy: { createdAt: "asc" } },
          },
        },
        payableObligation: true,
        supplierCreditMemos: {
          orderBy: { createdAt: "desc" },
          include: { lines: true },
        },
      },
    });
    if (!invoice)
      fail("SUPPLIER_INVOICE_NOT_FOUND", "Supplier invoice was not found.", 404);
    const summary = invoiceSummary(invoice, current, capabilities);
    const match = invoice.matchRuns[0] || null;
    return {
      ...summary,
      supplierSnapshot: invoice.supplierSnapshot,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        purchaseOrderLineId: line.purchaseOrderLineId,
        receivingLineId: line.receivingLineId,
        itemId: line.itemId,
        sku: line.sku,
        itemName: line.itemName,
        unit: line.unit,
        quantity: decimal(line.quantity),
        unitPrice: decimal(line.unitPrice),
        lineAmount: decimal(line.lineAmount ?? line.amount),
        enteredTaxAmount: decimal(line.enteredTaxAmount ?? 0),
        totalAmount: decimal(line.amount),
      })),
      match: match
        ? {
            id: match.id,
            matchNumber: match.matchNumber,
            status: match.status,
            blockingReason: match.blockingReason,
            createdAt: serial(match.createdAt),
            lines: match.lines.map((line) => ({
              id: line.id,
              supplierInvoiceLineId: line.supplierInvoiceLineId,
              purchaseOrderLineId: line.purchaseOrderLineId,
              receivingLineId: line.receivingLineId,
              status: line.status,
              orderedQuantity: decimal(line.orderedQuantity),
              receivedQuantity: decimal(line.receivedQuantity),
              previouslyInvoicedQuantity: decimal(
                line.previouslyInvoicedQuantity,
              ),
              invoiceQuantity: decimal(line.invoiceQuantity),
              poUnitPrice: decimal(line.poUnitPrice),
              invoiceUnitPrice: decimal(line.invoiceUnitPrice),
              quantityVariance: decimal(line.quantityVariance),
              priceVariance: decimal(line.priceVariance),
              amountVariance: decimal(line.amountVariance),
              currency: line.currency,
            })),
            exceptions: match.exceptions.map((entry) => ({
              id: entry.id,
              matchLineId: entry.matchLineId,
              exceptionType: entry.exceptionType,
              status: entry.status,
              expectedValue: decimal(entry.expectedValue),
              actualValue: decimal(entry.actualValue),
              varianceValue: decimal(entry.varianceValue),
              currency: entry.currency,
              resolution: entry.resolution,
              version: entry.version,
            })),
          }
        : null,
      payable: invoice.payableObligation
        ? payableSummary(invoice.payableObligation, current, capabilities)
        : null,
      supplierCreditMemos: invoice.supplierCreditMemos.map((memo) =>
        creditMemoSummary(memo, current, capabilities),
      ),
      evidence: [
        {
          type: "PurchaseOrder",
          id: invoice.relatedPoId,
          relationship: "ordered_under",
        },
        {
          type: "ReceivingDocument",
          id: invoice.relatedGrnId,
          relationship: "received_under",
        },
        ...(match
          ? [
              {
                type: "ThreeWayMatch",
                id: match.id,
                relationship: "matched_by",
              },
            ]
          : []),
      ].filter((entry) => entry.id),
      reconciliation: match
        ? match.lines.map((line) => ({
            supplierInvoiceLineId: line.supplierInvoiceLineId,
            poLineId: line.purchaseOrderLineId,
            receivingLineId: line.receivingLineId,
            status: line.status,
            matched:
              line.status === "matched" ||
              !match.exceptions.some(
                (entry) =>
                  entry.matchLineId === line.id &&
                  !["approved", "resolved"].includes(entry.status),
              ),
          }))
        : [],
      capabilities,
    };
  }

  async function listMatchExceptions(query, context) {
    const current = await actor(context);
    const { page, pageSize, skip } = pageQuery(query);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.financeMatchException.count({ where }),
      prisma.financeMatchException.findMany({
        where,
        include: { supplierInvoice: true, match: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        matchId: row.matchId,
        matchNumber: row.match.matchNumber,
        matchLineId: row.matchLineId,
        supplierInvoiceId: row.supplierInvoiceId,
        invoiceNumber: row.supplierInvoice.invoiceNumber,
        supplierName: row.supplierInvoice.supplierName,
        exceptionType: row.exceptionType,
        status: row.status,
        expectedValue: decimal(row.expectedValue),
        actualValue: decimal(row.actualValue),
        varianceValue: decimal(row.varianceValue),
        currency: row.currency,
        resolution: row.resolution,
        version: row.version,
        availableActions:
          managerRoles.has(current.role) && row.status === "open"
            ? ["approve", "reject"]
            : [],
      })),
      page,
      pageSize,
      total,
      capabilities,
    };
  }

  async function listPayables(query, context) {
    const current = await actor(context);
    const { page, pageSize, skip } = pageQuery(query);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
      ...(text(query.currency)
        ? { currency: text(query.currency).toUpperCase() }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.payableObligation.count({ where }),
      prisma.payableObligation.findMany({
        where,
        include: { supplierInvoice: true },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => payableSummary(row, current, capabilities)),
      page,
      pageSize,
      total,
      currencyAggregationStatus:
        new Set(rows.map((row) => row.currency)).size > 1
          ? "multi_currency_unconverted"
          : "single_currency",
      fxConverted: false,
      capabilities,
    };
  }

  async function listSupplierCreditMemos(query, context) {
    const current = await actor(context);
    const { page, pageSize, skip } = pageQuery(query);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.supplierCreditMemo.count({ where }),
      prisma.supplierCreditMemo.findMany({
        where,
        include: { supplierInvoice: true, returnPosting: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) =>
        creditMemoSummary(row, current, capabilities),
      ),
      page,
      pageSize,
      total,
      capabilities,
    };
  }

  async function entryData(context) {
    const current = await actor(context);
    const [suppliers, purchaseOrders, receivingDocuments, returnPostings] =
      await Promise.all([
        prisma.supplier.findMany({
          where: { tenantId: current.tenantId, status: "active" },
          select: { id: true, code: true, name: true },
          orderBy: { name: "asc" },
          take: 100,
        }),
        prisma.purchaseOrder.findMany({
          where: { tenantId: current.tenantId },
          include: { lines: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.receivingDocument.findMany({
          where: {
            tenantId: current.tenantId,
            postingStatus: "posted",
            reversedAt: null,
          },
          include: { lines: true },
          orderBy: { postedAt: "desc" },
          take: 100,
        }),
        prisma.returnPostingDocument.findMany({
          where: {
            tenantId: current.tenantId,
            postingType: "supplier_return_dispatch",
            postingStatus: "posted",
            reversedAt: null,
          },
          include: { lines: true },
          orderBy: { postedAt: "desc" },
          take: 100,
        }),
      ]);
    return {
      suppliers,
      purchaseOrders: purchaseOrders.map((row) => ({
        id: row.id,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        currency: row.currency,
        lines: row.lines.map((line) => ({
          id: line.id,
          itemId: line.itemId,
          sku: line.sku,
          itemName: line.itemName,
          orderedQuantity: decimal(line.orderedQuantity),
          unit: line.unit,
          unitPrice: decimal(line.unitPrice),
        })),
      })),
      receivingDocuments: receivingDocuments.map((row) => ({
        id: row.id,
        documentNumber: row.documentNumber,
        poId: row.poId,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        currency: row.currency,
        lines: row.lines.map((line) => ({
          id: line.id,
          purchaseOrderLineId: line.purchaseOrderLineId,
          itemId: line.itemId,
          sku: line.sku,
          itemName: line.itemName,
          acceptedQuantity: decimal(line.acceptedQty),
          unit: line.unit,
          warehouseId: line.warehouseId,
        })),
      })),
      supplierReturnPostings: returnPostings.map((row) => ({
        id: row.id,
        postingNumber: row.postingNumber,
        lines: row.lines.map((line) => ({
          id: line.id,
          itemId: line.itemId,
          sku: line.sku,
          itemName: line.itemName,
          quantity: decimal(line.quantity),
          unit: line.unit,
        })),
      })),
      capabilities,
    };
  }

  return {
    listSupplierInvoices,
    supplierInvoiceDetail,
    listMatchExceptions,
    listPayables,
    listSupplierCreditMemos,
    entryData,
  };
}
