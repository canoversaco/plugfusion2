import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import Home from "./views/Home.jsx";
import Menu from "./views/Menu.jsx";
import Orders from "./views/Orders.jsx";
import Courier from "./views/Courier.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "/menu", element: <Menu /> },
      { path: "/orders", element: <Orders /> },
      { path: "/courier", element: <Courier /> },
      { path: "/kurier", element: <Courier /> },
    ],
  },
]);

export default function RouteBoot(){ return <RouterProvider router={router} />; }
