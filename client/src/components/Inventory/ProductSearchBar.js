import React from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ProductSearchBar = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('inventory.products.searchPlaceholder')}
        className="block w-full rounded-md border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />
    </div>
  );
};

export default ProductSearchBar;
