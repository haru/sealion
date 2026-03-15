import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export default getRequestConfig(async () => {
  const acceptLanguage = (await headers()).get("accept-language") ?? "";

  // Pick "ja" if the browser prefers Japanese, otherwise "en"
  const locale = acceptLanguage.toLowerCase().includes("ja") ? "ja" : "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
