import FlowChainApp from "./FlowChainApp";
import { createBrowserRouter, RouterProvider } from "react-router";
import { UnsavedChangesProvider } from "../components/navigation/UnsavedChangesProvider";
import { I18nProvider } from "../i18n/I18n";

const router = createBrowserRouter([{
  path: "*",
  element: <I18nProvider><UnsavedChangesProvider><FlowChainApp /></UnsavedChangesProvider></I18nProvider>,
}]);

export default function App() {
  return <RouterProvider router={router} />;
}
