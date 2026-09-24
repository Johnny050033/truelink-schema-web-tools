/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Registration page on the TrueLink site (HTTPS only). */
  readonly VITE_TRUELINK_SIGNUP_URL?: string;
  readonly VITE_TRUELINK_SIGNUP_URL_EN?: string;
  /** TrueLink web tools / sign-in entry (HTTPS only). */
  readonly VITE_TRUELINK_APP_URL?: string;
  /** Same-origin path of the TrueLink host bridge page, e.g. /studio/host.html (enables cloud drafts). */
  readonly VITE_TRUELINK_HOST_URL?: string;
  readonly VITE_TRUELINK_KYC_URL?: string;
}
