/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Registration page on the TrueLink site (HTTPS only). */
  readonly VITE_TRUELINK_SIGNUP_URL?: string;
  readonly VITE_TRUELINK_SIGNUP_URL_EN?: string;
  /** TrueLink web tools / sign-in entry (HTTPS only). */
  readonly VITE_TRUELINK_APP_URL?: string;
  /** Same-origin path to an approved official logo, e.g. ./brand/truelink-logo.svg */
  readonly VITE_BRAND_LOGO_URL?: string;
}
