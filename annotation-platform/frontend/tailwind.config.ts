import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "1.125rem",
        md: "0.75rem",
        sm: "0.5rem",
        xl: "1.375rem",
        "2xl": "1.5rem",
        full: "9999px",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Text'", "'Inter'", "system-ui", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Display'", "'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        product: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0",
      },
    },
  },
  plugins: [],
};

export default config;
