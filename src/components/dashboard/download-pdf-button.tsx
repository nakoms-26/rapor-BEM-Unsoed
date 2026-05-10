"use client";

import { useEffect, useState } from "react";

type Props = {
  reportId: string;
};

export function DownloadPdfButton({ reportId }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function onDownloadPdf() {
    const reportElement = document.getElementById(reportId);

    if (!reportElement) {
      return;
    }

    const printWindow = window.open("", "Rapor BEM Unsoed", "width=1024,height=768");
    if (!printWindow) {
      return;
    }

    const styleAndLinkTags = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((node) => node.outerHTML)
      .join("\n");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Rapor BEM Unsoed 2026</title>
          ${styleAndLinkTags}
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: #ffffff;
              color: #0f172a;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: auto;
            }

            th,
            td {
              border: 1px solid #e2e8f0;
              padding: 6px 8px;
              vertical-align: top;
              word-break: normal;
              overflow-wrap: normal;
              white-space: normal;
            }

            th {
              line-height: 1.25;
            }

            .prestasi-table th:nth-child(1),
            .prestasi-table td:nth-child(1) {
              width: 34px;
            }

            .prestasi-table th:nth-child(2),
            .prestasi-table td:nth-child(2) {
              min-width: 150px;
            }

            .prestasi-table th:nth-child(3),
            .prestasi-table td:nth-child(3) {
              min-width: 120px;
            }

            .prestasi-table th:nth-child(4),
            .prestasi-table td:nth-child(4),
            .prestasi-table th:nth-child(5),
            .prestasi-table td:nth-child(5),
            .prestasi-table th:nth-child(6),
            .prestasi-table td:nth-child(6),
            .prestasi-table th:nth-child(7),
            .prestasi-table td:nth-child(7),
            .prestasi-table th:nth-child(8),
            .prestasi-table td:nth-child(8) {
              min-width: 70px;
            }

            h1,
            h2,
            h3,
            h4,
            p {
              margin-top: 0;
            }

            .print\:hidden {
              display: none !important;
            }

            .rounded-lg,
            .rounded-md {
              border-radius: 8px;
            }

            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          </style>
        </head>
        <body>
          ${reportElement.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    const styleSheets = Array.from(printWindow.document.querySelectorAll("link[rel='stylesheet']"));
    let loadedCount = 0;
    const done = () => {
      loadedCount += 1;
      if (loadedCount >= styleSheets.length) {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    };

    if (!styleSheets.length) {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      return;
    }

    styleSheets.forEach((sheet) => {
      sheet.addEventListener("load", done);
      sheet.addEventListener("error", done);
    });

    window.setTimeout(() => {
      if (loadedCount < styleSheets.length) {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }, 1200);
  }

  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onDownloadPdf}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 print:hidden"
    >
      Download PDF
    </button>
  );
}
