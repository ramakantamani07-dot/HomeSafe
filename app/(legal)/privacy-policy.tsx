import { LegalDocumentScreen, type LegalSection } from '../../src/components/legal/LegalDocumentScreen';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Who we are',
    body:
      'wayLoc ("we", "us") provides a personal safety app offering journey tracking, ' +
      'SOS alerts, check-ins, family status sharing, and a discreet fake call feature. This ' +
      'policy explains what information we collect, why, and what control you have over it. ' +
      'We currently operate for users in the United Kingdom and India.',
  },
  {
    heading: '2. Information we collect',
    body:
      'Account: your phone number (used to sign in via one-time code) and the name you choose ' +
      'to add to your profile.\n\n' +
      'Location: GPS coordinates, collected only while you have an active journey or an active ' +
      'SOS. We do not track your location at any other time.\n\n' +
      'Journeys and check-ins: destination labels, start/end times, route distance and duration, ' +
      'and your check-in responses.\n\n' +
      'Trusted contacts: the name and phone number you enter for each contact you choose to add. ' +
      'This is personal information about someone else, provided by you — please only add ' +
      'contacts who have agreed to be added.\n\n' +
      'Device information: a push-notification token, used solely to deliver safety alerts to ' +
      'your device, and your battery level, used to adjust how often we check your location and ' +
      'to warn your contacts if your battery is critically low during an active journey.\n\n' +
      'We do not collect advertising identifiers, and we do not use any third-party analytics ' +
      'or advertising SDKs.',
  },
  {
    heading: '3. How we use your information',
    body:
      'To provide the app\'s core safety features: tracking an active journey, sending SOS and ' +
      'missed-check-in alerts to the contacts you choose, and showing family status to ' +
      'connections you have approved. We do not use your data for advertising, and we do not ' +
      'build behavioural profiles.',
  },
  {
    heading: '4. How your information is shared',
    body:
      'With your trusted contacts and family connections, only as far as your own sharing ' +
      'settings allow (see the Family screen for exact controls per connection — sharing mode, ' +
      'and whether battery level, journey details, and status are included). Nothing is shared ' +
      'with a contact until you add them, and you can change or revoke sharing at any time.\n\n' +
      'With emergency contacts you name, in the event of an SOS.\n\n' +
      'We do not sell your data, and we do not share it with advertisers or data brokers. We ' +
      'have never done this and it is not something that can change via a future policy update ' +
      'without your explicit, separate consent.\n\n' +
      'We may disclose information if required to do so by law, or to protect the rights, ' +
      'safety, or property of our users or the public.',
  },
  {
    heading: '5. Where your data is stored and how it is protected',
    body:
      'Your profile and app preferences are stored on your device in its secure hardware-backed ' +
      'storage (SecureStore) and never leave it. Journey records, GPS trails, check-in history, ' +
      'SOS events, and trusted contacts are stored in Firebase (EU region) to enable real-time ' +
      'sharing with your trusted contacts. Data in transit and at rest is encrypted.',
  },
  {
    heading: '6. How long we keep your data',
    body:
      'GPS trail for a completed journey: 30 days. GPS trail for a cancelled or missed-check-in ' +
      'journey: 7 days. SOS event records: 90 days after resolution (kept for safety audit ' +
      'purposes; an unresolved SOS record is never automatically deleted). Journey summaries ' +
      '(destination and dates, without the GPS trail) and trusted contacts: kept until you ' +
      'remove them or delete your account. You can delete your detailed location history at any ' +
      'time from the Privacy & Security screen, and delete your entire account and all ' +
      'associated data from the same screen.',
  },
  {
    heading: '7. Your rights',
    body:
      'If you are in the United Kingdom, UK GDPR gives you the right to access, correct, delete, ' +
      'restrict, and object to processing of your personal data, and to receive a copy of it in ' +
      'a portable format. If you are in India, the Digital Personal Data Protection Act 2023 ' +
      'gives you comparable rights to access, correction, and erasure. In-app self-service ' +
      'tools cover deletion today (Privacy & Security → Delete Account); for any other request, ' +
      'including a copy of your data, contact us using the details below and we will respond ' +
      'within the timeframe required by applicable law.',
  },
  {
    heading: '8. Children',
    body:
      'wayLoc accounts are intended for users aged 18 and over. We are aware that some of our ' +
      'safety features are relevant to protecting younger people (for example, a child\'s ' +
      'journey home from school), and we are actively working out the right way to support that ' +
      'safely and lawfully. Until that is finalised, please do not create an account on behalf ' +
      'of a child, and a parent or guardian should hold the account and manage sharing for any ' +
      'family member who is a minor.',
  },
  {
    heading: '9. Changes to this policy',
    body:
      'We will update the "Last updated" date above whenever this policy changes, and will let ' +
      'you know in the app before any material change takes effect.',
  },
  {
    heading: '10. Contact us',
    body: 'Questions about this policy or your data: hello@homesafeapp.com',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      lastUpdated="2026-09-02"
      intro="Your privacy is not a feature we bolted on — it is a founding principle. This page explains exactly what we collect, why, and how to control it."
      sections={SECTIONS}
    />
  );
}
