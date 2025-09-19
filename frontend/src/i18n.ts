import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => {
  // Validate that the incoming `locale` parameter is valid
  if (!['en', 'pt-BR'].includes(locale)) {
    // This could be a redirect or an error page
    return {};
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
