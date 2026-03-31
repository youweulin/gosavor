import { createContext, useContext, useMemo } from 'react';
import { getT } from './index';

type TFunction = (key: string) => string;

const I18nContext = createContext<TFunction>((key) => key);

export const I18nProvider = ({ lang, children }: { lang: string; children: React.ReactNode }) => {
  const t = useMemo(() => getT(lang), [lang]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
};

export const useT = () => useContext(I18nContext);
