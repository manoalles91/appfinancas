import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata = {
  title: "Controle Financeiro Master 2.0",
  description: "Gerencie seus gastos, cartões, parcelas e projeções financeiras com estilo.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
