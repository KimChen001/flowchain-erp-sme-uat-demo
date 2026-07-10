import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export function BackToListButton({ path, label = "返回列表" }: { path: string; label?: string }) {
  const navigate = useNavigate();
  return <button type="button" className="fc-action-button fc-action-secondary" onClick={() => navigate(path)}><ArrowLeft size={14} />{label}</button>;
}
