import { A, Card } from "../../components/ui";

export function ProcurementEmptyState({ title, description }: { title: string; description: string }) {
  return <Card className="py-16 text-center"><h1 className="text-base font-semibold">{title}</h1><p className="mt-2 text-xs" style={{ color: A.sub }}>{description}</p></Card>;
}
