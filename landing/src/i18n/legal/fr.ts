import type { LegalContent } from "./en";

const fr: LegalContent = {
  links: {
    privacy: "Politique de confidentialité",
    support: "Assistance",
    deleteAccount: "Supprimer le compte",
    legal: "Informations & aide",
  },
  updated: "Dernière mise à jour : 28 septembre 2026",
  backHome: "Retour à l'accueil",

  privacy: {
    title: "Politique de confidentialité",
    description:
      "Comment Nursee+ collecte, utilise et protège les informations concernant les familles, les enfants et le personnel des crèches.",
    intro: [
      "Nursee+ est une plateforme de gestion de crèche composée d'un tableau de bord web pour la direction et d'applications mobiles pour les parents et les enseignants. Cette politique explique quelles informations les applications et le site Nursee+ collectent, pourquoi, et quels choix s'offrent à vous.",
      "Nursee+ est utilisé par des crèches. La crèche à laquelle vous êtes rattaché décide des informations enregistrées sur les enfants et les familles, et Nursee+ traite ces informations pour le compte de la crèche afin de fournir le service.",
    ],
    sections: [
      {
        h: "1. Informations collectées",
        list: [
          "Informations de compte : nom, adresse e-mail ou identifiant, numéro de téléphone, rôle (direction, enseignant ou parent), langue préférée et photo de profil facultative. Les mots de passe sont uniquement stockés sous forme chiffrée (hachée).",
          "Informations sur l'enfant saisies par la crèche ou les parents : nom, date de naissance, sexe, photo, classe, présences et journal quotidien (repas, siestes, changes, activités), ainsi que les étapes de développement et les bilans.",
          "Informations de santé : allergies, conditions médicales, médicaments, incidents et groupe sanguin, uniquement lorsqu'ils sont saisis par la crèche ou un parent.",
          "Photos et médias partagés par le personnel de la crèche avec la famille de l'enfant.",
          "Messages et communications : conversations entre parents, enseignants et direction, annonces, réponses aux événements et préférences de notification.",
          "Facturation : factures de frais de garde et statut des paiements. Les données de carte ou bancaires sont traitées par le prestataire de paiement et ne sont pas conservées par Nursee+.",
          "Informations sur l'appareil : identifiant de notification, système (iOS ou Android) et langue de l'application, pour l'envoi des notifications.",
          "Informations techniques : adresse IP et journaux serveur, à des fins de sécurité et de bon fonctionnement.",
          "Demandes de démo sur le site : nom, nom de la crèche, e-mail, téléphone, ville, pays et message, lorsque vous remplissez le formulaire.",
        ],
      },
      {
        h: "2. Utilisation des informations",
        list: [
          "Fournir le service : montrer aux parents la journée de leur enfant, permettre aux enseignants de saisir les soins et aux crèches de gérer inscriptions, présences, communication et facturation.",
          "Envoyer les notifications demandées, comme les nouveaux messages, annonces et nouvelles du jour.",
          "Protéger les comptes et les données, prévenir les abus et résoudre les problèmes.",
          "Répondre aux demandes d'assistance et de démo.",
        ],
        p: [
          "Nous ne vendons pas de données personnelles, n'affichons pas de publicité et n'utilisons pas vos informations pour vous suivre sur d'autres applications ou sites. Les applications ne contiennent aucun outil publicitaire ou d'analyse.",
        ],
      },
      {
        h: "3. Confidentialité des enfants",
        p: [
          "Les enfants n'utilisent pas les applications Nursee+. Seuls des adultes (parents, tuteurs et personnel) disposent d'un compte, créé par la crèche. Les informations d'un enfant ne sont visibles que par ses tuteurs rattachés et par le personnel autorisé de sa crèche.",
        ],
      },
      {
        h: "4. Partage des informations",
        list: [
          "Au sein de votre crèche : le personnel voit les informations nécessaires à son rôle ; les parents ne voient que leurs propres enfants.",
          "Prestataires qui nous aident à exploiter Nursee+ : hébergement cloud et stockage de fichiers, OneSignal pour les notifications et prestataires de paiement. Ils ne peuvent utiliser les informations que pour nous fournir leur service.",
          "Lorsque la loi l'exige, ou pour protéger la sécurité des enfants, des utilisateurs ou du service.",
        ],
        p: ["Nous ne vendons ni ne louons jamais de données personnelles."],
      },
      {
        h: "5. Autorisations de l'application",
        list: [
          "Notifications : pour vous avertir des messages et nouvelles. Vous pouvez les désactiver dans les réglages de l'appareil ou dans les préférences de notification de l'application.",
          "Appareil photo et photothèque : uniquement lorsque vous choisissez de prendre, joindre ou enregistrer une photo.",
        ],
        p: ["Nursee+ n'accède ni à votre position ni à vos contacts."],
      },
      {
        h: "6. Conservation des données",
        p: [
          "Nous conservons les informations tant que le compte est actif et que la crèche utilise Nursee+. Lorsqu'un compte est supprimé ou qu'une crèche cesse d'utiliser le service, les informations personnelles associées sont supprimées ou anonymisées sous 30 jours, sauf obligation légale de conservation plus longue (par exemple les factures).",
        ],
      },
      {
        h: "7. Sécurité",
        p: [
          "Toutes les communications sont chiffrées en HTTPS, les mots de passe sont hachés, les jetons de connexion sont stockés dans l'espace sécurisé de l'appareil, les accès sont limités selon le rôle et les données de chaque crèche sont séparées. Aucun système n'est parfaitement sûr, mais nous protégeons vos informations et corrigeons rapidement tout problème.",
        ],
      },
      {
        h: "8. Vos droits et choix",
        p: [
          "Vous pouvez demander l'accès, la rectification, l'export ou la suppression de vos informations personnelles. Votre crèche peut modifier directement de nombreuses informations. Vous pouvez aussi nous écrire à {email} ou suivre la procédure de la page Supprimer le compte. Nous pourrons vérifier votre identité et impliquer votre crèche, qui gère les dossiers de votre enfant.",
        ],
      },
      {
        h: "9. Modifications",
        p: [
          "Nous pouvons mettre à jour cette politique. La date en haut de page sera modifiée, et les changements importants seront signalés dans l'application.",
        ],
      },
      {
        h: "10. Nous contacter",
        p: ["Pour toute question sur cette politique ou vos informations : {email}."],
      },
    ],
  },

  support: {
    title: "Assistance",
    description: "Obtenez de l'aide pour les applications Nursee+ parents et enseignants.",
    intro: "Nous aidons les parents, les enseignants et les équipes de crèche à tirer le meilleur de Nursee+.",
    contactTitle: "Contacter l'assistance",
    contactBody: "Écrivez-nous en indiquant le nom de votre crèche et l'e-mail ou l'identifiant utilisé dans l'application.",
    responseTime: "Nous répondons sous 1 à 2 jours ouvrés.",
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Comment obtenir un compte Nursee+ ?",
        a: "Les comptes sont créés par votre crèche. Demandez à la direction de vous ajouter : elle vous communiquera vos identifiants.",
      },
      {
        q: "J'ai oublié mon mot de passe ou je n'arrive pas à me connecter.",
        a: "Contactez la direction de votre crèche : elle peut réinitialiser votre mot de passe depuis le tableau de bord Nursee+. Sinon, écrivez-nous à {email}.",
      },
      {
        q: "Je ne reçois pas les notifications.",
        a: "Vérifiez que les notifications sont autorisées pour Nursee+ dans les réglages du téléphone, consultez les préférences de notification dans l'application et installez la dernière version. Se déconnecter puis se reconnecter actualise aussi l'enregistrement de l'appareil.",
      },
      {
        q: "Comment changer la langue de l'application ?",
        a: "Ouvrez l'onglet Plus et choisissez votre langue. Nursee+ est disponible en arabe, anglais et français.",
      },
      {
        q: "Qui peut voir les informations et photos de mon enfant ?",
        a: "Vous, les autres tuteurs rattachés à votre enfant et le personnel autorisé de la crèche uniquement. Consultez notre politique de confidentialité pour plus de détails.",
      },
      {
        q: "Comment supprimer mon compte ?",
        a: "Suivez les étapes de la page Supprimer le compte, ou écrivez à {email} depuis l'adresse liée à votre compte.",
      },
    ],
    nurseryTitle: "Vous êtes une crèche ?",
    nurseryBody: "Vous souhaitez utiliser Nursee+ ? Demandez une démo gratuite et notre équipe vous contactera.",
  },

  deletion: {
    title: "Supprimer votre compte",
    description: "Comment demander la suppression de votre compte et de vos données Nursee+.",
    intro: ["Vous pouvez à tout moment nous demander de supprimer votre compte Nursee+ et les informations personnelles associées."],
    sections: [
      {
        h: "Comment demander la suppression",
        list: [
          "Envoyez un e-mail à {email} depuis l'adresse liée à votre compte Nursee+, avec pour objet « Supprimer mon compte ».",
          "Indiquez votre nom complet et le nom de votre crèche.",
          "Nous confirmerons votre demande et effectuerons la suppression sous 30 jours. Vous pouvez aussi demander à la direction de votre crèche de supprimer votre compte.",
        ],
      },
      {
        h: "Ce qui est supprimé",
        list: [
          "Votre compte et votre profil (nom, e-mail, téléphone, photo) ainsi que l'enregistrement de votre appareil pour les notifications.",
          "Vos messages et préférences de notification.",
          "Si vous êtes le seul tuteur rattaché à un enfant, le profil de l'enfant, son journal et ses photos sont supprimés en lien avec la crèche.",
        ],
      },
      {
        h: "Ce qui peut être conservé",
        p: [
          "Certains documents peuvent être conservés pour une durée limitée lorsque la loi l'exige, comme les factures et paiements, ou lorsque la crèche doit conserver les registres de présence. Ils sont conservés en sécurité puis supprimés lorsqu'ils ne sont plus nécessaires.",
        ],
      },
    ],
    button: "Envoyer une demande de suppression",
  },
};

export default fr;
