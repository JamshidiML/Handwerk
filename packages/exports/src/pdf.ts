import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { ApprovedOfferViewModel } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 58;

const COLOR = {
  ink: rgb(0.1, 0.13, 0.12),
  muted: rgb(0.34, 0.38, 0.36),
  line: rgb(0.82, 0.85, 0.83),
  brand: rgb(0.04, 0.31, 0.23),
  accent: rgb(0.94, 0.68, 0.16),
  warning: rgb(0.67, 0.12, 0.12),
  warningBackground: rgb(0.99, 0.92, 0.91),
  soft: rgb(0.95, 0.97, 0.96),
};

function pdfSafeText(value: string): string {
  return (
    value
      .normalize("NFC")
      // eslint-disable-next-line no-control-regex -- PDF text must exclude all C0 controls.
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/[\u00a0\u202f]/g, " ")
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u2026/g, "...")
      .replace(/[^\u0020-\u007e\u00a1-\u00ff\u20ac]/g, "?")
  );
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safe = pdfSafeText(value);
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const rawWord of words) {
    const parts =
      font.widthOfTextAtSize(rawWord, size) > maxWidth
        ? splitLongWord(rawWord, font, size, maxWidth)
        : [rawWord];
    for (const part of parts) {
      const candidate = current ? `${current} ${part}` : part;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatGermanMinor(minor: number): string {
  const euros = Math.floor(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  return `${euros.toLocaleString("de-DE")},${cents} EUR`;
}

function formatGermanDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

function unitLabel(unit: string): string {
  return (
    {
      M2: "m²",
      M: "m",
      STK: "Stk.",
      STD: "Std.",
      PAUSCHALE: "pauschal",
    }[unit] ?? unit
  );
}

export async function renderOfferPdf(
  model: ApprovedOfferViewModel,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const issuedAt = new Date(model.issuedAt);
  document.setTitle(`Angebot ${model.offerNumber} - SYNTHETISCHE DEMO-DATEN`);
  document.setAuthor(model.organisationName);
  document.setSubject(`Angebot für ${model.projectName}`);
  document.setCreator("Handwerk Quote Copilot - interner Vertical Slice");
  document.setProducer("Handwerk Quote Copilot");
  document.setCreationDate(issuedAt);
  document.setModificationDate(issuedAt);

  const pages: PDFPage[] = [];
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 0;

  const addPage = () => {
    if (pages.length > 0) page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - 96;
  };

  const ensureSpace = (height: number) => {
    if (y - height < CONTENT_BOTTOM) addPage();
  };

  const drawWrapped = (
    text: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      lineHeight?: number;
      gapAfter?: number;
    } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 9.5;
    const x = options.x ?? MARGIN;
    const width = options.width ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? size * 1.35;
    const lines = wrapText(text, font, size, width);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x,
        y,
        size,
        font,
        color: options.color ?? COLOR.ink,
      });
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 0;
  };

  const drawSectionHeading = (label: string) => {
    ensureSpace(31);
    y -= 8;
    page.drawText(pdfSafeText(label), {
      x: MARGIN,
      y,
      size: 12,
      font: bold,
      color: COLOR.brand,
    });
    y -= 9;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: COLOR.line,
    });
    y -= 16;
  };

  addPage();
  drawWrapped("ANGEBOT", {
    font: bold,
    size: 24,
    color: COLOR.ink,
    lineHeight: 29,
    gapAfter: 4,
  });
  drawWrapped(model.organisationName, {
    font: bold,
    size: 10.5,
    color: COLOR.brand,
    gapAfter: 12,
  });

  ensureSpace(84);
  page.drawRectangle({
    x: MARGIN,
    y: y - 64,
    width: CONTENT_WIDTH,
    height: 70,
    color: COLOR.soft,
  });
  const detailsY = y - 11;
  const drawDetail = (label: string, value: string, x: number, row: number) => {
    page.drawText(pdfSafeText(label), {
      x,
      y: detailsY - row * 22,
      size: 7.5,
      font: bold,
      color: COLOR.muted,
    });
    page.drawText(pdfSafeText(value).slice(0, 62), {
      x,
      y: detailsY - row * 22 - 10,
      size: 9,
      font: regular,
      color: COLOR.ink,
    });
  };
  drawDetail("ANGEBOTSNUMMER", model.offerNumber, MARGIN + 12, 0);
  drawDetail(
    "DATUM / REVISION",
    `${formatGermanDate(model.issuedAt)} / ${model.revision}`,
    MARGIN + 278,
    0,
  );
  drawDetail("EMPFÄNGER", model.recipientName, MARGIN + 12, 1);
  drawDetail(
    "PROJEKT",
    model.projectLocation
      ? `${model.projectName}, ${model.projectLocation}`
      : model.projectName,
    MARGIN + 278,
    1,
  );
  y -= 82;

  drawSectionHeading("Leistungen");
  model.lines.forEach((line, index) => {
    const descriptionLines = wrapText(
      line.description,
      regular,
      9.3,
      CONTENT_WIDTH,
    );
    const itemHeight =
      16 + descriptionLines.length * 12.2 + 5 + 30 + 12 + 12 + 13;
    ensureSpace(itemHeight);
    page.drawText(`${index + 1}.  ${pdfSafeText(line.itemCode)}`, {
      x: MARGIN,
      y,
      size: 10,
      font: bold,
      color: COLOR.brand,
    });
    y -= 16;
    drawWrapped(line.description, {
      size: 9.3,
      lineHeight: 12.2,
      gapAfter: 5,
    });
    ensureSpace(30);
    const quantity = `${line.quantity} ${unitLabel(line.unit)}`;
    page.drawText(pdfSafeText(quantity), {
      x: MARGIN,
      y,
      size: 8.8,
      font: regular,
      color: COLOR.ink,
    });
    page.drawText(formatGermanMinor(line.unitPriceMinor), {
      x: MARGIN + 220,
      y,
      size: 8.8,
      font: regular,
      color: COLOR.ink,
    });
    const net = formatGermanMinor(line.netMinor);
    page.drawText(net, {
      x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(net, 9),
      y,
      size: 9,
      font: bold,
      color: COLOR.ink,
    });
    y -= 12;
    page.drawText(
      `Menge | Einheitspreis | Netto, MwSt. ${taxPercentLabel(line.taxRateBasisPoints)}`,
      {
        x: MARGIN,
        y,
        size: 7,
        font: regular,
        color: COLOR.muted,
      },
    );
    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.7,
      color: COLOR.line,
    });
    y -= 13;
  });

  if (model.unpricedItems.length > 0) {
    drawSectionHeading("Nicht bepreiste Hinweise");
    for (const item of model.unpricedItems) {
      const label =
        item.status === "EXCLUDED" ? "Ausgeschlossen" : "Nicht zugeordnet";
      drawWrapped(`${label}: ${item.key}`, {
        font: bold,
        size: 9,
        color: item.status === "UNMATCHED" ? COLOR.warning : COLOR.ink,
        gapAfter: 2,
      });
      drawWrapped(item.reason, {
        size: 8.6,
        color: COLOR.muted,
        gapAfter: 8,
      });
    }
  }

  drawSectionHeading("Summen");
  ensureSpace(88);
  const totalRows = [
    ["Nettosumme", formatGermanMinor(model.netMinor), regular],
    ["Umsatzsteuer", formatGermanMinor(model.taxMinor), regular],
    ["Gesamtsumme", formatGermanMinor(model.grossMinor), bold],
  ] as const;
  for (const [label, value, font] of totalRows) {
    page.drawText(label, {
      x: MARGIN + 260,
      y,
      size: font === bold ? 11 : 9.5,
      font,
      color: COLOR.ink,
    });
    page.drawText(value, {
      x:
        PAGE_WIDTH -
        MARGIN -
        font.widthOfTextAtSize(value, font === bold ? 11 : 9.5),
      y,
      size: font === bold ? 11 : 9.5,
      font,
      color: COLOR.ink,
    });
    y -= font === bold ? 25 : 20;
  }

  if (model.notes.length > 0) {
    drawSectionHeading("Hinweise");
    for (const note of model.notes) {
      drawWrapped(`- ${note}`, { size: 8.8, lineHeight: 12, gapAfter: 5 });
    }
  }

  pages.forEach((footerPage, index) => {
    footerPage.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 40,
      width: PAGE_WIDTH,
      height: 40,
      color: COLOR.brand,
    });
    footerPage.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 44,
      width: PAGE_WIDTH,
      height: 4,
      color: COLOR.accent,
    });
    footerPage.drawText("WESTBLICK", {
      x: MARGIN,
      y: PAGE_HEIGHT - 28,
      size: 15,
      font: bold,
      color: rgb(1, 1, 1),
    });
    footerPage.drawText("Malerbetrieb", {
      x: MARGIN + 104,
      y: PAGE_HEIGHT - 27,
      size: 8,
      font: regular,
      color: rgb(0.85, 0.94, 0.9),
    });
    footerPage.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - 76,
      width: CONTENT_WIDTH,
      height: 22,
      color: COLOR.warningBackground,
    });
    footerPage.drawText("SYNTHETISCHE DEMO-DATEN - NICHT ZUM VERSAND", {
      x: MARGIN + 9,
      y: PAGE_HEIGHT - 69,
      size: 8.5,
      font: bold,
      color: COLOR.warning,
    });
    footerPage.drawLine({
      start: { x: MARGIN, y: 42 },
      end: { x: PAGE_WIDTH - MARGIN, y: 42 },
      thickness: 0.6,
      color: COLOR.line,
    });
    const footer = `Angebot ${pdfSafeText(model.offerNumber)} | Synthetische Demo-Daten | Seite ${index + 1} von ${pages.length}`;
    footerPage.drawText(footer, {
      x: MARGIN,
      y: 27,
      size: 7.3,
      font: regular,
      color: COLOR.muted,
    });
  });

  return document.save({ useObjectStreams: false, addDefaultPage: false });
}

function taxPercentLabel(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction
    ? `${whole},${String(fraction).padStart(2, "0")} %`
    : `${whole} %`;
}
