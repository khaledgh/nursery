export interface Section {
  h: string;
  p?: string[];
  list?: string[];
}

export interface LegalContent {
  links: { privacy: string; support: string; deleteAccount: string; legal: string };
  updated: string;
  backHome: string;
  privacy: { title: string; description: string; intro: string[]; sections: Section[] };
  support: {
    title: string;
    description: string;
    intro: string;
    contactTitle: string;
    contactBody: string;
    responseTime: string;
    faqTitle: string;
    faq: { q: string; a: string }[];
    nurseryTitle: string;
    nurseryBody: string;
  };
  deletion: { title: string; description: string; intro: string[]; sections: Section[]; button: string };
}

// "{email}" is replaced with the support address when rendered.
const en: LegalContent = {
  links: { privacy: "Privacy Policy", support: "Support", deleteAccount: "Delete account", legal: "Legal & help" },
  updated: "Last updated: September 28, 2026",
  backHome: "Back to home",

  privacy: {
    title: "Privacy Policy",
    description: "How Nursee+ collects, uses and protects information about families, children and nursery staff.",
    intro: [
      "Nursee+ is a nursery management platform made up of a web dashboard for nursery administrators and mobile apps for parents and teachers. This policy explains what information the Nursee+ apps and website collect, why, and the choices you have.",
      "Nursee+ is used by nurseries. The nursery you are connected to decides what information about children and families is recorded, and Nursee+ processes that information on the nursery's behalf to provide the service.",
    ],
    sections: [
      {
        h: "1. Information we collect",
        list: [
          "Account information: name, email address or login ID, phone number, role (administrator, teacher or parent), preferred language and optional profile photo. Passwords are stored only in hashed form.",
          "Children's information entered by the nursery or parents: name, date of birth, gender, photo, classroom, attendance, and daily care records such as meals, naps, diapers and activities, plus development milestones and progress reports.",
          "Health information: allergies, medical conditions, medications, incidents and blood type, only when entered by the nursery or a parent.",
          "Photos and media shared by nursery staff with a child's family.",
          "Messages and communications: chat messages between parents, teachers and the nursery office, announcements, event responses and notification settings.",
          "Billing information: tuition invoices and payment status. Card or bank details are handled by the payment provider and are not stored by Nursee+.",
          "Device information: a push notification identifier, the device platform (iOS or Android) and app language, used to deliver notifications.",
          "Technical information: IP address and server logs, used for security and to keep the service running.",
          "Website demo requests: name, nursery name, email, phone, city, country and your message, when you fill in the form on our website.",
        ],
      },
      {
        h: "2. How we use information",
        list: [
          "To provide the service: showing parents their child's day, letting teachers record care, and letting nurseries manage enrollment, attendance, communication and billing.",
          "To send notifications you asked for, such as new messages, announcements and daily updates.",
          "To keep accounts and data secure, prevent abuse and troubleshoot problems.",
          "To answer support requests and demo requests.",
        ],
        p: [
          "We do not sell personal information, we do not show advertising, and we do not use your information to track you across other apps or websites. The apps contain no advertising or analytics SDKs.",
        ],
      },
      {
        h: "3. Children's privacy",
        p: [
          "Children do not use the Nursee+ apps. Accounts are only created for adults (parents, guardians and nursery staff) by the nursery. Information about a child is visible only to that child's linked guardians and to authorised staff at the child's nursery.",
        ],
      },
      {
        h: "4. How information is shared",
        list: [
          "Within your nursery: staff see the information they need for their role; parents see only their own children.",
          "Service providers that help us run Nursee+: cloud hosting and file storage, OneSignal for push notifications, and payment providers for tuition payments. They may only use the information to provide their service to us.",
          "When required by law, or to protect the safety of children, users or the service.",
        ],
        p: ["We never sell or rent personal information."],
      },
      {
        h: "5. App permissions",
        list: [
          "Notifications: to alert you about messages and updates. You can turn them off in your device settings or in the app's notification settings.",
          "Camera and photo library: only when you choose to take or attach a photo, or save a photo to your device.",
        ],
        p: ["Nursee+ does not access your location or contacts."],
      },
      {
        h: "6. Data retention",
        p: [
          "We keep information for as long as the account is active and the nursery uses Nursee+. When an account is deleted, or a nursery stops using the service, the related personal information is deleted or anonymised within 30 days, unless we must keep certain records longer to meet legal obligations (for example invoices).",
        ],
      },
      {
        h: "7. Security",
        p: [
          "All traffic is encrypted with HTTPS. Passwords are hashed, sign-in tokens are kept in the device's secure storage, access is limited by role, and each nursery's data is kept separate from other nurseries. No system is perfectly secure, but we work to protect your information and fix issues quickly.",
        ],
      },
      {
        h: "8. Your rights and choices",
        p: [
          "You can ask to access, correct, export or delete your personal information. Many details can be updated by your nursery directly. You can also contact us at {email}, or follow the steps on our Delete account page. We may need to confirm your identity and involve your nursery, which manages the records about your child.",
        ],
      },
      {
        h: "9. Changes to this policy",
        p: [
          "We may update this policy from time to time. We will change the date at the top of this page, and for significant changes we will notify users in the app.",
        ],
      },
      {
        h: "10. Contact us",
        p: ["Questions about this policy or your information: {email}."],
      },
    ],
  },

  support: {
    title: "Support",
    description: "Get help with the Nursee+ parent and teacher apps.",
    intro: "We're here to help parents, teachers and nursery teams get the most out of Nursee+.",
    contactTitle: "Contact support",
    contactBody: "Email us and include your nursery's name and the email or login ID you use in the app.",
    responseTime: "We reply within 1–2 business days.",
    faqTitle: "Frequently asked questions",
    faq: [
      {
        q: "How do I get a Nursee+ account?",
        a: "Accounts are created by your nursery. Ask your nursery's office to add you, and they will share your sign-in details.",
      },
      {
        q: "I forgot my password or can't sign in.",
        a: "Contact your nursery's office: administrators can reset your password from the Nursee+ dashboard. If that doesn't work, email us at {email}.",
      },
      {
        q: "I'm not receiving notifications.",
        a: "Make sure notifications are allowed for Nursee+ in your phone's settings, check the notification settings inside the app, and update to the latest version of the app. Signing out and in again also refreshes your device registration.",
      },
      {
        q: "How do I change the app language?",
        a: "Open the More tab and choose your language. Nursee+ supports Arabic, English and French.",
      },
      {
        q: "Who can see my child's information and photos?",
        a: "Only you, other guardians linked to your child, and authorised staff at your nursery. See our Privacy Policy for details.",
      },
      {
        q: "How do I delete my account?",
        a: "Follow the steps on our Delete account page, or email {email} from the address linked to your account.",
      },
    ],
    nurseryTitle: "Are you a nursery?",
    nurseryBody: "Want to use Nursee+ at your nursery? Request a free demo and our team will get in touch.",
  },

  deletion: {
    title: "Delete your account",
    description: "How to request deletion of your Nursee+ account and data.",
    intro: [
      "You can ask us to delete your Nursee+ account and the personal information linked to it at any time.",
    ],
    sections: [
      {
        h: "How to request deletion",
        list: [
          "Send an email to {email} from the email address linked to your Nursee+ account, with the subject \"Delete my account\".",
          "Include your full name and your nursery's name.",
          "We will confirm your request and complete the deletion within 30 days. You can also ask your nursery's administrator to remove your account.",
        ],
      },
      {
        h: "What gets deleted",
        list: [
          "Your account and profile (name, email, phone, photo) and your device's notification registration.",
          "Your messages and notification settings.",
          "If you are the only guardian linked to a child, the child's profile, care records and photos are removed together with the nursery.",
        ],
      },
      {
        h: "What may be kept",
        p: [
          "Some records may be kept for a limited time where the law requires it, for example invoices and payment records, or where the nursery must keep attendance records. These are kept securely and deleted when no longer required.",
        ],
      },
    ],
    button: "Email a deletion request",
  },
};

export default en;
