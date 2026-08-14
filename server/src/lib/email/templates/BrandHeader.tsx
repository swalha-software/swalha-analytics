import { Column, Img, Row, Section, Text } from "@react-email/components";
import * as React from "react";

export const BRAND_NAME = "Swalha Analytics";

/**
 * Canonical SWALHA mark, served from the brand domain so it resolves in email
 * clients regardless of where this instance is deployed. The same artwork ships
 * in-repo at brand/swalha-logo.png.
 */
export const BRAND_LOGO_URL = "https://swalha.com/logo.png";

/**
 * Mark + product name lockup for email. Laid out as a table (react-email Row /
 * Column) rather than flexbox, which most email clients do not support.
 */
export const BrandHeader = ({ className = "mb-8" }: { className?: string }) => (
  <Section className={className}>
    <Row>
      <Column style={{ width: "36px" }}>
        <Img src={BRAND_LOGO_URL} alt="" width="28" height="28" />
      </Column>
      <Column>
        <Text className="text-darkText text-lg font-semibold m-0">{BRAND_NAME}</Text>
      </Column>
    </Row>
  </Section>
);
