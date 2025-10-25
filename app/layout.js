import "../styles/globals.css";

export const metadata = {
  title: "Model Gen AI",
  description: "Photoshoot Model Generator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {children}
      </body>
    </html>
  );
}
