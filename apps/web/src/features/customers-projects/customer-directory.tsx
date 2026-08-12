"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  MapPin,
  Plus,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { ConfirmDialog } from "@/src/components/confirm-dialog";
import { StatusBadge } from "@/src/components/status-badge";
import {
  EmptyState,
  ErrorSummary,
  InlineNotice,
} from "@/src/components/ui-patterns";
import { isCanonicalProject } from "./demo-data";
import { useDemoData } from "./demo-data-provider";
import { formatDate } from "./formatters";
import { draftStateLabel, draftStateTone } from "./project-status";

export function CustomerDirectory() {
  const {
    customers,
    createCustomer,
    createProject,
    findCustomer,
    removeProject,
  } = useDemoData();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customers[0]?.customer.id ?? "",
  );
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [customerErrors, setCustomerErrors] = useState<string[]>([]);
  const [projectErrors, setProjectErrors] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const selected = findCustomer(selectedCustomerId) ?? customers[0];

  function openCustomerForm() {
    setCustomerFormOpen(true);
    setProjectFormOpen(false);
    setCustomerErrors([]);
    window.setTimeout(() => customerNameRef.current?.focus(), 0);
  }

  function openProjectForm() {
    setProjectFormOpen(true);
    setCustomerFormOpen(false);
    setProjectErrors([]);
    window.setTimeout(() => projectNameRef.current?.focus(), 0);
  }

  function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();
    const errors =
      displayName.length < 2
        ? ["Bitte einen Namen mit mindestens zwei Zeichen eingeben."]
        : [];
    setCustomerErrors(errors);
    if (errors.length > 0) return;

    const created = createCustomer(displayName);
    setSelectedCustomerId(created.id);
    setCustomerFormOpen(false);
    setAnnouncement(`Demo-Kunde ${created.displayName} wurde angelegt.`);
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("projectName") ?? "").trim();
    const locationLabel = String(formData.get("locationLabel") ?? "").trim();
    const errors = [
      ...(name.length < 3
        ? [
            "Bitte eine Projektbezeichnung mit mindestens drei Zeichen eingeben.",
          ]
        : []),
      ...(locationLabel.length < 2
        ? ["Bitte einen Ort für den Baustellenbesuch eingeben."]
        : []),
    ];
    setProjectErrors(errors);
    if (errors.length > 0) return;

    const created = createProject({
      customerId: selected.customer.id,
      name,
      locationLabel,
    });
    setProjectFormOpen(false);
    setAnnouncement(
      `Projekt ${created.name} wurde als synthetischer Demo-Eintrag angelegt.`,
    );
  }

  function confirmRemoval() {
    if (!pendingRemoval) return;
    const removed = removeProject(pendingRemoval.id);
    setAnnouncement(
      removed
        ? `Projekt ${pendingRemoval.name} wurde aus dieser Demo-Sitzung entfernt.`
        : "Das kanonische Demo-Projekt kann nicht entfernt werden.",
    );
    setPendingRemoval(null);
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Arbeitsvorbereitung</span>
          <h1>Kunden und Projekte</h1>
          <p>
            Kunde auswählen, Projekt öffnen oder einen synthetischen
            Demo-Eintrag anlegen.
          </p>
        </div>
        <button className="button" onClick={openCustomerForm} type="button">
          <UserRoundPlus size={18} aria-hidden="true" />
          Kunde anlegen
        </button>
      </header>

      <InlineNotice title="Nur Demodaten" tone="warning">
        <p>
          In diesem internen Arbeitsbereich dürfen keine echten Kunden- oder
          Adressdaten erfasst werden.
        </p>
      </InlineNotice>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {customerFormOpen ? (
        <section className="form-panel" aria-labelledby="new-customer-title">
          <div className="section-heading simple">
            <div>
              <span className="eyebrow">Synthetischer Eintrag</span>
              <h2 id="new-customer-title">Neuen Kunden anlegen</h2>
            </div>
          </div>
          <form onSubmit={submitCustomer} noValidate>
            <ErrorSummary errors={customerErrors} />
            <div className="field-row single">
              <label className="field">
                <span>Name des Demo-Kunden</span>
                <input
                  aria-describedby="customer-name-help"
                  aria-invalid={customerErrors.length > 0}
                  name="displayName"
                  placeholder="z. B. Demo-Wohnpark Sonnenhof"
                  ref={customerNameRef}
                />
                <small id="customer-name-help">
                  Keine echten Personen- oder Firmendaten eingeben.
                </small>
              </label>
            </div>
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setCustomerFormOpen(false)}
                type="button"
              >
                Abbrechen
              </button>
              <button className="button" type="submit">
                <Plus size={17} aria-hidden="true" />
                Demo-Kunde anlegen
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="directory-layout">
        <section
          className="customer-list-panel"
          aria-labelledby="customer-list-title"
        >
          <div className="section-heading simple">
            <div>
              <span className="eyebrow">{customers.length} Einträge</span>
              <h2 id="customer-list-title">Kunden</h2>
            </div>
          </div>
          <div className="customer-list">
            {customers.map(({ customer, projects }) => {
              const active = customer.id === selected?.customer.id;
              return (
                <button
                  aria-pressed={active}
                  className="customer-row"
                  data-active={active || undefined}
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setProjectFormOpen(false);
                  }}
                  type="button"
                >
                  <span className="customer-icon" aria-hidden="true">
                    <Building2 size={18} />
                  </span>
                  <span className="customer-row-copy">
                    <strong>{customer.displayName}</strong>
                    <small>
                      {projects.length === 1
                        ? "1 Projekt"
                        : `${projects.length} Projekte`}{" "}
                      · Synthetisch
                    </small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="customer-project-panel"
          aria-labelledby="selected-customer-title"
        >
          {selected ? (
            <>
              <div className="selected-customer-heading">
                <div>
                  <span className="eyebrow">Ausgewählter Kunde</span>
                  <h2 id="selected-customer-title">
                    {selected.customer.displayName}
                  </h2>
                  <p>
                    Seit {formatDate(selected.customer.createdAt)} ·
                    Synthetischer Demo-Datensatz
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={openProjectForm}
                  type="button"
                >
                  <Plus size={17} aria-hidden="true" />
                  Projekt anlegen
                </button>
              </div>

              {projectFormOpen ? (
                <form
                  className="inline-project-form"
                  onSubmit={submitProject}
                  noValidate
                >
                  <ErrorSummary errors={projectErrors} />
                  <div className="field-row">
                    <label className="field">
                      <span>Projektbezeichnung</span>
                      <input
                        aria-invalid={projectErrors.length > 0}
                        name="projectName"
                        placeholder="z. B. Flur neu streichen"
                        ref={projectNameRef}
                      />
                    </label>
                    <label className="field">
                      <span>Ort</span>
                      <input
                        aria-invalid={projectErrors.length > 0}
                        name="locationLabel"
                        placeholder="z. B. Bochum-Ehrenfeld"
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="button secondary"
                      onClick={() => setProjectFormOpen(false)}
                      type="button"
                    >
                      Abbrechen
                    </button>
                    <button className="button" type="submit">
                      <Plus size={17} aria-hidden="true" />
                      Projekt anlegen
                    </button>
                  </div>
                </form>
              ) : null}

              {selected.projects.length > 0 ? (
                <div className="directory-project-list">
                  {selected.projects.map((summary) => (
                    <article
                      className="directory-project-row"
                      key={summary.project.id}
                    >
                      <div className="directory-project-main">
                        <div className="directory-project-title">
                          <BriefcaseBusiness size={18} aria-hidden="true" />
                          <div>
                            <h3>{summary.project.name}</h3>
                            <p>
                              <MapPin size={14} aria-hidden="true" />{" "}
                              {summary.project.locationLabel}
                            </p>
                          </div>
                        </div>
                        <StatusBadge tone={draftStateTone(summary.draftState)}>
                          {draftStateLabel(summary.draftState)}
                        </StatusBadge>
                      </div>
                      <div className="directory-project-actions">
                        {!isCanonicalProject(summary.project.id) ? (
                          <button
                            className="icon-button"
                            onClick={() =>
                              setPendingRemoval({
                                id: summary.project.id,
                                name: summary.project.name,
                              })
                            }
                            type="button"
                          >
                            <Trash2 size={18} aria-hidden="true" />
                            <span className="sr-only">
                              {summary.project.name} entfernen
                            </span>
                          </button>
                        ) : null}
                        <Link
                          className="button secondary"
                          href={`/projekte/${summary.project.id}`}
                        >
                          Projekt öffnen
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Noch kein Projekt"
                  action={
                    <button
                      className="button"
                      onClick={openProjectForm}
                      type="button"
                    >
                      <Plus size={17} aria-hidden="true" />
                      Erstes Projekt anlegen
                    </button>
                  }
                >
                  <p>
                    Für diesen Demo-Kunden wurde noch kein Projekt angelegt.
                  </p>
                </EmptyState>
              )}
            </>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        confirmLabel="Demo-Projekt entfernen"
        description={`„${pendingRemoval?.name ?? "Dieses Projekt"}“ wird nur aus der aktuellen Demo-Sitzung entfernt. Dieser Schritt kann nicht rückgängig gemacht werden.`}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
        open={Boolean(pendingRemoval)}
        title="Projekt wirklich entfernen?"
      />
    </div>
  );
}
