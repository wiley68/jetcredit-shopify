import { useEffect } from 'react';
import { useLoaderData } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function LocaleInitializer() {
    const { i18n } = useTranslation();
    const loaderData = useLoaderData();

    useEffect(() => {
        // If we have shop locale from loader, use it
        if (loaderData?.shopLocale) {
            const normalizedLocale = loaderData.shopLocale.split('-')[0].toLowerCase();
            const supportedLocale = ['en', 'bg'].includes(normalizedLocale) ? normalizedLocale : 'en';

            if (i18n.language !== supportedLocale) {
                i18n.changeLanguage(supportedLocale);
            }
        }
    }, [loaderData?.shopLocale, i18n]);

    return null; // This component doesn't render anything
}
