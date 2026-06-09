import { createContext, useContext, useState } from "react";
import { COLORS } from "../theme/colors";

type Theme = "dark" | "light";

const ThemeContext = createContext({
  theme: "dark" as Theme,
  colors: COLORS.dark,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  const colors = COLORS[theme];

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
