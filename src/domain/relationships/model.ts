import type { BusinessLinkedRecord } from "../../lib/businessLinks";

export type RelationshipEntityType =
  | "purchaseRequest"
  | "rfq"
  | "quotation"
  | "purchaseOrder"
  | "sku"
  | "item"
  | "supplier"
  | "grn"
  | "receivingDocument"
  | "invoice"
  | "invoiceMatch"
  | "inventoryMovement"
  | "inventoryException"
  | "auditEvent"
  | string;

export type RelationshipType =
  | "created_from"
  | "requested_item"
  | "sourced_by_rfq"
  | "awarded_to_po"
  | "contains_item"
  | "supplied_by"
  | "received_by"
  | "matched_to_invoice"
  | "affects_inventory"
  | "has_exception"
  | "has_audit_event"
  | "related_supplier"
  | string;

export type RelationshipConfidence = "high" | "medium" | "low";

export type DataLimitationCode =
  | "missing_source_pr"
  | "missing_rfq_link"
  | "missing_grn"
  | "missing_invoice_match"
  | "missing_inventory_balance"
  | "missing_supplier_lead_time"
  | "missing_moq"
  | "missing_payment_terms"
  | "missing_tax_terms"
  | "route_not_available"
  | "record_not_found"
  | "missing_relationship";

export type DataLimitation = {
  code: DataLimitationCode | string;
  message: string;
  entityType?: RelationshipEntityType;
  entityId?: string;
  relationshipType?: RelationshipType;
};

export type BusinessRelationship = {
  id: string;
  sourceEntityType: RelationshipEntityType;
  sourceEntityId: string;
  targetEntityType: RelationshipEntityType;
  targetEntityId: string;
  targetDisplayLabel: string;
  targetModule: string;
  relationshipType: RelationshipType;
  relationshipLabel: string;
  confidence: RelationshipConfidence;
  evidenceSource: string;
  route?: string;
  linkedRecord?: BusinessLinkedRecord;
  dataLimitation?: DataLimitation;
};

export type RelationshipGraph = {
  source: {
    entityType: RelationshipEntityType;
    entityId: string;
    displayLabel: string;
  };
  relationships: BusinessRelationship[];
  groupedRelationships: Record<string, BusinessRelationship[]>;
  linkedRecords: BusinessLinkedRecord[];
  dataLimitations: DataLimitation[];
};

export type EvidenceRiskLevel = "high" | "medium" | "low" | "none";

export type EvidenceItem = {
  id: string;
  title: string;
  sourceModule: string;
  sourceEntityType: RelationshipEntityType;
  sourceEntityId: string;
  evidenceType: string;
  summary: string;
  metric?: string | number;
  value?: string | number;
  riskLevel?: EvidenceRiskLevel;
  reason: string;
  relationshipId?: string;
  route?: string;
  linkedRecord?: BusinessLinkedRecord;
  dataLimitation?: boolean;
};

export type EvidenceBundle = {
  sourceEntityType: RelationshipEntityType;
  sourceEntityId: string;
  evidence: EvidenceItem[];
  relationships: BusinessRelationship[];
  linkedRecords: BusinessLinkedRecord[];
  dataLimitations: DataLimitation[];
};

export function groupRelationships(relationships: BusinessRelationship[]) {
  return relationships.reduce<Record<string, BusinessRelationship[]>>((groups, relationship) => {
    const key = relationship.relationshipLabel || relationship.relationshipType;
    groups[key] = groups[key] || [];
    groups[key].push(relationship);
    return groups;
  }, {});
}
