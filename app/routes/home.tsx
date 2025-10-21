import type { Route } from "./+types/home";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MSN Messenger" },
    { name: "description", content: "Stay connected with friends" },
  ];
}

export function loader({}: Route.LoaderArgs) {
  // Redirect to login page
  return redirect("/login");
}
