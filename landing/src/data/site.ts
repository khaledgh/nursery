// Contact details and store links. Empty values are simply not rendered.
export const site = {
  name: "Nursee+",
  url: import.meta.env.PUBLIC_SITE_URL ?? "https://nurseeplus.com",
  apiUrl: import.meta.env.PUBLIC_API_URL ?? "https://nurseeplus.gonext.tech/api/v1",
  adminUrl: import.meta.env.PUBLIC_ADMIN_URL ?? "https://nurseeplus.gonext.tech",
  email: import.meta.env.PUBLIC_CONTACT_EMAIL || "support@nurseeplus.com",
  phone: import.meta.env.PUBLIC_CONTACT_PHONE ?? "",
  whatsapp: import.meta.env.PUBLIC_CONTACT_WHATSAPP ?? "",
  appStoreUrl: import.meta.env.PUBLIC_APP_STORE_URL ?? "",
  playStoreUrl: import.meta.env.PUBLIC_PLAY_STORE_URL ?? "",
  instagram: import.meta.env.PUBLIC_INSTAGRAM_URL ?? "",
  facebook: import.meta.env.PUBLIC_FACEBOOK_URL ?? "",
};
