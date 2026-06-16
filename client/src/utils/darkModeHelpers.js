/**
 * Helper function to get dark mode tooltip styles for Recharts
 */
export const getDarkModeTooltipStyle = () => {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    backgroundColor: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    color: isDark ? '#fff' : '#000'
  };
};

/**
 * Helper function to get dark mode status badge colors
 */
export const getStatusBadgeColors = (status) => {
  const baseColors = {
    delivered: { bg: 'bg-green-100', text: 'text-green-800', darkBg: 'dark:bg-green-500/20', darkText: 'dark:text-green-400' },
    confirmed: { bg: 'bg-purple-100', text: 'text-purple-800', darkBg: 'dark:bg-purple-500/20', darkText: 'dark:text-purple-400' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', darkBg: 'dark:bg-yellow-500/20', darkText: 'dark:text-yellow-400' },
    paid: { bg: 'bg-green-100', text: 'text-green-800', darkBg: 'dark:bg-green-500/20', darkText: 'dark:text-green-400' },
    unpaid: { bg: 'bg-red-100', text: 'text-red-800', darkBg: 'dark:bg-red-500/20', darkText: 'dark:text-red-400' },
    default: { bg: 'bg-gray-100', text: 'text-gray-800', darkBg: 'dark:bg-slate-700', darkText: 'dark:text-gray-300' }
  };
  
  return baseColors[status] || baseColors.default;
};

