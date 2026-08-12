"use client";

import {
  BriefcaseBusiness,
  ClipboardPenLine,
  House,
  Paintbrush,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConnectivityNotice } from "./connectivity-notice";

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
}

const navigation: readonly NavigationItem[] = [
  { href: "/", label: "Übersicht", icon: House, exact: true },
  { href: "/kunden", label: "Kunden", icon: UsersRound, exact: false },
  {
    href: "/projekte/project-wohnzimmer-bochum",
    label: "Projekt",
    icon: BriefcaseBusiness,
    exact: true,
  },
  {
    href: "/projekte/project-wohnzimmer-bochum/baustellenbesuch",
    label: "Besuch",
    icon: ClipboardPenLine,
    exact: false,
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Zum Inhalt springen
      </a>

      <aside className="app-sidebar" aria-label="Hauptnavigation">
        <Link
          className="brand-lockup"
          href="/"
          aria-label="Angebots-Copilot Startseite"
        >
          <span className="brand-mark" aria-hidden="true">
            <Paintbrush size={20} strokeWidth={2.25} />
          </span>
          <span>
            <strong>Angebots-Copilot</strong>
            <small>Westblick</small>
          </span>
        </Link>

        <div className="organisation-block">
          <span className="eyebrow">Arbeitsbereich</span>
          <strong>Malerbetrieb Westblick GmbH</strong>
          <span className="demo-chip">
            <ShieldCheck size={14} aria-hidden="true" />
            Interne Demo
          </span>
        </div>

        <nav className="desktop-nav" aria-label="Bereiche">
          {navigation.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                className="nav-link"
                data-active={active || undefined}
                href={href}
                aria-current={active ? "page" : undefined}
                key={href}
              >
                <Icon size={19} strokeWidth={2} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-identity">
          <span className="avatar" aria-hidden="true">
            MJ
          </span>
          <span>
            <strong>Mohsen Jamshidi</strong>
            <small>Inhaber · Demo-Nutzer</small>
          </span>
        </div>
      </aside>

      <div className="app-column">
        <header className="mobile-header">
          <Link
            className="mobile-brand"
            href="/"
            aria-label="Angebots-Copilot Startseite"
          >
            <span className="brand-mark" aria-hidden="true">
              <Paintbrush size={18} strokeWidth={2.25} />
            </span>
            <span>
              <strong>Westblick</strong>
              <small>Angebots-Copilot</small>
            </span>
          </Link>
          <span className="mobile-demo">Demo</span>
        </header>

        <ConnectivityNotice />
        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Hauptnavigation mobil">
        {navigation.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              data-active={active || undefined}
              key={href}
            >
              <Icon size={21} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
