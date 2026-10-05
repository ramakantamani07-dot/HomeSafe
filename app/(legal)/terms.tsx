import { LegalDocumentScreen, type LegalSection } from '../../src/components/legal/LegalDocumentScreen';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Acceptance of these terms',
    body:
      'By creating a wayLoc account you agree to these terms and to our Privacy Policy. If ' +
      'you do not agree, please do not use the app.',
  },
  {
    heading: '2. What wayLoc is — and is not',
    body:
      'wayLoc is a tool intended to help you stay in touch with people you trust during a ' +
      'journey, and to make it easier for them to notice and respond if something seems wrong. ' +
      'wayLoc is not a monitored emergency response service, is not connected to police, ' +
      'ambulance, or any other emergency service, and does not guarantee that an alert will be ' +
      'delivered, or delivered in time. Alerts depend on your phone having battery, a network ' +
      'connection, and the app installed and permitted to run in the background — none of which ' +
      'wayLoc can guarantee. In a genuine emergency, always contact your local emergency ' +
      'number directly (999 in the UK, 112 in India) — do not rely on wayLoc as your only way ' +
      'to get help.',
  },
  {
    heading: '3. Eligibility',
    body:
      'You must be 18 or older to create a wayLoc account, and must provide a phone number you ' +
      'control in order to sign in.',
  },
  {
    heading: '4. Your responsibilities',
    body:
      'Keep your account and device secure. Provide accurate information, including for any ' +
      'trusted contact you add — you confirm you have their agreement to be added and to receive ' +
      'safety alerts on your behalf. Do not use wayLoc to monitor another adult without their ' +
      'knowledge and consent. Do not use the fake call or any other feature to deceive or harm ' +
      'someone else.',
  },
  {
    heading: '5. Limitation of liability',
    body:
      'To the fullest extent permitted by law, wayLoc and its team are not liable for any harm ' +
      'arising from a missed, delayed, or failed alert; from reliance on journey tracking, check-' +
      'ins, or family status information; or from any action or inaction by a trusted contact. ' +
      'wayLoc is provided "as is," and we do not warrant that the service will be uninterrupted ' +
      'or error-free.',
  },
  {
    heading: '6. Pricing',
    body:
      'wayLoc\'s core safety features — SOS, journey tracking, check-ins, and the fake call — ' +
      'are free and will remain free. Any optional paid tier will always show its price and what ' +
      'it includes before you are charged, and we will update these terms with the specifics ' +
      'before any paid tier is offered.',
  },
  {
    heading: '7. Account termination',
    body:
      'You can delete your account at any time from Privacy & Security → Delete Account. We may ' +
      'suspend or terminate an account that we reasonably believe is being used to harm or ' +
      'deceive another person, or in violation of these terms.',
  },
  {
    heading: '8. Governing law',
    body: 'These terms are governed by the laws of England and Wales.',
  },
  {
    heading: '9. Changes to these terms',
    body:
      'We will update the "Last updated" date above whenever these terms change, and will let ' +
      'you know in the app before any material change takes effect.',
  },
  {
    heading: '10. Contact us',
    body: 'Questions about these terms: hello@homesafeapp.com',
  },
];

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      lastUpdated="2026-09-02"
      sections={SECTIONS}
    />
  );
}
