import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type LangCode = 'pt-BR' | 'en-US' | 'es-ES';

const LANGS: { code: LangCode; labelKey: 'sidebar.languagePtBR' | 'sidebar.languageEnUS' | 'sidebar.languageEsES' }[] = [
  { code: 'pt-BR', labelKey: 'sidebar.languagePtBR' },
  { code: 'en-US', labelKey: 'sidebar.languageEnUS' },
  { code: 'es-ES', labelKey: 'sidebar.languageEsES' },
];

interface LanguageSwitcherProps {
  onSelect?: () => void;
}

export function LanguageSwitcher({ onSelect }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const current = i18n.language;

  const handleClick = (code: LangCode) => {
    if (code !== current) {
      void i18n.changeLanguage(code);
    }
    onSelect?.();
  };

  return (
    <div className="flex flex-col gap-0.5" role="group" aria-label={t('sidebar.language')}>
      <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs font-medium">
        <Globe className="h-3.5 w-3.5" />
        {t('sidebar.language')}
      </div>
      {LANGS.map(({ code, labelKey }) => {
        const isActive = current === code;
        return (
          <button
            key={code}
            type="button"
            data-testid={`language-option-${code}`}
            aria-pressed={isActive}
            onClick={() => handleClick(code)}
            className={cn(
              'hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
              isActive && 'bg-accent/50',
            )}
          >
            <span className="flex-1 text-left">{t(labelKey)}</span>
            {isActive && <Check className="h-4 w-4" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
