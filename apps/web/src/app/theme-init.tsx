export function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var stored = localStorage.getItem('chainsentinel-theme');
              var theme;
              if (stored === 'light' || stored === 'dark') {
                theme = stored;
              } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                theme = 'dark';
              } else {
                theme = 'light';
              }
              // Apply to <html> element
              var root = document.documentElement;
              root.classList.remove('dark', 'light');
              root.classList.add(theme);
              root.setAttribute('data-theme', theme);
              root.style.colorScheme = theme;
              // Persist back if nothing was stored
              if (!stored) {
                localStorage.setItem('chainsentinel-theme', theme);
              }
            } catch(e) {
              // Fallback: ensure dark theme
              document.documentElement.classList.add('dark');
              document.documentElement.setAttribute('data-theme', 'dark');
              document.documentElement.style.colorScheme = 'dark';
            }
          })();
        `,
      }}
    />
  );
}
