

const themes = [
    { id: 'default', label: 'Default', color: '#3b82f6' },
    { id: 'modern', label: 'Modern', color: '#6366f1' },
    { id: 'nature', label: 'Nature', color: '#22c55e' },
    { id: 'urban', label: 'Urban', color: '#64748b' },
    { id: 'tech', label: 'Tech', color: '#a855f7' }
];

interface ThemeSelectorProps {
    selectedTheme: string;
    onThemeChange: (themeId: string) => void;
}

export function ThemeSelector({ selectedTheme, onThemeChange }: ThemeSelectorProps) {
    return (
        <div className="grid grid-cols-5 gap-4">
            {themes.map((theme) => (
                <button
                    key={theme.id}
                    type="button"
                    onClick={() => onThemeChange(theme.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${selectedTheme === theme.id
                        ? 'border-blue-500 shadow-md'
                        : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600 bg-white dark:bg-gray-700'
                        }`}
                >
                    <div
                        className="w-full h-4 rounded mb-2"
                        style={{ backgroundColor: theme.color }}
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{theme.label}</span>
                </button>
            ))}
        </div>
    );
}
