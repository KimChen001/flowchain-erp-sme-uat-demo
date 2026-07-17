import { resolveProvisionedActor } from "./pilot-identity.mjs";
import { OperationalFinanceReadError } from "./operational-finance-read-service.mjs";
import { financeFixed as fixed, financeUnits as units } from "./operational-finance-policy.mjs";

const text = (value) => String(value ?? "").trim();
const decimal = (value) =>
  value === null || value === undefined ? null : String(value);
const serial = (value) =>
  value && typeof value.toISOString === "function" ? value.toISOString() : value;
const managers = new Set(["admin", "manager"]);
const preparers = new Set([
  "admin",
  "manager",
  "business-specialist",
  "business_specialist",
]);
const fail = (code, message, status = 400, details) => {
  throw new OperationalFinanceReadError(code, message, status, details);
};
const page = (query = {}) => {
  const number = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
  return { page: number, pageSize: size, skip: (number - 1) * size };
};
const validCurrency = (value) => /^[A-Z]{3}$/.test(text(value).toUpperCase());

function invoiceActions(actor, capability, row) {
  if (!capability?.enabled) return [];
  if (preparers.has(actor.role) && row.status === "draft") return ["submit"];
  if (managers.has(actor.role) && row.status === "submitted") return ["approve"];
  if (managers.has(actor.role) && row.status === "approved") return ["issue"];
  return [];
}

function receivableActions(actor, capability, row) {
  if (!capability?.enabled || !managers.has(actor.role)) return [];
  const result = ["record_external_reference"];
  if (["open", "overdue"].includes(row.status)) result.unshift("dispute");
  if (row.disputeStatus === "open") result.unshift("resolve_dispute");
  return result;
}

function creditActions(actor, capability, row) {
  return capability?.enabled && managers.has(actor.role) && row.status === "draft"
    ? ["approve"]
    : [];
}

function invoiceSummary(row, actor, capabilities) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    salesOrderId: row.salesOrderId,
    salesOrderNumber: row.salesOrder?.orderNumber,
    shipmentId: row.shipmentId,
    shipmentNumber: row.shipment?.shipmentNumber,
    customerId: row.customerId,
    customerName: row.customerNameSnapshot,
    invoiceDate: serial(row.invoiceDate),
    dueDate: serial(row.dueDate),
    subtotalAmount: decimal(row.subtotalAmount),
    enteredTaxAmount: decimal(row.enteredTaxAmount),
    totalAmount: decimal(row.totalAmount),
    currency: row.currency,
    status: row.status,
    version: row.version,
    availableActions: invoiceActions(
      actor,
      capabilities["customer-invoice"],
      row,
    ),
  };
}

function receivableSummary(row, actor, capabilities) {
  return {
    id: row.id,
    obligationNumber: row.obligationNumber,
    customerInvoiceId: row.customerInvoiceId,
    customerInvoiceNumber: row.customerInvoice?.invoiceNumber,
    customerId: row.customerInvoice?.customerId,
    customerName: row.customerInvoice?.customerNameSnapshot,
    originalAmount: decimal(row.originalAmount),
    outstandingAmount: decimal(row.outstandingAmount),
    approvedCreditAmount: decimal(row.approvedCreditAmount),
    currency: row.currency,
    dueDate: serial(row.dueDate),
    status: row.status,
    disputeStatus: row.disputeStatus,
    disputeReason: row.disputeReason,
    externalSettlementReference: row.externalSettlementReference,
    externalSettlementEnteredAt: serial(row.externalSettlementEnteredAt),
    settlementVerified: false,
    collectionExecuted: false,
    version: row.version,
    availableActions: receivableActions(
      actor,
      capabilities["receivable-obligation"],
      row,
    ),
  };
}

function creditSummary(row, actor, capabilities) {
  return {
    id: row.id,
    creditNoteNumber: row.creditNoteNumber,
    customerInvoiceId: row.customerInvoiceId,
    customerInvoiceNumber: row.customerInvoice?.invoiceNumber,
    returnPostingId: row.returnPostingId,
    returnPostingNumber: row.returnPosting?.postingNumber,
    customerId: row.customerId,
    customerName: row.customerNameSnapshot,
    subtotalAmount: decimal(row.subtotalAmount),
    enteredTaxAmount: decimal(row.enteredTaxAmount),
    totalAmount: decimal(row.totalAmount),
    currency: row.currency,
    status: row.status,
    version: row.version,
    refundExecuted: false,
    availableActions: creditActions(
      actor,
      capabilities["customer-credit-note"],
      row,
    ),
  };
}

