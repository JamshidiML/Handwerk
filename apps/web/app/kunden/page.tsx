import type { Metadata } from "next";
import { CustomerDirectory } from "@/src/features/customers-projects/customer-directory";

export const metadata: Metadata = {
  title: "Kunden und Projekte",
  description:
    "Synthetische Kunden- und Projektauswahl der internen Westblick-Demo.",
};

export default function CustomersPage() {
  return <CustomerDirectory />;
}
