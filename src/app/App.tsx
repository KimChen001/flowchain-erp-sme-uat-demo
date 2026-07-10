import FlowChainApp from "./FlowChainApp";
import { createBrowserRouter, RouterProvider } from "react-router";
import { UnsavedChangesProvider } from "../components/navigation/UnsavedChangesProvider";

const router = createBrowserRouter([{
  path: "*",
  element: <UnsavedChangesProvider><FlowChainApp /></UnsavedChangesProvider>,
}]);

export default function App() {
  return <RouterProvider router={router} />;
}