function localDateNumber(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day));
}

export function agingDays(dueDate, asOf, timezone) {
  return Math.floor(
    (localDateNumber(asOf, timezone) - localDateNumber(dueDate, timezone)) /
      86_400_000,
  );
}

export function agingBucket(days) {
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export function createOperationalFinanceO2cReadService({
  prisma,
  capabilities = {},
  now = () => new Date(),
} = {}) {
  if (!prisma) throw new Error("prisma is required");

  async function actor(context) {
    return resolveProvisionedActor(prisma, context?.identity || context);
  }

  async function listCustomerInvoices(query, context) {
    const current = await actor(context);
    const paging = page(query);
    const search = text(query.search);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
      ...(validCurrency(query.currency)
        ? { currency: text(query.currency).toUpperCase() }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              {
                customerNameSnapshot: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.customerInvoice.count({ where }),
      prisma.customerInvoice.findMany({
        where,
        include: { salesOrder: true, shipment: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      ...paging,
      total,
      items: rows.map((row) => invoiceSummary(row, current, capabilities)),
      capabilities,
    };
  }

  async function customerInvoiceDetail(id, context) {
    const current = await actor(context);
    const row = await prisma.customerInvoice.findFirst({
      where: { id, tenantId: current.tenantId },
      include: {
        salesOrder: true,
        shipment: true,
        lines: { orderBy: { lineNumber: "asc" } },
        receivableObligation: true,
        creditNotes: {
          include: { returnPosting: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!row)
      fail("CUSTOMER_INVOICE_NOT_FOUND", "Customer invoice was not found.", 404);
    return {
      ...invoiceSummary(row, current, capabilities),
      lines: row.lines.map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        shipmentLineId: line.shipmentLineId,
        salesOrderLineId: line.salesOrderLineId,
        itemId: line.itemId,
        sku: line.sku,
        itemName: line.itemName,
        quantity: decimal(line.quantity),
        unit: line.unit,
        unitPrice: decimal(line.unitPrice),
        lineAmount: decimal(line.lineAmount),
        enteredTaxAmount: decimal(line.enteredTaxAmount),
        totalAmount: decimal(line.totalAmount),
      })),
      receivable: row.receivableObligation
        ? receivableSummary(row.receivableObligation, current, capabilities)
        : null,
      customerCreditNotes: row.creditNotes.map((note) =>
        creditSummary(note, current, capabilities),
      ),
      evidence: [
        {
          type: "SalesOrder",
          id: row.salesOrderId,
          number: row.salesOrder.orderNumber,
          authoritative: true,
        },
        {
          type: "PostedShipment",
          id: row.shipmentId,
          number: row.shipment.shipmentNumber,
          postingStatus: row.shipment.postingStatus,
          authoritative: true,
        },
      ],
      reconciliation: {
        currency: row.currency,
        subtotalAmount: decimal(row.subtotalAmount),
        enteredTaxAmount: decimal(row.enteredTaxAmount),
        totalAmount: decimal(row.totalAmount),
        fxConverted: false,
      },
    };
  }

  async function listReceivables(query, context) {
    const current = await actor(context);
    const paging = page(query);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
      ...(text(query.disputeStatus)
        ? { disputeStatus: text(query.disputeStatus) }
        : {}),
      ...(validCurrency(query.currency)
        ? { currency: text(query.currency).toUpperCase() }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.receivableObligation.count({ where }),
      prisma.receivableObligation.findMany({
        where,
        include: { customerInvoice: true },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      ...paging,
      total,
      items: rows.map((row) => receivableSummary(row, current, capabilities)),
      capabilities,
    };
  }

  async function aging(query, context) {
    const current = await actor(context);
    const workspace = await prisma.tenant.findUnique({
      where: { id: current.tenantId },
      select: { timezone: true },
    });
    const timezone = workspace?.timezone || "Asia/Shanghai";
    const asOf = text(query.asOf) ? new Date(text(query.asOf)) : now();
    if (Number.isNaN(asOf.getTime()))
      fail("AGING_AS_OF_INVALID", "asOf must be a valid date.", 422);
    const rows = await prisma.receivableObligation.findMany({
      where: {
        tenantId: current.tenantId,
        status: { in: ["open", "partially_settled", "overdue", "disputed"] },
        outstandingAmount: { gt: 0 },
        ...(validCurrency(query.currency)
          ? { currency: text(query.currency).toUpperCase() }
          : {}),
      },
      include: { customerInvoice: true },
      orderBy: [{ currency: "asc" }, { dueDate: "asc" }, { id: "asc" }],
    });
    const groups = new Map();
    for (const row of rows) {
      const bucket = agingBucket(agingDays(row.dueDate, asOf, timezone));
      const group =
        groups.get(row.currency) || {
          currency: row.currency,
          current: 0n,
          "1_30": 0n,
          "31_60": 0n,
          "61_90": 0n,
          "90_plus": 0n,
          total: 0n,
          count: 0,
        };
      const amount = units(row.outstandingAmount);
      group[bucket] += amount;
      group.total += amount;
      group.count += 1;
      groups.set(row.currency, group);
    }
    const currencies = [...groups.keys()].sort();
    return {
      dataSource: "Authoritative PostgreSQL",
      asOf: asOf.toISOString(),
      timezone,
      currencies,
      currencyAggregationStatus:
        currencies.length > 1
          ? "multi_currency_unconverted"
          : currencies.length === 1
            ? "single_currency"
            : "no_currency_data",
      fxConverted: false,
      groups: currencies.map((currency) => {
        const group = groups.get(currency);
        return {
          currency,
          count: group.count,
          current: fixed(group.current),
          "1_30": fixed(group["1_30"]),
          "31_60": fixed(group["31_60"]),
          "61_90": fixed(group["61_90"]),
          "90_plus": fixed(group["90_plus"]),
          total: fixed(group.total),
        };
      }),
      items: rows.map((row) => ({
        ...receivableSummary(row, current, capabilities),
        overdueDays: Math.max(0, agingDays(row.dueDate, asOf, timezone)),
        agingBucket: agingBucket(agingDays(row.dueDate, asOf, timezone)),
      })),
    };
  }

  async function listCustomerCreditNotes(query, context) {
    const current = await actor(context);
    const paging = page(query);
    const where = {
      tenantId: current.tenantId,
      ...(text(query.status) ? { status: text(query.status) } : {}),
      ...(validCurrency(query.currency)
        ? { currency: text(query.currency).toUpperCase() }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.customerCreditNote.count({ where }),
      prisma.customerCreditNote.findMany({
        where,
        include: { customerInvoice: true, returnPosting: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      ...paging,
      total,
      items: rows.map((row) => creditSummary(row, current, capabilities)),
      capabilities,
    };
  }

  async function entryData(context) {
    const current = await actor(context);
    const [shipments, invoices, returnPostings] = await Promise.all([
      prisma.shipmentDocument.findMany({
        where: {
          tenantId: current.tenantId,
          postingStatus: "posted",
          reversedAt: null,
        },
        include: {
          salesOrder: true,
          lines: { include: { salesOrderLine: true } },
        },
        orderBy: { postedAt: "desc" },
        take: 100,
      }),
      prisma.customerInvoice.findMany({
        where: {
          tenantId: current.tenantId,
          status: { in: ["approved", "issued", "disputed"] },
        },
        include: { lines: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.returnPostingDocument.findMany({
        where: {
          tenantId: current.tenantId,
          postingType: "customer_return_receipt",
          postingStatus: "posted",
          reversedAt: null,
        },
        include: { lines: true },
        orderBy: { postedAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      postedShipments: shipments.map((row) => ({
        id: row.id,
        shipmentNumber: row.shipmentNumber,
        salesOrderId: row.salesOrderId,
        salesOrderNumber: row.salesOrder.orderNumber,
        customerId: row.salesOrder.customerId,
        customerName: row.salesOrder.customerName,
        currency: row.salesOrder.currency,
        lines: row.lines.map((line) => ({
          id: line.id,
          salesOrderLineId: line.salesOrderLineId,
          itemId: line.itemId,
          sku: line.sku,
          itemName: line.itemName,
          postedQuantity: decimal(line.postedQuantity),
          unit: line.unit,
          unitPrice: decimal(line.salesOrderLine.unitPrice),
        })),
      })),
      customerInvoices: invoices.map((row) =>
        invoiceSummary(row, current, capabilities),
      ),
      customerReturnPostings: returnPostings.map((row) => ({
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
    listCustomerInvoices,
    customerInvoiceDetail,
    listReceivables,
    aging,
    listCustomerCreditNotes,
    entryData,
  };
}
