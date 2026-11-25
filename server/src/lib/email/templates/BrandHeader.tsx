import { Img } from "@react-email/components";
import * as React from "react";

export const BRAND_NAME = "Swalha Analytics";

/**
 * Canonical SWALHA mark, served from the brand domain so it resolves in email
 * clients regardless of where this instance is deployed. The same artwork ships
 * in-repo at brand/swalha-logo.png.
 */
export const BRAND_LOGO_URL = "https://swalha.com/logo.png";

/**
 * Mark + product name lockup, rendered at the top of every email by the shared
 * Ledger layout (ledger.tsx). Laid out as a table with inline styles, like the
 * rest of Ledger: Gmail and Outlook drop flexbox and most of <head>.
 */
export const BrandHeader = () => (
  <table cellPadding={0} cellSpacing={0} border={0} role="presentation">
    <tbody>
      <tr>
        <td style={{ width: 28, paddingRight: 8, verticalAlign: "middle" }}>
          <Img src={BRAND_LOGO_URL} alt="" width="20" height="20" style={{ display: "block", border: 0 }} />
        </td>
        <td
          style={{
            verticalAlign: "middle",
            fontSize: 15,
            lineHeight: "20px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#0a0a0a",
          }}
        >
          {BRAND_NAME}
        </td>
      </tr>
    </tbody>
  </table>
);
