import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Text,
  Tailwind,
  pixelBasedPreset,
} from "@react-email/components";
import * as React from "react";
import { BrandHeader } from "./BrandHeader.js";

interface InvitationEmailProps {
  email: string;
  invitedBy: string;
  organizationName: string;
  inviteLink: string;
}

export const InvitationEmail = ({ email, invitedBy, organizationName, inviteLink }: InvitationEmailProps) => {

  return (
    <Html>
      <Head />
      <Preview>You're invited to join {organizationName} on SWALHA Analytics</Preview>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: "#10b981",
                darkText: "#111827",
                mutedText: "#6b7280",
                borderColor: "#e5e7eb",
              },
            },
          },
        }}
      >
        <Body className="bg-white font-sans">
          <Container className="mx-auto py-8 px-6 max-w-[600px]">
            <BrandHeader />

            <Text className="text-darkText text-base leading-relaxed mb-4">Hi there,</Text>

            <Text className="text-darkText text-base leading-relaxed mb-4">
              {invitedBy} has invited you to join <span className="font-semibold">{organizationName}</span> on SWALHA
              Analytics.
            </Text>

            <Text className="text-darkText text-base leading-relaxed mb-4">
              SWALHA Analytics is an open-source analytics platform that helps you understand your website traffic while
              respecting user privacy.
            </Text>

            <Text className="text-darkText text-base leading-relaxed mb-4">
              <Link href={inviteLink} className="text-brand underline">
                Accept the invitation
              </Link>
            </Text>

            <Text className="text-mutedText text-sm leading-relaxed">This invitation was sent to {email}.</Text>

            <Hr className="border-borderColor my-8" />

            <Text className="text-mutedText text-xs">SWALHA Analytics</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
