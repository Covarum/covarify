import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DISPLAY_SEPARATOR,
  displaySeparated,
} from "../lib/presentation-separators.ts";

const financialPresentationFiles = [
  "app/account/page.tsx",
  "app/api/account/transactions/route.ts",
  "components/account/authenticated-workspace.tsx",
  "components/account/category-intelligence.tsx",
  "components/account/financial-events-review.tsx",
  "components/account/money-picture-observations.tsx",
  "components/account/recent-activity.tsx",
  "lib/financial-event-review-server.ts",
  "lib/money-picture.ts",
  "lib/money-picture-explanations.ts",
];

test("shared separator renders the intended production strings", () => {
  assert.equal(DISPLAY_SEPARATOR, "•");
  assert.equal(
    displaySeparated(
      "This quarter",
      "Transfers and pending activity excluded",
    ),
    "This quarter • Transfers and pending activity excluded",
  );
  assert.equal(displaySeparated("$597.90", "27%"), "$597.90 • 27%");
});

test("server-rendered output preserves the separator without mojibake", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      "p",
      null,
      displaySeparated("$597.90", "27%"),
    ),
  );
  assert.equal(markup, "<p>$597.90 • 27%</p>");
  assert.doesNotMatch(markup, /Â|Ã|â€¢|Â·/);
});

test("client financial surfaces share the same safe formatter", async () => {
  const category = await readFile(
    "components/account/category-intelligence.tsx",
    "utf8",
  );
  const activity = await readFile(
    "components/account/recent-activity.tsx",
    "utf8",
  );
  assert.match(category, /displaySeparated/);
  assert.match(activity, /displaySeparated/);
  assert.equal(
    displaySeparated("This quarter", "$597.90", "27%"),
    "This quarter • $597.90 • 27%",
  );
});

test("financial presentation source contains no corrupted separators", async () => {
  for (const file of financialPresentationFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /Â|Ã|â€¢|Â·|·/, file);
  }
});
