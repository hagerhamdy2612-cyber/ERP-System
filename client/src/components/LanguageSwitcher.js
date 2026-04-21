import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // Update document direction for RTL support
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  };

  const currentLanguage = i18n.language || 'en';

  return (
    <div className="relative inline-block">
      <div className="flex items-center space-x-2">
        <Globe className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        <select
          value={currentLanguage}
          onChange={(e) => changeLanguage(e.target.value)}
          className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-0"
        >
          <option value="en">{t('common.languageEnglish')}</option>
          <option value="ar">{t('common.languageArabic')}</option>
        </select>
      </div>
    </div>
  );
};

export default LanguageSwitcher;

